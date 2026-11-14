import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontWeight: { black: "800" },
      boxShadow: { card: "var(--shadow-card)", lift: "var(--shadow-lift)" },
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        lime: "var(--lime)",
        muted: "var(--muted)",
        line: "var(--line)",
        panel: "var(--panel)",
        soft: "var(--soft)",
        brand: "var(--lime)",
        "brand-fg": "#14201d",
        "lime-deep": "var(--lime-deep)",
        good: "var(--good)",
        warn: "var(--warn-fg)",
        danger: "var(--red)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
