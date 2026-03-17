import type { Bucket, BucketSize, Position } from "../types";

export function computeBuckets(
  positions: Position[],
  currentPrice: number,
  bucketSizePct: BucketSize
): Bucket[] {
  if (currentPrice <= 0) return [];

  const bucketMap = new Map<number, Bucket>();

  function getBucketKey(pct: number): number {
    return Math.floor(pct / bucketSizePct) * bucketSizePct;
  }

  for (const pos of positions) {
    if (!pos.isOpen || pos.liquidationPrice <= 0) continue;
    const distancePct = ((pos.liquidationPrice - currentPrice) / currentPrice) * 100;
    const bucketStart = getBucketKey(distancePct);
    const bucketEnd = bucketStart + bucketSizePct;

    const existing = bucketMap.get(bucketStart);
    if (existing) {
      if (pos.isLong) existing.longSize += pos.sizeUsd;
      else existing.shortSize += pos.sizeUsd;
      existing.positionCount += 1;
    } else {
      bucketMap.set(bucketStart, {
        label: formatBucketLabel(bucketStart, bucketEnd),
        rangeStart: bucketStart,
        rangeEnd: bucketEnd,
        longSize: pos.isLong ? pos.sizeUsd : 0,
        shortSize: pos.isLong ? 0 : pos.sizeUsd,
        positionCount: 1,
        distancePct: bucketStart,
      });
    }
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.rangeStart - b.rangeStart);
}

function formatBucketLabel(start: number, end: number): string {
  const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`);
  return `${fmt(start)} → ${fmt(end)}`;
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatPrice(value: number): string {
  if (value >= 1_000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  return `$${value.toFixed(6)}`;
}
