import type { Request, Response, NextFunction } from "express";
import { graphqlQuery } from "../lib/graphqlClient";
import { getCurrentPriceUsd } from "../lib/oracleClient";

interface PositionRow {
  isLong: boolean;
  isOpen: boolean;
  sizeUsd: string;
  liquidationPrice: string;
}

interface HeatmapQueryResponse {
  Position: PositionRow[];
}

const HEATMAP_QUERY = `
  query HeatmapPositions($market: String!, $protocol: String!) {
    Position(
      where: {
        market: { _eq: $market }
        protocol: { _eq: $protocol }
        isOpen: { _eq: true }
      }
    ) {
      isLong
      isOpen
      sizeUsd
      liquidationPrice
    }
  }
`;

type Bucket = {
  label: string;
  rangeStart: number;
  rangeEnd: number;
  longSize: number;
  shortSize: number;
  positionCount: number;
  distancePct: number;
};

function computeBucketsBackend(
  positions: PositionRow[],
  currentPrice: number,
  bucketSizePct: number,
): Bucket[] {
  if (currentPrice <= 0) return [];

  const bucketMap = new Map<number, Bucket>();

  const getBucketKey = (pct: number): number =>
    Math.floor(pct / bucketSizePct) * bucketSizePct;

  for (const pos of positions) {
    if (!pos.isOpen) continue;
    const liq = Number(pos.liquidationPrice);
    if (!Number.isFinite(liq) || liq <= 0) continue;

    const sizeUsd = Number(pos.sizeUsd);
    if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) continue;

    const distancePct = ((liq - currentPrice) / currentPrice) * 100;

    // Semantic guard: longs liquidate when price DROPS (negative %), shorts when price RISES (positive %).
    // If scale mismatch or bad data puts a long in a positive bucket or short in negative, skip so we
    // never show "Short liq" on the left or "Long liq" on the right.
    if (pos.isLong && distancePct >= 0) continue; // long with liq >= spot is invalid for heatmap
    if (!pos.isLong && distancePct <= 0) continue; // short with liq <= spot is invalid for heatmap

    const bucketStart = getBucketKey(distancePct);
    const bucketEnd = bucketStart + bucketSizePct;

    const existing = bucketMap.get(bucketStart);
    if (existing) {
      if (pos.isLong) existing.longSize += sizeUsd;
      else existing.shortSize += sizeUsd;
      existing.positionCount += 1;
    } else {
      bucketMap.set(bucketStart, {
        label: formatBucketLabel(bucketStart, bucketEnd),
        rangeStart: bucketStart,
        rangeEnd: bucketEnd,
        longSize: pos.isLong ? sizeUsd : 0,
        shortSize: pos.isLong ? 0 : sizeUsd,
        positionCount: 1,
        distancePct: bucketStart,
      });
    }
  }

  return Array.from(bucketMap.values()).sort(
    (a, b) => a.rangeStart - b.rangeStart,
  );
}

function formatBucketLabel(start: number, end: number): string {
  const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`);
  return `${fmt(start)} → ${fmt(end)}`;
}

export async function marketHeatmapController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const marketId = String(req.params.marketId);
    const protocol = String(req.query.protocol ?? "GMX");
    const bucketSize =
      Number(req.query.bucketSizePct ?? "1") || 1; // default 1%

    const symbol =
      marketId === "ETH-USD"
        ? "ETH"
        : marketId === "BTC-USD"
        ? "BTC"
        : marketId === "SOL-USD"
        ? "SOL"
        : "ETH";

    const [graphqlData, currentPrice] = await Promise.all([
      graphqlQuery<HeatmapQueryResponse>(HEATMAP_QUERY, {
        market: marketId,
        protocol,
      }),
      getCurrentPriceUsd(symbol),
    ]);

    const buckets = computeBucketsBackend(
      graphqlData.Position,
      currentPrice,
      bucketSize,
    );

    res.json({
      marketId,
      protocol,
      currentPrice,
      bucketSizePct: bucketSize,
      buckets,
    });
  } catch (err) {
    next(err);
  }
}

