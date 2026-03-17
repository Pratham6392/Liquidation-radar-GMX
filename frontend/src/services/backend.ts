import type { Bucket } from "../types";

const API_BASE = "http://localhost:4000/api/v1";

// ─── Response types ───────────────────────────────────────────────────────────

export interface MarketSummaryResponse {
  marketId: string;
  protocol: string;
  currentPrice: number;
  totalOpenInterestUsd: number;
  longOpenInterestUsd: number;
  shortOpenInterestUsd: number;
  positionCount: number;
}

export interface HeatmapResponse {
  marketId: string;
  protocol: string;
  currentPrice: number;
  bucketSizePct: number;
  buckets: Bucket[];
}

export interface WhalePosition {
  id: string;
  user: string;
  isLong: boolean;
  sizeUsd: number;
  initialCollateralUsd: number;
  liquidationPrice: number;
  leverage?: number;
  distanceToLiqPct: number;
}

export interface WhalesAtRiskResponse {
  marketId: string;
  protocol: string;
  currentPrice: number;
  minSizeUsd: number;
  limit: number;
  whales: WhalePosition[];
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export async function fetchMarketSummary(
  marketId: string,
  protocol: string,
): Promise<MarketSummaryResponse> {
  const res = await fetch(
    `${API_BASE}/markets/${encodeURIComponent(marketId)}/summary?protocol=${encodeURIComponent(protocol)}`,
  );
  if (!res.ok) throw new Error(`summary HTTP ${res.status}`);
  return res.json() as Promise<MarketSummaryResponse>;
}

export async function fetchHeatmap(
  marketId: string,
  protocol: string,
  bucketSizePct: number,
): Promise<HeatmapResponse> {
  const res = await fetch(
    `${API_BASE}/markets/${encodeURIComponent(marketId)}/heatmap?protocol=${encodeURIComponent(protocol)}&bucketSizePct=${bucketSizePct}`,
  );
  if (!res.ok) throw new Error(`heatmap HTTP ${res.status}`);
  return res.json() as Promise<HeatmapResponse>;
}

export async function fetchWhalesAtRisk(
  marketId: string,
  protocol: string,
  minSizeUsd = 5000,
  limit = 20,
): Promise<WhalesAtRiskResponse> {
  const res = await fetch(
    `${API_BASE}/markets/${encodeURIComponent(marketId)}/whales-at-risk?protocol=${encodeURIComponent(protocol)}&minSizeUsd=${minSizeUsd}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`whales-at-risk HTTP ${res.status}`);
  return res.json() as Promise<WhalesAtRiskResponse>;
}
