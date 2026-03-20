import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Candle } from "../../types";

interface MarketMiniChartProps {
  candles: Candle[];
}

export function MarketMiniChart({ candles }: MarketMiniChartProps) {
  if (!candles.length) return null;

  const formatTooltipValue = (
    value: number | string | ReadonlyArray<number | string> | undefined,
  ) => {
    const rawValue = Array.isArray(value) ? value[0] : value;
    const numericValue =
      typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0);
    return [`$${numericValue.toFixed(6)}`, "Price"] as const;
  };

  const chartData = candles
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((c) => ({
      time: new Date(c.timestamp * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      price: c.close,
    }));

  return (
    <div className="w-full h-20 sm:h-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis dataKey="time" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgb(15 23 42)",
              borderColor: "rgb(30 41 59)",
              borderRadius: 8,
              padding: "6px 8px",
            }}
            labelStyle={{ fontSize: 10, color: "#e2e8f0" }}
            formatter={formatTooltipValue}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#6366f1"
            strokeWidth={1.4}
            fill="rgba(99,102,241,0.22)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

