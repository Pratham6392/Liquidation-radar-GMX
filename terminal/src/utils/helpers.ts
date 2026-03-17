/**
 * helpers.ts
 *
 * Shared utility functions used by all event handlers:
 *   - GMXEventData tuple type matching the Envio-generated eventData shape
 *   - Key-value extractors for GMX event data items
 *   - Precision converters (GMX uses 1e30 for all USD/price values)
 *   - Position ID and update ID generators
 *   - Leverage calculator
 *   - calculateMarginHealth — quantitative health scoring (plan spec)
 *   - Market label resolver for GMX market contract addresses
 */

import { BigDecimal } from "generated";

// ── Precision constants ──────────────────────────────────────────────────────

/** GMX v2 stores all USD values and prices with 30 decimal places. */
export const GMX_USD_PRECISION = new BigDecimal("1e30");

/**
 * Most EVM index tokens (ETH, BTC, etc.) on Arbitrum have 18 decimal places.
 * GMX stores sizeInTokens with the native token precision.
 */
export const TOKEN_DECIMALS_18 = new BigDecimal("1e18");

/**
 * Hyperliquid stores prices in micro-USDC units (6 decimal places).
 * Sizes are stored with 8 decimal places (similar to a satoshi unit).
 * Kept here for when Hyperliquid integration is re-enabled.
 */
export const HL_PRICE_PRECISION = new BigDecimal("1e6");
export const HL_SIZE_PRECISION  = new BigDecimal("1e8");
export const HL_PNL_PRECISION   = new BigDecimal("1e6");

/** Maintenance Margin Rate: 1% per GMX/Hyperliquid perpetual convention. */
export const MAINTENANCE_MARGIN_RATE = new BigDecimal("0.01");

export const ZERO        = new BigDecimal(0);
export const ONE_HUNDRED = new BigDecimal(100);

// ── GMX EventLogData tuple type ──────────────────────────────────────────────
//
// Envio decodes the GMX v2 EventUtils.EventLogData struct as a positional
// 7-tuple. Each element represents one typed item collection and is itself a
// 2-tuple of [items, arrayItems] where every item is a [key, value] pair.
//
// Index → collection:
//   [0] addressItems  → [Array<[string, string]>,   Array<[string, string[]]>]
//   [1] uintItems     → [Array<[string, bigint]>,   Array<[string, bigint[]]>]
//   [2] intItems      → [Array<[string, bigint]>,   Array<[string, bigint[]]>]
//   [3] boolItems     → [Array<[string, boolean]>,  Array<[string, boolean[]]>]
//   [4] bytes32Items  → [Array<[string, string]>,   Array<[string, string[]]>]
//   [5] bytesItems    → [Array<[string, string]>,   Array<[string, string[]]>]
//   [6] stringItems   → [Array<[string, string]>,   Array<[string, string[]]>]

export type GMXEventData = [
  [Array<[string, string]>,   Array<[string, string[]]>],
  [Array<[string, bigint]>,   Array<[string, bigint[]]>],
  [Array<[string, bigint]>,   Array<[string, bigint[]]>],
  [Array<[string, boolean]>,  Array<[string, boolean[]]>],
  [Array<[string, string]>,   Array<[string, string[]]>],
  [Array<[string, string]>,   Array<[string, string[]]>],
  [Array<[string, string]>,   Array<[string, string[]]>],
];

// ── GMX item extractors ──────────────────────────────────────────────────────
// Each extractor indexes the correct tuple position and searches by key name.

export function getAddressItem(data: GMXEventData, key: string): string {
  const found = data[0][0].find(([k]) => k === key);
  return found ? found[1] : "";
}

export function getUintItem(data: GMXEventData, key: string): bigint {
  const found = data[1][0].find(([k]) => k === key);
  return found ? found[1] : 0n;
}

export function getIntItem(data: GMXEventData, key: string): bigint {
  const found = data[2][0].find(([k]) => k === key);
  return found ? found[1] : 0n;
}

