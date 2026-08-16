import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-raised": "hsl(var(--surface-raised) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        ink: "hsl(var(--ink) / <alpha-value>)",
        "ink-muted": "hsl(var(--ink-muted) / <alpha-value>)",
        healthy: "hsl(var(--healthy) / <alpha-value>)",
        telemetry: "hsl(var(--telemetry) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        critical: "hsl(var(--critical) / <alpha-value>)",
        statistical: "hsl(var(--statistical) / <alpha-value>)",
        offline: "hsl(var(--offline) / <alpha-value>)",
      },
      boxShadow: {
        panel: "0 1px 0 0 hsl(var(--border) / 1) inset, 0 8px 24px -12px rgb(0 0 0 / 0.5)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        pulseDot: "pulseDot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
