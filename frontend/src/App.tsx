import { MarketProvider } from "./state/marketState";
import { AppShell } from "./components/Layout/AppShell";
import { MarketSelector } from "./components/Markets/MarketSelector";
import { MarketSummary } from "./components/Markets/MarketSummary";
import { LiquidationHistogram } from "./components/Radar/LiquidationHistogram";
import { BucketTable } from "./components/Radar/BucketTable";
import { WhalesAtRiskTable } from "./components/Radar/WhalesAtRiskTable";

function Dashboard() {
  return (
    <div className="flex flex-col gap-5">
      {/* Page title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-brand-text tracking-tight">
          Liquidation Radar
        </h1>
        <p className="text-sm text-brand-subtle mt-1">
          Cross-exchange perps liquidation heatmap — identify at-risk price zones in real-time.
        </p>
      </div>

      {/* Controls row */}
      <section aria-label="Market controls">
        <MarketSelector />
      </section>

      {/* Market summary */}
      <section aria-label="Market summary">
        <MarketSummary />
      </section>

      {/* Heatmap */}
      <section aria-label="Liquidation heatmap">
        <LiquidationHistogram />
      </section>

      {/* Whales at risk */}
      <section aria-label="Whales at risk">
        <WhalesAtRiskTable />
      </section>

      {/* Table */}
      <section aria-label="Bucket breakdown">
        <BucketTable />
      </section>

      {/* Info banner */}
      {/* <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-brand-accent/10 border border-brand-accent/20 text-xs text-brand-subtle">
        <svg className="w-4 h-4 text-brand-accent mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          <strong className="text-brand-text">Layer 0 Preview —</strong> Currently displaying simulated position data.
          Live data will be streamed from{" "}
          <a href="https://envio.dev" target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
            Envio HyperIndex
          </a>{" "}
          in subsequent layers. Hyperliquid integration coming soon.
        </span>
      </div> */}
    </div>
  );
}

function App() {
  return (
    <MarketProvider>
      <AppShell>
        <Dashboard />
      </AppShell>
    </MarketProvider>
  );
}

export default App;
