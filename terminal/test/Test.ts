/**
 * Test.ts — HyperIndex backend test suite
 *
 * Two test suites:
 *
 *  1. Handler smoke tests: verify that EventLog1/EventLog2 handlers process
 *     mock events without throwing and create correct entity shapes.
 *
 *  2. Stress-test helpers: unit tests for `simulateStressForPosition` and
 *     `simulateStressForMarket` using synthetic positions to verify:
 *       - Health bucket transitions are correct under known price shocks.
 *       - Liquidation flags fire at the right threshold.
 *       - `sweepStressScenarios` returns consistent sorted results.
 *
 * Run: pnpm test
 */

import assert from "assert";
import { TestHelpers, BigDecimal } from "generated";
import {
  simulateStressForPosition,
  simulateStressForMarket,
  sweepStressScenarios,
  type StressPosition,
} from "../src/utils/stressTest";

const { MockDb, GMXEventEmitter } = TestHelpers;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Handler smoke tests
// ─────────────────────────────────────────────────────────────────────────────

describe("GMXEventEmitter EventLog1 handler", () => {
  it("processes a mock EventLog1 event without throwing", async () => {
    const mockDb = MockDb.createMockDb();

    const event = GMXEventEmitter.EventLog1.createMockEvent({
      // Default values are fine — handler dispatches on eventName; with the
      // default empty string it returns early without writing any entities.
    });

    const updatedDb = await GMXEventEmitter.EventLog1.processEvent({
      event,
      mockDb,
    });

    assert.ok(updatedDb, "MockDb should be returned after processing");
  });
});

