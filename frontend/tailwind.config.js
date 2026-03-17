/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#050816",
          surface: "#0d1224",
          card: "#111827",
          border: "#1e293b",
          muted: "#334155",
          text: "#e2e8f0",
          subtle: "#94a3b8",
          long: "#14b8a6",   // teal
          "long-dim": "#0f766e",
          short: "#f43f5e",  // rose
          "short-dim": "#be123c",
          accent: "#6366f1", // indigo
          warning: "#f59e0b",
          success: "#10b981",
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.5), 0 0 0 1px rgb(30 41 59 / 0.8)",
        glow: "0 0 20px -4px rgb(99 102 241 / 0.3)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
