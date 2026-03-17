import type { ReactNode } from "react";
import type { MarginHealth, Protocol } from "../../types";

interface TagProps {
  children: ReactNode;
  variant?: "default" | "long" | "short" | "neutral" | "accent" | "warning" | "success";
  size?: "xs" | "sm";
  className?: string;
}

const variantMap: Record<NonNullable<TagProps["variant"]>, string> = {
  default: "bg-brand-surface text-brand-subtle border border-brand-border",
  long: "bg-brand-long/15 text-brand-long border border-brand-long/30",
  short: "bg-brand-short/15 text-brand-short border border-brand-short/30",
  neutral: "bg-brand-surface text-brand-text border border-brand-border",
  accent: "bg-brand-accent/15 text-brand-accent border border-brand-accent/30",
  warning: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

const sizeMap = {
  xs: "px-1.5 py-0.5 text-xs",
  sm: "px-2.5 py-1 text-xs",
};

export function Tag({ children, variant = "default", size = "sm", className = "" }: TagProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-md ${variantMap[variant]} ${sizeMap[size]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ProtocolTag({ protocol }: { protocol: Protocol }) {
  return (
    <Tag variant={protocol === "GMX" ? "accent" : "success"}>
      {protocol}
    </Tag>
  );
}

export function DirectionTag({ isLong }: { isLong: boolean }) {
  return (
    <Tag variant={isLong ? "long" : "short"}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${isLong ? "bg-brand-long" : "bg-brand-short"}`}
      />
      {isLong ? "LONG" : "SHORT"}
    </Tag>
  );
}

export function HealthTag({ health }: { health: MarginHealth }) {
  const variantByHealth: Record<MarginHealth, TagProps["variant"]> = {
    HEALTHY: "success",
    MODERATE: "neutral",
    AT_RISK: "warning",
    CRITICAL: "short",
    LIQUIDATED: "short",
  };
  return <Tag variant={variantByHealth[health]}>{health}</Tag>;
}
