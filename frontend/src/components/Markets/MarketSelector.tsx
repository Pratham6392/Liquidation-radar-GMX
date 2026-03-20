import type { BucketSize, Protocol } from "../../types";
import { useMarketState } from "../../state/marketState";

const PROTOCOLS: { id: Protocol; label: string; available: boolean }[] = [
  { id: "GMX", label: "GMX", available: true },
  { id: "Hyperliquid", label: "Hyperliquid", available: false },
];

const BUCKET_SIZES: { value: BucketSize; label: string }[] = [
  { value: 0.5, label: "0.5%" },
  { value: 1, label: "1%" },
  { value: 2, label: "2%" },
];

function shortenAddress(address: string): string {
  if (address.startsWith("0x") && address.length === 42) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
  return address;
}

export function MarketSelector() {
  const {
    markets,
    selectedMarketId,
    setSelectedMarketId,
    selectedProtocol,
    setSelectedProtocol,
    bucketSize,
    setBucketSize,
  } = useMarketState();

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      {/* Market dropdown */}
      <div className="flex-1 min-w-[180px]">
        <label className="stat-label block mb-1.5">Market</label>
        <div className="relative group">
          <select
            value={selectedMarketId}
            onChange={(e) => setSelectedMarketId(e.target.value)}
            className="
              w-full appearance-none bg-brand-card/90 border border-brand-border
              text-brand-text text-sm font-medium rounded-xl px-4 py-2.5 pr-9
              cursor-pointer outline-none
              shadow-sm
              hover:border-brand-muted hover:bg-brand-card
              focus:border-brand-accent/70 focus:ring-2 focus:ring-brand-accent/25
              group-hover:border-brand-muted/80
              transition-all duration-200 ease-out
            "
          >
            {markets.map((m) => (
              <option key={m.id} value={m.id} className="bg-brand-card">
                {m.label.length > 20 ? shortenAddress(m.id) : m.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-subtle"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Protocol chips */}
      <div className="flex-shrink-0">
        <label className="stat-label block mb-1.5">Protocol</label>
        <div className="flex gap-1.5">
          {PROTOCOLS.map((p) => (
            <button
              key={p.id}
              disabled={!p.available}
              onClick={() => p.available && setSelectedProtocol(p.id)}
              className={`btn-chip ${
                !p.available
                  ? "btn-chip-disabled"
                  : selectedProtocol === p.id
                  ? "btn-chip-active"
                  : "btn-chip-inactive"
              }`}
            >
              {p.label}
              {!p.available && (
                <span className="text-brand-muted ml-0.5">Soon</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bucket size segmented control */}
      <div className="flex-shrink-0">
        <label className="stat-label block mb-1.5">Bucket Size</label>
        <div className="flex gap-1 bg-brand-surface border border-brand-border rounded-xl p-1">
          {BUCKET_SIZES.map((s) => (
            <button
              key={s.value}
              onClick={() => setBucketSize(s.value)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                ${bucketSize === s.value
                  ? "bg-brand-card text-brand-text shadow-sm border border-brand-border"
                  : "text-brand-subtle hover:text-brand-text"
                }
              `}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
