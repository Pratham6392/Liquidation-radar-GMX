import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  createElement,
  useEffect,
} from "react";
import type { BucketSize, Candle, Market, Protocol } from "../types";
import { MARKETS } from "../services/mockData";
import type { Bucket } from "../types";
import { fetchCandles, marketIdToTokenSymbol } from "../services/gmxOracle";
import {
  fetchMarketSummary,
  fetchHeatmap,
  fetchWhalesAtRisk,
  type WhalePosition,
} from "../services/backend";

// ─── Summary shape held in state ─────────────────────────────────────────────

export interface MarketSummaryState {
  currentPrice: number;
  totalOpenInterestUsd: number;
  longOpenInterestUsd: number;
  shortOpenInterestUsd: number;
  positionCount: number;
}

// ─── Context interface ────────────────────────────────────────────────────────

interface MarketState {
  selectedMarketId: string;
  setSelectedMarketId: (id: string) => void;
  selectedProtocol: Protocol;
  setSelectedProtocol: (p: Protocol) => void;
  bucketSize: BucketSize;
  setBucketSize: (s: BucketSize) => void;
  markets: Market[];
  currentMarket: Market | undefined;

  // Price from GMX Oracle candles (frontend)
  currentPrice: number;
  priceHistory: Candle[];
  isOracleLoading: boolean;

  // Backend-driven data
  summary: MarketSummaryState | null;
  isSummaryLoading: boolean;

  buckets: Bucket[];
  isHeatmapLoading: boolean;

  whales: WhalePosition[];
  isWhalesLoading: boolean;
}

const MarketContext = createContext<MarketState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MarketProvider({ children }: { children: ReactNode }) {
  const [selectedMarketId, setSelectedMarketId] = useState<string>(MARKETS[0].id);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol>("GMX");
  const [bucketSize, setBucketSize] = useState<BucketSize>(1);

  // Oracle candles price (used for the mini-chart and as a fallback display price)
  const [currentPrice, setCurrentPrice] = useState<number>(MARKETS[0].currentPrice);
  const [priceHistory, setPriceHistory] = useState<Candle[]>([]);
  const [isOracleLoading, setIsOracleLoading] = useState<boolean>(false);

  // Backend summary
  const [summary, setSummary] = useState<MarketSummaryState | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Backend heatmap buckets
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [isHeatmapLoading, setIsHeatmapLoading] = useState(false);

  // Backend whales-at-risk
  const [whales, setWhales] = useState<WhalePosition[]>([]);
  const [isWhalesLoading, setIsWhalesLoading] = useState(false);

  const currentMarket = MARKETS.find((m) => m.id === selectedMarketId);

  // ── 1. GMX Oracle candles (for mini-chart + fallback price) ──────────────
  useEffect(() => {
    let cancelled = false;
    const tokenSymbol = marketIdToTokenSymbol(selectedMarketId);

    async function loadOracle() {
      setIsOracleLoading(true);
      try {
        const candles = await fetchCandles(tokenSymbol, "1m").catch(() => []);
        if (cancelled) return;
        setPriceHistory(candles);
        const last = candles.length ? candles[candles.length - 1] : undefined;
        const fallback = currentMarket?.currentPrice ?? currentPrice;
        setCurrentPrice(last?.close ?? fallback);
      } finally {
        if (!cancelled) setIsOracleLoading(false);
      }
    }

    loadOracle();
    const intervalId = window.setInterval(loadOracle, 30_000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarketId]);

  // ── 2. Backend market summary (OI stats + position count) ────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setIsSummaryLoading(true);
      setSummary(null);
      try {
        const res = await fetchMarketSummary(selectedMarketId, selectedProtocol);
        if (cancelled) return;
        setSummary({
          currentPrice: res.currentPrice,
          totalOpenInterestUsd: res.totalOpenInterestUsd,
          longOpenInterestUsd: res.longOpenInterestUsd,
          shortOpenInterestUsd: res.shortOpenInterestUsd,
          positionCount: res.positionCount,
        });
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setIsSummaryLoading(false);
      }
    }

    loadSummary();
    // Refresh every 30 s so OI stats stay fresh
    const id = window.setInterval(loadSummary, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedMarketId, selectedProtocol]);

  // ── 3. Backend heatmap buckets ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadHeatmap() {
      setIsHeatmapLoading(true);
      setBuckets([]);
      try {
        const res = await fetchHeatmap(selectedMarketId, selectedProtocol, bucketSize);
        if (cancelled) return;
        setBuckets(res.buckets);
      } catch {
        if (!cancelled) setBuckets([]);
      } finally {
        if (!cancelled) setIsHeatmapLoading(false);
      }
    }

    loadHeatmap();
    // Heatmap positions don't change minute-to-minute; refresh every hour.
    const id = window.setInterval(loadHeatmap, 60 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedMarketId, selectedProtocol, bucketSize]);

  // ── 4. Backend whales-at-risk ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadWhales() {
      setIsWhalesLoading(true);
      setWhales([]);
      try {
        const res = await fetchWhalesAtRisk(selectedMarketId, selectedProtocol, 5_000, 20);
        if (cancelled) return;
        setWhales(res.whales);
      } catch {
        if (!cancelled) setWhales([]);
      } finally {
        if (!cancelled) setIsWhalesLoading(false);
      }
    }

    loadWhales();
    // Whale positions don't change minute-to-minute; refresh every hour.
    const id = window.setInterval(loadWhales, 60 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedMarketId, selectedProtocol]);

  // ─────────────────────────────────────────────────────────────────────────

  const value: MarketState = {
    selectedMarketId,
    setSelectedMarketId,
    selectedProtocol,
    setSelectedProtocol,
    bucketSize,
    setBucketSize,
    markets: MARKETS,
    currentMarket,
    currentPrice,
    priceHistory,
    isOracleLoading,
    summary,
    isSummaryLoading,
    buckets,
    isHeatmapLoading,
    whales,
    isWhalesLoading,
  };

  return createElement(MarketContext.Provider, { value }, children);
}

export function useMarketState(): MarketState {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarketState must be used inside MarketProvider");
  return ctx;
}
