/**
 * stressTest.ts — Layer 2 Margin Health Stress Testing Engine
 *
 * Provides purely functional, stateless helpers to simulate how a set of open
 * GMX positions would fare under a hypothetical price shock.  No database
 * writes occur — inputs come from a GraphQL query result and outputs are
 * returned in-memory for the frontend to render.
 *
 * The math reuses `calculateMarginHealth` from helpers.ts verbatim so that
 * stress-test results are 100% consistent with the live health scores stored
 * in the database.
 *
 * Usage:
 *   const positions = await graphqlClient.query(OpenPositionsForStress, { market: "ETH-USD" });
 *   const result = simulateStressForMarket(positions, currentPrice * 0.95);  // -5% shock
 */

import { BigDecimal } from "generated";
import {
  calculateMarginHealth,
  ZERO,
  TOKEN_DECIMALS_18,
} from "./helpers";

// ── Type definitions ──────────────────────────────────────────────────────────

/**
 * Minimal position shape required by the stress test engine.
 * Matches the fields returned by the `OpenPositionsForStress` GraphQL query.
 */
export interface StressPosition {
  id:                   string;
  user:                 string;
  isLong:               boolean;
  entryPrice:           BigDecimal;
  notionalSizeUsd:      BigDecimal;
  initialCollateralUsd: BigDecimal;
  accruedFeesUsd:       BigDecimal;
  healthScore:          BigDecimal;
  marginHealth:         string;
  liquidationPrice:     BigDecimal;
}

/**
 * Result of stress-testing a single position at a shocked price.
 */
export interface SingleStressResult {
  positionId:        string;
  user:              string;
  isLong:            boolean;
  originalHealth:    string;
  newHealthScore:    BigDecimal;
  newMarginHealth:   string;
  crossesLiquidation: boolean;
  notionalSizeUsd:   BigDecimal;
}

/**
 * Aggregated result for an entire market under a price shock.
 */
export interface MarketStressResult {
  /** The hypothetical price used for the simulation */
  shockedPrice:         BigDecimal;
  /** Original price passed as baseline (optional, for display) */
  baselinePrice:        BigDecimal | null;
  /** % change between baseline and shocked price */
  priceChangePct:       number | null;

  /** Count of positions that would be liquidated */
  liquidationCount:     number;
  /** Total USD notional that would cross the liquidation threshold */
  liquidationNotionalUsd: BigDecimal;

  /** Distribution of positions across health buckets at the shocked price */
  distribution: {
    HEALTHY:  { count: number; notionalUsd: BigDecimal };
    MODERATE: { count: number; notionalUsd: BigDecimal };
    AT_RISK:  { count: number; notionalUsd: BigDecimal };
    WARNING:  { count: number; notionalUsd: BigDecimal };
    CRITICAL: { count: number; notionalUsd: BigDecimal };
  };

  /** Per-position details for the positions that cross into CRITICAL or liquidation */
  atRiskPositions: SingleStressResult[];
}

// ── Token size estimation ─────────────────────────────────────────────────────

/**
 * Back-calculate an approximate token size from notional USD and entry price.
 * We store `notionalSizeUsd` but not `sizeInTokens` on the Position entity, so
 * this is derived.  The calculation is: tokens = notional / entryPrice.
 *
 * This approximation is fine for stress testing purposes.
 */
