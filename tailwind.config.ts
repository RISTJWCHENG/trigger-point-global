import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F8F7F4",
        card: "#FFFFFF",
        warm: "#FDFCFA",
        pill: "#F1EFEA",
        line: "#E6E3DC",
        ink: "#1C1E21",
        secondary: "#5B616A",
        muted: "#8A8F98",
        yes: "#4E7A65",
        yesTint: "#EDF3F0",
        no: "#A65E5E",
        noTint: "#F7EFEF",
        action: "#3D4F63",
        actionDeep: "#2A333D",
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
