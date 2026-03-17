import type { Candle } from "../types";

const GMX_ORACLE_BASE_URL = "https://arbitrum-api.gmxinfra.io";

type GmxPeriod = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

interface RawCandlesResponse {
  period: string;
  candles: [number, number, number, number, number][];
}

interface RawTicker {
  tokenSymbol: string;
  tokenAddress: string;
  medianPrice: string;
  minPrice: string;
  maxPrice: string;
  oracleDecimals: number;
  updatedAt: number;
}

interface TickersResponse {
  tickers: RawTicker[] | RawTicker[];
}

/**
 * Map from our internal market IDs to GMX token symbols.
 * For address-based markets we use the underlying index token symbol.
 */
export function marketIdToTokenSymbol(marketId: string): string {
  switch (marketId) {
    case "ETH-USD":
      return "ETH";
    case "BTC-USD":
      return "BTC";
    case "SOL-USD":
      return "SOL";
    // ARB / USD GMX v2 market
    case "0x7f1fa204bb700853d36994da19f830b6ad18455c":
      return "ARB";
    // LINK / USD
    case "0xc25cef6061cf5de5eb761b50e4743c1f5d7e5407":
      return "LINK";
    // DOGE / USD
    case "0x0ccb4faa6f1f1b30911619f1184082ab4e25813c":
      return "DOGE";
    default:
      return "ETH";
  }
}

/**
 * Fetch current oracle tickers and return a map tokenSymbol -> medianPrice (as number).
 */
export async function fetchTickers(): Promise<Record<string, number>> {
  const res = await fetch(`${GMX_ORACLE_BASE_URL}/prices/tickers`);
  if (!res.ok) {
    throw new Error(`Failed to fetch GMX tickers: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as TickersResponse | RawTicker[];
  const tickersArray: RawTicker[] = Array.isArray(json) ? json : (json as TickersResponse).tickers;

  const result: Record<string, number> = {};
  for (const t of tickersArray) {
    const price = Number(t.medianPrice);
    if (!Number.isFinite(price)) continue;
    // Prices from oracle are already returned as floats in USD (as per example),
    // so we simply store them as-is.
    result[t.tokenSymbol.toUpperCase()] = price;
  }
  return result;
}

/**
 * Fetch historical oracle candles for a token.
 */
export async function fetchCandles(tokenSymbol: string, period: GmxPeriod): Promise<Candle[]> {
  const url = `${GMX_ORACLE_BASE_URL}/prices/candles?tokenSymbol=${encodeURIComponent(
    tokenSymbol
  )}&period=${period}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch GMX candles: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as RawCandlesResponse;
  if (!Array.isArray(json.candles)) {
    return [];
  }

  return json.candles.map(([timestamp, open, high, low, close]) => ({
    timestamp,
    open,
    high,
    low,
    close,
  }));
}