function estimateTokenSize(
  notionalSizeUsd: BigDecimal,
  entryPrice: BigDecimal,
): BigDecimal {
  if (entryPrice.isZero()) return ZERO;
  return notionalSizeUsd.div(entryPrice);
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Simulate a single position at a hypothetical price.
 *
 * @param position   - Open position data (from GraphQL).
 * @param shockedPrice - The hypothetical oracle price to test against.
 * @returns           - New health score, health bucket, and liquidation flag.
 */
export function simulateStressForPosition(
  position: StressPosition,
  shockedPrice: BigDecimal,
): SingleStressResult {
  const tokenSize = estimateTokenSize(position.notionalSizeUsd, position.entryPrice);

  const result = calculateMarginHealth(
    position.isLong,
    shockedPrice,
    position.entryPrice,
    tokenSize,
    position.initialCollateralUsd,
    position.accruedFeesUsd,
    position.notionalSizeUsd,
  );

  // A position crosses liquidation when its health score falls to 0 (equity ≤ 0)
  // or when the shocked price crosses the stored liquidation price estimate.
  const scoreCritical     = result.healthScore.toNumber() <= 0;
  const longCrossesLiq    = position.isLong
    && !position.liquidationPrice.isZero()
    && shockedPrice.lte(position.liquidationPrice);
  const shortCrossesLiq   = !position.isLong
    && !position.liquidationPrice.isZero()
    && shockedPrice.gte(position.liquidationPrice);

  const crossesLiquidation = scoreCritical || longCrossesLiq || shortCrossesLiq;

  return {
    positionId:         position.id,
    user:               position.user,
    isLong:             position.isLong,
    originalHealth:     position.marginHealth,
    newHealthScore:     result.healthScore,
    newMarginHealth:    result.marginHealth,
    crossesLiquidation,
    notionalSizeUsd:    position.notionalSizeUsd,
  };
}

/**
 * Simulate an entire set of open positions (for one market) at a shocked price.
 *
 * @param positions    - Array of open positions from `OpenPositionsForStress` query.
 * @param shockedPrice - The hypothetical oracle price (BigDecimal).
 * @param baselinePrice - Optional current oracle price for % display.
 * @returns             - Aggregated `MarketStressResult`.
 */
export function simulateStressForMarket(
  positions: StressPosition[],
  shockedPrice: BigDecimal,
  baselinePrice: BigDecimal | null = null,
): MarketStressResult {

  const priceChangePct = baselinePrice && !baselinePrice.isZero()
    ? shockedPrice.minus(baselinePrice).div(baselinePrice).times(new BigDecimal(100)).toNumber()
    : null;

  const distribution: MarketStressResult["distribution"] = {
    HEALTHY:  { count: 0, notionalUsd: ZERO },
    MODERATE: { count: 0, notionalUsd: ZERO },
    AT_RISK:  { count: 0, notionalUsd: ZERO },
    WARNING:  { count: 0, notionalUsd: ZERO },
    CRITICAL: { count: 0, notionalUsd: ZERO },
  };

  let liquidationCount      = 0;
  let liquidationNotional   = ZERO;
  const atRiskPositions: SingleStressResult[] = [];

  for (const pos of positions) {
    const res = simulateStressForPosition(pos, shockedPrice);

    if (res.crossesLiquidation) {
      liquidationCount++;
      liquidationNotional = liquidationNotional.plus(pos.notionalSizeUsd);
    }

    const bucket = res.newMarginHealth as keyof typeof distribution;
    if (bucket in distribution) {
      distribution[bucket].count++;
      distribution[bucket].notionalUsd = distribution[bucket].notionalUsd.plus(pos.notionalSizeUsd);
    }

    if (res.crossesLiquidation || res.newMarginHealth === "CRITICAL" || res.newMarginHealth === "WARNING") {
      atRiskPositions.push(res);
    }
  }

  // Sort at-risk positions by health score ascending (most dangerous first)
  atRiskPositions.sort((a, b) => a.newHealthScore.toNumber() - b.newHealthScore.toNumber());

  return {
    shockedPrice,
    baselinePrice,
    priceChangePct,
    liquidationCount,
    liquidationNotionalUsd: liquidationNotional,
    distribution,
    atRiskPositions,
  };
}

/**
 * Run a sweep of stress scenarios across multiple price shock percentages.
 * Useful for building a "shock curve" — how liquidation notional grows as
 * price drops (for longs) or rises (for shorts).
 *
 * @param positions    - Open positions for one market.
 * @param baselinePrice - Current oracle price.
 * @param shockPcts    - Array of percentage shocks, e.g. [-1, -3, -5, -10, -15, -20].
 * @returns             - Array of `MarketStressResult`, one per shock level.
 */
export function sweepStressScenarios(
  positions: StressPosition[],
  baselinePrice: BigDecimal,
  shockPcts: number[],
): MarketStressResult[] {
  return shockPcts.map((pct) => {
    const multiplier  = new BigDecimal(1 + pct / 100);
    const shockedPrice = baselinePrice.times(multiplier);
    return simulateStressForMarket(positions, shockedPrice, baselinePrice);
  });
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Format a BigDecimal as a USD string with commas, e.g. "$1,234,567.89" */
export function formatUsd(value: BigDecimal, decimals = 2): string {
  const n = value.toNumber();
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Summarise a `MarketStressResult` for logging or debug output. */
export function summariseStressResult(result: MarketStressResult): string {
  const pctLabel = result.priceChangePct !== null
    ? ` (${result.priceChangePct >= 0 ? "+" : ""}${result.priceChangePct.toFixed(1)}%)`
    : "";
  const lines = [
    `Stress scenario @ ${formatUsd(result.shockedPrice, 4)}${pctLabel}`,
    `  Liquidations: ${result.liquidationCount} positions / ${formatUsd(result.liquidationNotionalUsd)} notional`,
    `  Health distribution:`,
    ...Object.entries(result.distribution).map(
      ([bucket, { count, notionalUsd }]) =>
        `    ${bucket.padEnd(8)}: ${count} positions / ${formatUsd(notionalUsd)}`
    ),
  ];
  return lines.join("\n");
}
