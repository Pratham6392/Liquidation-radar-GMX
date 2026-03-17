import { LiveDot } from "../Common/LiveDot";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-border bg-brand-bg/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-accent/20 border border-brand-accent/30 shrink-0">
            <svg
              className="w-4 h-4 text-brand-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-text leading-tight truncate">
              Liquidation Radar
            </p>
            <p className="text-xs text-brand-subtle leading-tight hidden sm:block">
              Cross-Exchange Perps Monitor
            </p>
          </div>
        </div>

        {/* Center — desktop tagline */}
        <p className="hidden md:block text-xs text-brand-muted font-mono tracking-wider uppercase">
          Powered by Envio HyperIndex
        </p>

        {/* Right */}
        <div className="flex items-center gap-3 shrink-0">
          <LiveDot />
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-border text-xs text-brand-subtle font-mono">
            <span className="text-brand-long font-medium">ARB</span>
            <span className="text-brand-border">·</span>
            <span>42161</span>
          </div>
        </div>
      </div>
    </header>
  );
}
