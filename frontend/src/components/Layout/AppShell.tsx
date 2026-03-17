import type { ReactNode } from "react";
import { TopNav } from "../Header/TopNav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
      <footer className="border-t border-brand-border bg-brand-surface/40 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-brand-muted">
          <span>
            Liquidation Radar — powered by{" "}
            <a
              href="https://envio.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-accent hover:underline"
            >
              Envio HyperIndex
            </a>
          </span>
         
        </div>
      </footer>
    </div>
  );
}