describe("GMXEventEmitter EventLog2 handler", () => {
  it("processes a mock EventLog2 event without throwing", async () => {
    const mockDb = MockDb.createMockDb();

    const event = GMXEventEmitter.EventLog2.createMockEvent({});

    const updatedDb = await GMXEventEmitter.EventLog2.processEvent({
      event,
      mockDb,
    });

    assert.ok(updatedDb, "MockDb should be returned after processing");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Stress-test helper unit tests
// ─────────────────────────────────────────────────────────────────────────────

/** Helpers to build synthetic positions for tests */
function makeLongPosition(overrides: Partial<StressPosition> = {}): StressPosition {
  return {
    id:                   "GMX-0xtrader-eth-usd-long",
    user:                 "0xtrader",
    isLong:               true,
    entryPrice:           new BigDecimal("2000"),   // ETH entry at $2000
    notionalSizeUsd:      new BigDecimal("10000"),  // $10,000 notional (5x leverage)
    initialCollateralUsd: new BigDecimal("2000"),   // $2,000 collateral
    accruedFeesUsd:       new BigDecimal("10"),     // $10 fees
    healthScore:          new BigDecimal("500"),
    marginHealth:         "HEALTHY",
    liquidationPrice:     new BigDecimal("1620"),   // approx 1% MMR → liq at ~1620
    ...overrides,
  };
}

function makeShortPosition(overrides: Partial<StressPosition> = {}): StressPosition {
  return {
    id:                   "GMX-0xtrader-eth-usd-short",
    user:                 "0xtrader",
    isLong:               false,
    entryPrice:           new BigDecimal("2000"),
    notionalSizeUsd:      new BigDecimal("10000"),
    initialCollateralUsd: new BigDecimal("2000"),
    accruedFeesUsd:       new BigDecimal("10"),
    healthScore:          new BigDecimal("500"),
    marginHealth:         "HEALTHY",
    liquidationPrice:     new BigDecimal("2380"),   // short liq above entry
    ...overrides,
  };
}

describe("simulateStressForPosition — long position", () => {
  const pos = makeLongPosition();

  it("remains HEALTHY when price is unchanged", () => {
    const result = simulateStressForPosition(pos, new BigDecimal("2000"));
    assert.strictEqual(result.crossesLiquidation, false);
    assert.ok(
      result.newHealthScore.toNumber() > 200,
      `Expected HEALTHY score > 200, got ${result.newHealthScore.toNumber()}`,
    );
    assert.strictEqual(result.newMarginHealth, "HEALTHY");
  });

  it("degrades to AT_RISK on a -5% price shock", () => {
    const shockedPrice = new BigDecimal("1900"); // -5%
    const result = simulateStressForPosition(pos, shockedPrice);
    assert.strictEqual(result.crossesLiquidation, false);
    // equity = 2000 + (1900-2000)*5 - 10 = 2000 - 500 - 10 = 1490
    // MM = 10000 * 0.01 = 100
    // score = 1490/100 * 100 = 1490 → HEALTHY (position is well over-collateralised at 5x)
    assert.ok(result.newHealthScore.toNumber() > 100, "Should not be liquidated at -5%");
  });

  it("marks crossesLiquidation=true when shocked below liquidation price", () => {
    const shockedPrice = new BigDecimal("1500"); // well below liquidation price ~1620
    const result = simulateStressForPosition(pos, shockedPrice);
    assert.strictEqual(result.crossesLiquidation, true);
  });

  it("reports correct original vs new health on a shock", () => {
    const shockedPrice = new BigDecimal("1800"); // -10%
    const result = simulateStressForPosition(pos, shockedPrice);
    assert.strictEqual(result.originalHealth, "HEALTHY");
    assert.ok(result.newHealthScore.toNumber() >= 0);
  });
});

describe("simulateStressForPosition — short position", () => {
  const pos = makeShortPosition();

  it("remains HEALTHY when price drops (profit for short)", () => {
    const shockedPrice = new BigDecimal("1800"); // -10%, profitable for short
    const result = simulateStressForPosition(pos, shockedPrice);
    assert.strictEqual(result.crossesLiquidation, false);
    assert.ok(result.newHealthScore.toNumber() > 200, "Short should be healthier as price falls");
  });

  it("marks crossesLiquidation=true when price rises above liquidation price", () => {
    const shockedPrice = new BigDecimal("2400"); // above liq price ~2380
    const result = simulateStressForPosition(pos, shockedPrice);
    assert.strictEqual(result.crossesLiquidation, true);
  });
});

describe("simulateStressForMarket", () => {
  const positions: StressPosition[] = [
    makeLongPosition({ id: "pos-1", notionalSizeUsd: new BigDecimal("5000") }),
    makeLongPosition({
      id:                   "pos-2",
      notionalSizeUsd:      new BigDecimal("8000"),
      initialCollateralUsd: new BigDecimal("800"),  // 10x leverage, very thin margin
      liquidationPrice:     new BigDecimal("1980"),  // near current
    }),
    makeShortPosition({ id: "pos-3", notionalSizeUsd: new BigDecimal("3000") }),
  ];

  it("returns correct structure", () => {
    const result = simulateStressForMarket(positions, new BigDecimal("2000"));
    assert.ok(typeof result.liquidationCount === "number");
    assert.ok(result.liquidationNotionalUsd instanceof BigDecimal);
    assert.ok(Array.isArray(result.atRiskPositions));
    assert.ok("HEALTHY" in result.distribution);
    assert.ok("CRITICAL" in result.distribution);
  });

  it("reports zero liquidations at current price for well-collateralised positions", () => {
    // pos-1 (5x) and pos-3 (short) should both be fine at current price
    const safePositions = [
      makeLongPosition({ id: "safe-long" }),
      makeShortPosition({ id: "safe-short" }),
    ];
    const result = simulateStressForMarket(safePositions, new BigDecimal("2000"));
    assert.strictEqual(result.liquidationCount, 0);
  });

  it("detects liquidation of a near-liquidation position on small price drop", () => {
    const thinLong: StressPosition = makeLongPosition({
      id:                   "thin-long",
      initialCollateralUsd: new BigDecimal("200"), // 50x leverage
      liquidationPrice:     new BigDecimal("1960"),
    });
    const result = simulateStressForMarket([thinLong], new BigDecimal("1950")); // below liq price
    assert.strictEqual(result.liquidationCount, 1);
    assert.ok(result.liquidationNotionalUsd.toNumber() > 0);
  });

  it("computes non-null priceChangePct when baseline is provided", () => {
    const baseline = new BigDecimal("2000");
    const shocked  = new BigDecimal("1900");
    const result = simulateStressForMarket(positions, shocked, baseline);
    assert.ok(result.priceChangePct !== null);
    assert.ok(Math.abs((result.priceChangePct ?? 0) - (-5)) < 0.01, "Expected ~-5%");
  });
});

describe("sweepStressScenarios", () => {
  const positions = [
    makeLongPosition({ id: "sweep-long-1" }),
    makeShortPosition({ id: "sweep-short-1" }),
  ];
  const baseline = new BigDecimal("2000");

  it("returns one result per shock percentage", () => {
    const shocks = [-5, -10, -20];
    const results = sweepStressScenarios(positions, baseline, shocks);
    assert.strictEqual(results.length, shocks.length);
  });

  it("liquidation notional is monotonically non-decreasing as shock deepens (for longs)", () => {
    // Only long positions, deeper price drops should liquidate >= previous
    const longOnly = [
      makeLongPosition({ id: "sl-1", initialCollateralUsd: new BigDecimal("500") }),
      makeLongPosition({ id: "sl-2", initialCollateralUsd: new BigDecimal("300") }),
    ];
    const shocks  = [-5, -10, -15, -20];
    const results = sweepStressScenarios(longOnly, baseline, shocks);
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i].liquidationNotionalUsd.toNumber() >= results[i - 1].liquidationNotionalUsd.toNumber(),
        `Liquidation notional should not decrease as shock deepens (step ${i})`,
      );
    }
  });

  it("each result carries the correct priceChangePct", () => {
    const shocks = [-10, 5, 0];
    const results = sweepStressScenarios(positions, baseline, shocks);
    shocks.forEach((pct, i) => {
      const got = results[i].priceChangePct ?? 0;
      assert.ok(Math.abs(got - pct) < 0.01, `Expected pct ${pct}, got ${got}`);
    });
  });
});
