import { useMarketState } from "../../state/marketState";
import { Card } from "../Common/Card";
import { formatUsd, formatPrice } from "../../services/liquidationBuckets";

function shortenAddress(addr: string, chars = 4): string {
  if (!addr.startsWith("0x") || addr.length <= 2 * chars + 2) return addr;
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 100) return `${value.toFixed(0)}%`;
  if (Math.abs(value) >= 10) return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)}%`;
}

export function WhalesAtRiskTable() {
  const { whales, isWhalesLoading, currentPrice, currentMarket } = useMarketState();

  // Use candle price — it returns correct USD values.
  // summary.currentPrice uses the /prices/tickers raw scale which is wrong.
  const spotPrice = currentPrice || currentMarket?.currentPrice || 0;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isWhalesLoading && whales.length === 0) {
    return (
      <Card className="flex flex-col gap-2 py-6 px-4 sm:px-5">
        <div className="flex items-center gap-2 text-sm text-brand-text">
          <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
          <span className="font-semibold">Whales at Risk</span>
        </div>
        <p className="text-xs text-brand-muted animate-pulse">Loading positions from indexer…</p>
      </Card>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (whales.length === 0) {
    return (
      <Card className="flex flex-col gap-2 py-4 px-4 sm:px-5">
        <div className="flex items-center gap-2 text-sm text-brand-text">
          <span className="w-2 h-2 rounded-full bg-brand-muted" />
          <span className="font-semibold">Whales at Risk</span>
        </div>
        <p className="text-xs text-brand-muted">
          No large positions (&gt;$5k) are currently close to liquidation for this market.
        </p>
      </Card>
    );
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  return (
    <Card padding="lg" className="overflow-hidden">
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-brand-text">Whales at Risk</h2>
          <p className="text-xs text-brand-subtle mt-0.5">
            Largest positions (&gt;$5k) ranked by distance to liquidation price.{" "}
            <span className="text-brand-text font-medium">{whales.length}</span> found.
          </p>
        </div>
        <div className="text-xs text-brand-muted">
          Spot:{" "}
          <span className="font-mono text-brand-text">
            {spotPrice > 0 ? formatPrice(spotPrice) : "—"}
          </span>
          {isWhalesLoading && (
            <span className="ml-2 text-brand-muted animate-pulse">Refreshing…</span>
          )}
        </div>
      </div>

      <div className="-mx-4 -mb-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-brand-border text-xs">
          <thead className="bg-brand-surface/60">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-brand-subtle uppercase tracking-wider">
                Trader
              </th>
              <th className="px-4 py-2 text-left font-semibold text-brand-subtle uppercase tracking-wider">
                Side
              </th>
              <th className="px-4 py-2 text-right font-semibold text-brand-subtle uppercase tracking-wider">
                Size (USD)
              </th>
              <th className="px-4 py-2 text-right font-semibold text-brand-subtle uppercase tracking-wider">
                Collateral
              </th>
              <th className="px-4 py-2 text-right font-semibold text-brand-subtle uppercase tracking-wider">
                Leverage
              </th>
              <th className="px-4 py-2 text-right font-semibold text-brand-subtle uppercase tracking-wider">
                Liq Price
              </th>
              <th className="px-4 py-2 text-right font-semibold text-brand-subtle uppercase tracking-wider">
                Move to Liq
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border bg-brand-card/40">
            {whales.map((p) => {
              const leverage =
                p.leverage ??
                (p.initialCollateralUsd > 0
                  ? p.sizeUsd / p.initialCollateralUsd
                  : 0);

              const moveLabel = formatPct(p.distanceToLiqPct);
              const isCloser = p.distanceToLiqPct <= 5;

              // p.liquidationPrice is stored in raw on-chain scale (not USD),
              // so derive a correct USD liq price from the candle spot and
              // the distance-to-liquidation percentage computed by the backend.
              const liqPriceUsd =
                spotPrice > 0 && Number.isFinite(p.distanceToLiqPct) && p.distanceToLiqPct > 0
                  ? p.isLong
                    ? spotPrice * (1 - p.distanceToLiqPct / 100)
                    : spotPrice * (1 + p.distanceToLiqPct / 100)
                  : 0;

              const liqDisplay = liqPriceUsd > 0 ? formatPrice(liqPriceUsd) : "—";

              return (
                <tr key={p.id} className="hover:bg-brand-surface/60 transition-colors">
                  <td className="px-4 py-2 font-mono text-[11px] text-brand-text">
                    {shortenAddress(p.user, 4)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        p.isLong
                          ? "bg-brand-long/10 text-brand-long border border-brand-long/30"
                          : "bg-brand-short/10 text-brand-short border border-brand-short/30"
                      }`}
                    >
                      {p.isLong ? "Long" : "Short"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-brand-text">
                    {formatUsd(p.sizeUsd)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-brand-text">
                    {formatUsd(p.initialCollateralUsd)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-brand-text">
                    {leverage > 0 ? `${leverage.toFixed(1)}x` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-brand-text">
                    {liqDisplay}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono tabular-nums ${
                      isCloser ? "text-brand-warning font-semibold" : "text-brand-text"
                    }`}
                  >
                    {moveLabel}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