export function getBoolItem(data: GMXEventData, key: string): boolean {
  const found = data[3][0].find(([k]) => k === key);
  return found ? found[1] : false;
}

// ── Precision converters ─────────────────────────────────────────────────────

/** Convert a GMX 30-decimal precision uint (bigint) to a human-readable BigDecimal in USD. */
export function fromGmxUsd(raw: bigint): BigDecimal {
  return new BigDecimal(raw.toString()).div(GMX_USD_PRECISION);
}

/** Convert a GMX 30-decimal precision int (bigint; may be negative) to BigDecimal in USD. */
export function fromGmxInt(raw: bigint): BigDecimal {
  return new BigDecimal(raw.toString()).div(GMX_USD_PRECISION);
}

/** Convert a GMX sizeInTokens (18-decimal) to BigDecimal token units. */
export function fromGmxTokens(raw: bigint): BigDecimal {
  return new BigDecimal(raw.toString()).div(TOKEN_DECIMALS_18);
}

/** Convert a Hyperliquid micro-USDC price to BigDecimal USD. */
export function fromHlPrice(raw: bigint): BigDecimal {
  return new BigDecimal(raw.toString()).div(HL_PRICE_PRECISION);
}

/** Convert a Hyperliquid size (8 decimals) to BigDecimal units. */
export function fromHlSize(raw: bigint): BigDecimal {
  return new BigDecimal(raw.toString()).div(HL_SIZE_PRECISION);
}

/** Convert a Hyperliquid PnL (micro-USDC) to BigDecimal USD. */
export function fromHlPnl(raw: bigint): BigDecimal {
  return new BigDecimal(raw.toString()).div(HL_PNL_PRECISION);
}

// ── ID generators ────────────────────────────────────────────────────────────

/**
 * Deterministic Position ID — same key for any event on the same
 * (protocol, user, market, direction).
 * Format: PROTOCOL-<user_lowercase>-<market_lowercase>-long|short
 */
export function getPositionId(
  protocol: string,
  user: string,
  market: string,
  isLong: boolean,
): string {
  return `${protocol}-${user.toLowerCase()}-${market.toLowerCase()}-${isLong ? "long" : "short"}`;
}

/**
 * Unique PositionUpdate ID for a specific event on a specific position.
 * Format: <positionId>-<EVENT_TYPE>-<blockNumber>-<logIndex>
 */
export function getUpdateId(
  positionId: string,
  eventType: string,
  blockNumber: number,
  logIndex: number,
): string {
  return `${positionId}-${eventType}-${blockNumber}-${logIndex}`;
}

// ── Financial helpers ────────────────────────────────────────────────────────

/**
 * Effective leverage = notional / collateral.
 * Returns 0 when collateral is zero to avoid division-by-zero.
 */
export function calculateLeverage(
  notionalSizeUsd: BigDecimal,
  collateralUsd: BigDecimal,
): BigDecimal {
  if (collateralUsd.isZero()) return ZERO;
  return notionalSizeUsd.div(collateralUsd);
}

/**
 * Estimated liquidation price.
 *   long:  liqPrice = entryPrice × (1 − collateralRatio + MMR)
 *   short: liqPrice = entryPrice × (1 + collateralRatio − MMR)
 *
 * Returns 0 when notional is zero.
 */
export function estimateLiquidationPrice(
  isLong: boolean,
  entryPrice: BigDecimal,
  notionalSizeUsd: BigDecimal,
  collateralUsd: BigDecimal,
): BigDecimal {
  if (notionalSizeUsd.isZero()) return ZERO;
  const marginRatio = collateralUsd.div(notionalSizeUsd);
  if (isLong) {
    return entryPrice.times(
      new BigDecimal(1).minus(marginRatio).plus(MAINTENANCE_MARGIN_RATE),
    );
  } else {
    return entryPrice.times(
      new BigDecimal(1).plus(marginRatio).minus(MAINTENANCE_MARGIN_RATE),
    );
  }
}

// ── Margin health calculation (plan specification) ───────────────────────────

