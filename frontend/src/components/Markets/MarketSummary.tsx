import { useMarketState } from "../../state/marketState";
import { Card } from "../Common/Card";
import { ProtocolTag } from "../Common/Tag";
import { formatUsd, formatPrice } from "../../services/liquidationBuckets";
import { MarketMiniChart } from "./MarketMiniChart";

function StatBlock({
  label,
  value,
  sub,
  loading = false,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="stat-label">{label}</span>
      {loading ? (
        <span className="stat-value animate-pulse text-brand-muted">—</span>
      ) : (
        <span className="stat-value">{value}</span>
      )}
      {sub && <span className="text-xs text-brand-subtle">{sub}</span>}
    </div>
  );
}

function OIBar({ longOI, shortOI }: { longOI: number; shortOI: number }) {
  const total = longOI + shortOI;
  if (total === 0) return null;
  const longPct = (longOI / total) * 100;
  const shortPct = 100 - longPct;

  return (
    <div className="flex flex-col gap-1.5 min-w-[140px]">
      <span className="stat-label">Long / Short OI</span>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full overflow-hidden bg-brand-surface flex">
          <div
            className="h-full bg-brand-long transition-all duration-500"
            style={{ width: `${longPct}%` }}
          />
          <div
            className="h-full bg-brand-short transition-all duration-500"
            style={{ width: `${shortPct}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-brand-long font-medium">{longPct.toFixed(1)}% L</span>
        <span className="text-brand-short font-medium">{shortPct.toFixed(1)}% S</span>
      </div>
    </div>
  );
}

export function MarketSummary() {
  const {
    currentMarket,
    currentPrice,
    priceHistory,
    isOracleLoading,
    summary,
    isSummaryLoading,
  } = useMarketState();

  if (!currentMarket) return null;

  const totalOI = summary?.totalOpenInterestUsd ?? 0;
  const longOI = summary?.longOpenInterestUsd ?? 0;
  const shortOI = summary?.shortOpenInterestUsd ?? 0;
  const positionCount = summary?.positionCount ?? 0;

  // Always use candle price — it returns correct USD values directly.
  // summary.currentPrice comes from the /prices/tickers API which uses a
  // raw on-chain integer scale that is NOT 1e30 for every token, so it
  // produces near-zero numbers for display purposes.
  const displayPrice = currentPrice || currentMarket.currentPrice;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        {/* Market label */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="stat-label">Market</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold text-brand-text tracking-tight">
              {currentMarket.label}
            </span>
            <ProtocolTag protocol={currentMarket.protocol} />
          </div>
        </div>

        <div className="h-px w-full sm:h-auto sm:w-px bg-brand-border sm:self-stretch" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 flex-1">
          <StatBlock
            label="Current Price"
            value={formatPrice(displayPrice)}
            loading={isSummaryLoading && !summary}
          />
          <StatBlock
            label="Total OI"
            value={formatUsd(totalOI)}
            sub={
              summary
                ? `${positionCount} positions`
                : isSummaryLoading
                ? "Loading…"
                : "No data"
            }
            loading={isSummaryLoading && !summary}
          />
          <StatBlock
            label="Long OI"
            value={formatUsd(longOI)}
            loading={isSummaryLoading && !summary}
          />
          <StatBlock
            label="Short OI"
            value={formatUsd(shortOI)}
            loading={isSummaryLoading && !summary}
          />
        </div>

        <div className="h-px w-full sm:h-auto sm:w-px bg-brand-border sm:self-stretch" />

        {/* OI bar */}
        <OIBar longOI={longOI} shortOI={shortOI} />
      </div>

      {/* Mini price chart */}
      <div className="mt-4 border-t border-brand-border pt-3">
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-brand-subtle font-medium">
            Price (GMX Oracle, 1m)
          </span>
          {isOracleLoading && (
            <span className="text-[11px] text-brand-muted font-mono">Refreshing…</span>
          )}
        </div>
        <MarketMiniChart candles={priceHistory} />
      </div>
    </Card>
  );
}
