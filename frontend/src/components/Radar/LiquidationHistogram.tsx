import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useMarketState } from "../../state/marketState";
import { Card } from "../Common/Card";
import { formatUsd } from "../../services/liquidationBuckets";

/* ─── Y-axis formatter ───────────────────────────────────────── */
function yAxisFormatter(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function tooltipValueFormatter(
  value: number | string | ReadonlyArray<number | string> | undefined,
  name: number | string | undefined,
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const numericValue =
    typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0);
  const seriesLabel =
    name === "longSize"
      ? "Long liq"
      : name === "shortSize"
        ? "Short liq"
        : String(name ?? "Value");

  return [numericValue > 0 ? formatUsd(numericValue) : "—", seriesLabel] as const;
}

/* ─── X-axis tick ────────────────────────────────────────────── */
function CustomXTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, payload } = props;
  const label = payload?.value ?? "";
  // Show only start value for compactness
  const short = label.split("→")[0].trim();
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        textAnchor="middle"
        dy={12}
        fontSize={10}
        fill="#64748b"
        fontFamily="'JetBrains Mono', monospace"
      >
        {short}
      </text>
    </g>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export function LiquidationHistogram() {
  const { buckets, currentMarket, currentPrice, isHeatmapLoading } = useMarketState();

  if (isHeatmapLoading && buckets.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center mb-4 animate-pulse">
          <svg className="w-5 h-5 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-brand-subtle text-sm">Loading heatmap…</p>
        <p className="text-brand-muted text-xs mt-1">Fetching positions from indexer</p>
      </Card>
    );
  }

  if (buckets.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-brand-subtle text-sm">No liquidation data available</p>
        <p className="text-brand-muted text-xs mt-1">Select a market to view the heatmap</p>
      </Card>
    );
  }

  const priceToShow = currentPrice || currentMarket?.currentPrice || 0;

  return (
    <Card padding="lg" className="overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-brand-text">
            Liquidation Heatmap
          </h2>
          <p className="text-xs text-brand-subtle mt-0.5">
            USD at risk per price zone · hover bars for details ·{" "}
            <span className="text-brand-text font-medium">{buckets.length} buckets</span>
          </p>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-brand-long/80" />
            <span className="text-brand-subtle">Long liquidations</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-brand-short/80" />
            <span className="text-brand-subtle">Short liquidations</span>
          </span>
        </div>
      </div>

      {/* Current price callout */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-warning animate-pulse" />
        <span className="text-brand-warning font-medium">
          Current Price:{" "}
          {priceToShow >= 1_000
            ? `$${priceToShow.toLocaleString()}`
            : `$${priceToShow}`}
        </span>
        <span className="text-brand-muted">
          · Left = below price (long liq risk) · Right = above price (short liq risk)
        </span>
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={buckets}
            margin={{ top: 8, right: 16, left: 16, bottom: 20 }}
            barCategoryGap="20%"
            barGap={2}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={<CustomXTick />}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              interval={Math.max(0, Math.floor(buckets.length / 18) - 1)}
            />
            <YAxis
              tickFormatter={yAxisFormatter}
              tick={{ fontSize: 10, fill: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              formatter={tooltipValueFormatter}
              labelFormatter={(label) => `Zone ${String(label)}`}
              cursor={{ fill: "rgba(99,102,241,0.06)", radius: 4 }}
            />

            {/* Reference line at 0% = current price */}
            <ReferenceLine
              x={buckets.find((b) => b.rangeStart <= 0 && b.rangeEnd > 0)?.label}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              label={{
                value: "Current",
                position: "top",
                fontSize: 10,
                fill: "#f59e0b",
                fontFamily: "'DM Sans', sans-serif",
              }}
            />

            {/* Long liquidations — teal, brighter near zero */}
            <Bar dataKey="longSize" name="Long liq" stackId="a" radius={[3, 3, 0, 0]}>
              {buckets.map((b) => {
                const nearZero = Math.abs(b.distancePct) < 3;
                return (
                  <Cell
                    key={b.rangeStart}
                    fill={nearZero ? "#14b8a6" : "#0f766e"}
                    fillOpacity={nearZero ? 1 : 0.75}
                  />
                );
              })}
            </Bar>

            {/* Short liquidations — rose, brighter near zero */}
            <Bar dataKey="shortSize" name="Short liq" stackId="b" radius={[3, 3, 0, 0]}>
              {buckets.map((b) => {
                const nearZero = Math.abs(b.distancePct) < 3;
                return (
                  <Cell
                    key={b.rangeStart}
                    fill={nearZero ? "#f43f5e" : "#be123c"}
                    fillOpacity={nearZero ? 1 : 0.75}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Danger zone callout */}
      <p className="text-xs text-brand-muted mt-2">
        <span className="text-brand-warning font-medium">Dashed line</span> = current price.
        Tall bars close to the line = large USD positions that liquidate with a small price move — these are the most dangerous zones.
      </p>
    </Card>
  );
}
