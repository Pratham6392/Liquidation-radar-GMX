import { useState } from "react";
import { useMarketState } from "../../state/marketState";
import { Card } from "../Common/Card";
import { formatUsd } from "../../services/liquidationBuckets";

type SortKey = "distance" | "longSize" | "shortSize" | "total" | "count";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      className={`inline w-3 h-3 ml-1 transition-all ${active ? "text-brand-accent" : "text-brand-muted opacity-0 group-hover:opacity-100"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      {active && dir === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      )}
    </svg>
  );
}

function SizeBar({ longSize, shortSize }: { longSize: number; shortSize: number }) {
  const total = longSize + shortSize;
  if (total === 0) return <span className="text-brand-muted text-xs">—</span>;
  const longPct = (longSize / total) * 100;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-brand-surface">
        <div
          className="h-full bg-brand-long rounded-full"
          style={{ width: `${longPct}%` }}
        />
      </div>
    </div>
  );
}

export function BucketTable() {
  const { buckets } = useMarketState();
  const [sortKey, setSortKey] = useState<SortKey>("distance");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showAll, setShowAll] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "distance" ? "asc" : "desc");
    }
  }

  const sorted = [...buckets].sort((a, b) => {
    let diff = 0;
    switch (sortKey) {
      case "distance": diff = Math.abs(a.distancePct) - Math.abs(b.distancePct); break;
      case "longSize": diff = a.longSize - b.longSize; break;
      case "shortSize": diff = a.shortSize - b.shortSize; break;
      case "total": diff = (a.longSize + a.shortSize) - (b.longSize + b.shortSize); break;
      case "count": diff = a.positionCount - b.positionCount; break;
    }
    return sortDir === "asc" ? diff : -diff;
  });

  const displayed = showAll ? sorted : sorted.slice(0, 12);

  if (buckets.length === 0) return null;

  return (
    <Card padding="sm" className="overflow-hidden">
      <div className="flex items-center justify-between px-2 pt-2 pb-3">
        <h2 className="text-sm font-semibold text-brand-text">Bucket Breakdown</h2>
        <span className="text-xs text-brand-subtle">
          {buckets.length} buckets · click columns to sort
        </span>
      </div>

      {/* Table — scroll on mobile */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left border-collapse">
          <thead>
            <tr className="border-t border-brand-border">
              {[
                { key: "distance" as SortKey, label: "Bucket Range" },
                { key: "longSize" as SortKey, label: "Long (USD)" },
                { key: "shortSize" as SortKey, label: "Short (USD)" },
                { key: "total" as SortKey, label: "Total" },
                { key: "count" as SortKey, label: "Positions" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="table-th group cursor-pointer select-none hover:text-brand-text transition-colors whitespace-nowrap"
                  onClick={() => handleSort(key)}
                >
                  {label}
                  <SortIcon active={sortKey === key} dir={sortDir} />
                </th>
              ))}
              <th className="table-th hidden sm:table-cell">Ratio</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((b, i) => {
              const total = b.longSize + b.shortSize;
              const isNear = Math.abs(b.distancePct) < 2;

              return (
                <tr
                  key={b.rangeStart}
                  className={`
                    border-t border-brand-border/50 transition-colors
                    ${isNear ? "bg-brand-warning/5" : i % 2 === 0 ? "" : "bg-brand-surface/30"}
                    hover:bg-brand-surface/60
                  `}
                >
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      {isNear && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-warning shrink-0" title="Near current price" />
                      )}
                      <span className="font-mono text-xs text-brand-text">{b.label}</span>
                    </div>
                  </td>
                  <td className="table-td text-brand-long font-medium">
                    {b.longSize > 0 ? formatUsd(b.longSize) : <span className="text-brand-muted">—</span>}
                  </td>
                  <td className="table-td text-brand-short font-medium">
                    {b.shortSize > 0 ? formatUsd(b.shortSize) : <span className="text-brand-muted">—</span>}
                  </td>
                  <td className="table-td text-brand-text font-semibold">
                    {total > 0 ? formatUsd(total) : <span className="text-brand-muted">—</span>}
                  </td>
                  <td className="table-td text-brand-subtle">{b.positionCount}</td>
                  <td className="table-td hidden sm:table-cell">
                    <SizeBar longSize={b.longSize} shortSize={b.shortSize} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Show more */}
      {buckets.length > 12 && (
        <div className="px-4 py-3 border-t border-brand-border">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-brand-accent hover:text-brand-accent/80 transition-colors"
          >
            {showAll ? "Show less" : `Show all ${buckets.length} buckets`}
          </button>
        </div>
      )}
    </Card>
  );
}
