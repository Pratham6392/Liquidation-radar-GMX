import { ORACLE_BASE_URL } from "../config";

type TickerEntry = {
  tokenAddress: string;
  tokenSymbol: string;
  minPrice: string;
  maxPrice: string;
  medianPrice?: string;
};

export async function getCurrentPriceUsd(tokenSymbol: string): Promise<number> {
  const url = `${ORACLE_BASE_URL}/prices/tickers`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Oracle HTTP error: ${res.status} ${res.statusText}`);
  }

  const list = (await res.json()) as TickerEntry[];
  if (!Array.isArray(list)) {
    throw new Error("Oracle: unexpected tickers payload shape");
  }

  const entry = list.find((t) => t.tokenSymbol === tokenSymbol);
  if (!entry) {
    throw new Error(`Oracle: no ticker for symbol ${tokenSymbol}`);
  }

  // GMX oracle returns 30-decimal prices as strings.
  // Prefer medianPrice if present, otherwise approximate from [minPrice, maxPrice].
  const scale = BigInt("1000000000000000000000000000000"); // 1e30

  let priceFixed: bigint;
  if (entry.medianPrice) {
    priceFixed = BigInt(entry.medianPrice);
  } else {
    const min = BigInt(entry.minPrice);
    const max = BigInt(entry.maxPrice);
    priceFixed = (min + max) / BigInt(2);
  }

  const price = Number(priceFixed) / Number(scale);
  return price;
}