export interface MarginHealthResult {
  /** Quantitative score: (Equity / MaintenanceMargin) × 100 */
  healthScore:      BigDecimal;
  /** Human-readable bucket derived from healthScore */
  marginHealth:     string;
  /** Estimated unrealised PnL in USD */
  unrealizedPnlUsd: BigDecimal;
  /** Equity = max(initialCollateral + unrealizedPnl − fees, 0) */
  equity:           BigDecimal;
}

/**
 * calculateMarginHealth
 *
 * Step 1 — Unrealised PnL
 *   long  → pnl = (currentPrice − entryPrice) × tokenSize
 *   short → pnl = (entryPrice − currentPrice) × tokenSize
 *
 * Step 2 — Equity (floored at 0)
 *   equity = max(initialCollateralUsd + unrealizedPnlUsd − accruedFeesUsd, 0)
 *
 * Step 3 — Maintenance Margin
 *   MM = notionalSizeUsd × MMR   (MMR = 0.01)
 *
 * Step 4 — Health Score
 *   HealthScore = (equity / MM) × 100
 *
 * Step 5 — Health Bucket
 *   > 200 → HEALTHY | > 150 → MODERATE | > 110 → AT_RISK |
 *   > 100 → WARNING | ≤ 100 → CRITICAL
 */
export function calculateMarginHealth(
  isLong: boolean,
  currentPriceUsd: BigDecimal,
  entryPriceUsd: BigDecimal,
  tokenSize: BigDecimal,
  initialCollateralUsd: BigDecimal,
  accruedFeesUsd: BigDecimal,
  notionalSizeUsd: BigDecimal,
): MarginHealthResult {

  const priceDelta = isLong
    ? currentPriceUsd.minus(entryPriceUsd)
    : entryPriceUsd.minus(currentPriceUsd);

  const unrealizedPnlUsd = priceDelta.times(tokenSize);

  const rawEquity = initialCollateralUsd.plus(unrealizedPnlUsd).minus(accruedFeesUsd);
  const equity    = BigDecimal.max(rawEquity, ZERO);

  const maintenanceMargin = notionalSizeUsd.times(MAINTENANCE_MARGIN_RATE);

  let healthScore: BigDecimal;
  if (maintenanceMargin.isZero() || notionalSizeUsd.isZero()) {
    healthScore = ZERO;
  } else {
    healthScore = equity.div(maintenanceMargin).times(ONE_HUNDRED);
  }

  const score = healthScore.toNumber();
  let marginHealth: string;
  if (score > 200)      marginHealth = "HEALTHY";
  else if (score > 150) marginHealth = "MODERATE";
  else if (score > 110) marginHealth = "AT_RISK";
  else if (score > 100) marginHealth = "WARNING";
  else                  marginHealth = "CRITICAL";

  return { healthScore, marginHealth, unrealizedPnlUsd, equity };
}

// ── GMX market label resolver ─────────────────────────────────────────────────

/**
 * Maps well-known GMX v2 market contract addresses (Arbitrum One) to
 * human-readable trading pair symbols.
 * Falls back to the raw lowercase address when the market is not listed here.
 */
const GMX_MARKET_LABELS: Record<string, string> = {
  "0x70d95587d40a2caf56bd97485ab3eec10bee6336": "ETH-USD",
  "0x47c031236e19d024b42f8ae6780e44a573170703": "BTC-USD",
  "0x09400d9db990d5ed3f35d7be61dfaeb900af03c9": "SOL-USD",
  "0xd9535bb5f58a1a75032416f2dfa46ad86af56490": "ARB-USD",
  "0xc7b99a164efd027a93f147376cc7da7c67c6abe0": "LINK-USD",
  "0x0ccb4faa6f1f1b74581e7e6f9b3cc6da6a7d2400": "AVAX-USD",
  "0xf5f30b10141e1f63fc11ed772931a8294a591996": "MATIC-USD",
};

export function resolveGmxMarket(marketAddress: string): string {
  return GMX_MARKET_LABELS[marketAddress.toLowerCase()] ?? marketAddress.toLowerCase();
}
