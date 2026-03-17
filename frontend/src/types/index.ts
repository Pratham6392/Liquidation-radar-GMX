export type Protocol = "GMX" | "Hyperliquid" | "Both";

export type MarginHealth = "HEALTHY" | "MODERATE" | "AT_RISK" | "CRITICAL" | "LIQUIDATED";

export interface Market {
  id: string;
  label: string;
  protocol: Protocol;
  currentPrice: number;
  openInterest: number;
  longOI: number;
  shortOI: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Position {
  id: string;
  user: string;
  protocol: Protocol;
  market: string;
  isLong: boolean;
  entryPrice: number;
  sizeUsd: number;
  leverage: number;
  liquidationPrice: number;
  collateralUsd: number;
  marginHealth: MarginHealth;
  healthScore: number;
  isOpen: boolean;
}

export interface Bucket {
  label: string;
  rangeStart: number;
  rangeEnd: number;
  longSize: number;
  shortSize: number;
  positionCount: number;
  distancePct: number;
}

export type BucketSize = 0.5 | 1 | 2;

export interface TooltipData {
  bucket: Bucket;
  x: number;
  y: number;
}
