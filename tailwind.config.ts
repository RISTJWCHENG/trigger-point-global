import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        card: "var(--card)",
        warm: "var(--warm)",
        pill: "var(--pill)",
        line: "var(--line)",
        ink: "var(--ink)",
        secondary: "var(--secondary)",
        muted: "var(--muted)",
        yes: "var(--yes)",
        yesTint: "var(--yes-tint)",
        no: "var(--no)",
        noTint: "var(--no-tint)",
        action: "var(--action)",
        actionDeep: "var(--action-deep)",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 30, 33, 0.04)",
        sheet: "0 -8px 30px rgba(28, 30, 33, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
