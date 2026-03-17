import type { Market, Position, Protocol } from "../types";

const ETH_PRICE = 3_450;
const BTC_PRICE = 98_200;
const SOL_PRICE = 185;
const ARB_PRICE = 0.82;

export const MARKETS: Market[] = [
  {
    id: "ETH-USD",
    label: "ETH / USD",
    protocol: "GMX",
    currentPrice: ETH_PRICE,
    openInterest: 14_800_000,
    longOI: 9_200_000,
    shortOI: 5_600_000,
  },
  {
    id: "BTC-USD",
    label: "BTC / USD",
    protocol: "GMX",
    currentPrice: BTC_PRICE,
    openInterest: 31_500_000,
    longOI: 18_900_000,
    shortOI: 12_600_000,
  },
  {
    id: "SOL-USD",
    label: "SOL / USD",
    protocol: "GMX",
    currentPrice: SOL_PRICE,
    openInterest: 4_200_000,
    longOI: 2_900_000,
    shortOI: 1_300_000,
  },
  {
    id: "0x7f1fa204bb700853d36994da19f830b6ad18455c",
    label: "ARB / USD",
    protocol: "GMX",
    currentPrice: ARB_PRICE,
    openInterest: 1_800_000,
    longOI: 950_000,
    shortOI: 850_000,
  },
  {
    id: "0xc25cef6061cf5de5eb761b50e4743c1f5d7e5407",
    label: "LINK / USD",
    protocol: "GMX",
    currentPrice: 14.5,
    openInterest: 890_000,
    longOI: 570_000,
    shortOI: 320_000,
  },
  {
    id: "0x0ccb4faa6f1f1b30911619f1184082ab4e25813c",
    label: "DOGE / USD",
    protocol: "GMX",
    currentPrice: 0.193,
    openInterest: 620_000,
    longOI: 410_000,
    shortOI: 210_000,
  },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Gaussian-like sample: mean=0, sd≈1, clamped.
 * Uses Box-Muller transform from two uniform samples.
 */
function gaussian(rng: () => number): number {
  const u = Math.max(1e-10, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generatePositions(market: Market, protocol: Protocol, seed: number): Position[] {
  const rng = seededRandom(seed);
  const price = market.currentPrice;
  const positions: Position[] = [];

  /**
   * Real-world observation on GMX v2 / perpetual DEXs:
   * - LONG positions are liquidated when price DROPS. Their liq price is BELOW current price.
   *   Typical leverage 5-20x → liq distance = 5% (20x) to 20% (5x) below current price.
   *   Most volume clusters at 5-12x leverage → -5% to -10%.
   *
   * - SHORT positions are liquidated when price RISES. Their liq price is ABOVE current price.
   *   Symmetric distribution, mirrored above.
   *
   * We generate positions concentrated in a Gaussian around the typical leverage clusters,
   * producing a realistic bimodal "wall" on each side of the current price.
   */

  // Generate LONG positions (liq price below current price = negative distance)
  const longCount = 55 + Math.floor(rng() * 20);
  for (let i = 0; i < longCount; i++) {
    const leverage = 3 + rng() * 22; // 3x–25x
    // Liq distance for longs: -(1 / leverage) approximately, with some spread
    // Gaussian centered at -8% with sd 4% — matches typical high-leverage cluster
    const baseDist = -8 + gaussian(rng) * 4;
    const distancePct = Math.max(-25, Math.min(-1.5, baseDist));

    const liquidationPrice = price * (1 + distancePct / 100);
    // Size is weighted: larger positions at more liquid leverage ranges (5-15x)
    const sizeUsd = 2_000 + rng() * 98_000;
    const collateralUsd = sizeUsd / leverage;
    const entryPrice = price * (1 + (rng() - 0.5) * 0.03);

    const maintenanceMarginRate = 0.005;
    const safetyFactor = collateralUsd / (sizeUsd * maintenanceMarginRate);
    let marginHealth: Position["marginHealth"] = "HEALTHY";
    if (safetyFactor < 1.05) marginHealth = "LIQUIDATED";
    else if (safetyFactor < 1.15) marginHealth = "CRITICAL";
    else if (safetyFactor < 1.4) marginHealth = "AT_RISK";
    else if (safetyFactor < 2.0) marginHealth = "MODERATE";

    positions.push({
      id: `${protocol}-${market.id}-long-${i}`,
      user: `0x${Array.from({ length: 40 }, () => Math.floor(rng() * 16).toString(16)).join("")}`,
      protocol,
      market: market.id,
      isLong: true,
      entryPrice,
      sizeUsd,
      leverage,
      liquidationPrice,
      collateralUsd,
      marginHealth,
      healthScore: safetyFactor * 100,
      isOpen: true,
    });
  }

  // Generate SHORT positions (liq price above current price = positive distance)
  const shortCount = 35 + Math.floor(rng() * 20);
  for (let i = 0; i < shortCount; i++) {
    const leverage = 3 + rng() * 22;
    // Gaussian centered at +7% with sd 3.5% (shorts typically cluster tighter)
    const baseDist = 7 + gaussian(rng) * 3.5;
    const distancePct = Math.max(1.5, Math.min(25, baseDist));

    const liquidationPrice = price * (1 + distancePct / 100);
    const sizeUsd = 2_000 + rng() * 75_000;
    const collateralUsd = sizeUsd / leverage;
    const entryPrice = price * (1 + (rng() - 0.5) * 0.03);

    const maintenanceMarginRate = 0.005;
    const safetyFactor = collateralUsd / (sizeUsd * maintenanceMarginRate);
    let marginHealth: Position["marginHealth"] = "HEALTHY";
    if (safetyFactor < 1.05) marginHealth = "LIQUIDATED";
    else if (safetyFactor < 1.15) marginHealth = "CRITICAL";
    else if (safetyFactor < 1.4) marginHealth = "AT_RISK";
    else if (safetyFactor < 2.0) marginHealth = "MODERATE";

    positions.push({
      id: `${protocol}-${market.id}-short-${i}`,
      user: `0x${Array.from({ length: 40 }, () => Math.floor(rng() * 16).toString(16)).join("")}`,
      protocol,
      market: market.id,
      isLong: false,
      entryPrice,
      sizeUsd,
      leverage,
      liquidationPrice,
      collateralUsd,
      marginHealth,
      healthScore: safetyFactor * 100,
      isOpen: true,
    });
  }

  return positions;
}

const positionCache = new Map<string, Position[]>();

export function getMockPositions(marketId: string, protocol: Protocol): Position[] {
  const key = `${marketId}-${protocol}`;
  if (positionCache.has(key)) return positionCache.get(key)!;

  const market = MARKETS.find((m) => m.id === marketId);
  if (!market) return [];

  const seed = marketId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + protocol.charCodeAt(0);
  const positions = generatePositions(market, protocol, seed);
  positionCache.set(key, positions);
  return positions;
}

export function getMockMarket(marketId: string): Market | undefined {
  return MARKETS.find((m) => m.id === marketId);
}

export function getMockCurrentPrice(marketId: string): number {
  return getMockMarket(marketId)?.currentPrice ?? 0;
}
