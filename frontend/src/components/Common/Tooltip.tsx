import type { ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div
        className="
          pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
          opacity-0 group-hover:opacity-100 transition-opacity duration-150
          bg-brand-surface border border-brand-border rounded-lg shadow-card
          text-xs text-brand-text whitespace-nowrap px-3 py-2
        "
      >
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-brand-border" />
      </div>
    </div>
  );
}
