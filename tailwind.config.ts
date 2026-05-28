import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
      },
      colors: {
        accent: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        ink: {
          50:  "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        },
      },
      boxShadow: {
        soft:  "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)",
        card:  "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)",
        lift:  "0 10px 30px -10px rgba(15, 23, 42, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.08)",
        glow:  "0 0 0 1px rgba(139,92,246,0.25), 0 8px 32px -8px rgba(139,92,246,0.35)",
      },
      backgroundImage: {
        "grid":   "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)",
        "hero":   "radial-gradient(60% 80% at 50% 0%, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0) 70%), radial-gradient(40% 60% at 100% 100%, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0) 70%)",
        "violet-sheen": "linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #2563eb 100%)",
      },
      keyframes: {
        "fade-in":   { "0%": { opacity: "0", transform: "translateY(4px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "scale-in":  { "0%": { opacity: "0", transform: "scale(0.98)" },     "100%": { opacity: "1", transform: "scale(1)" } },
        "shimmer":   { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "fade-in":  "fade-in .25s ease-out both",
        "scale-in": "scale-in .2s ease-out both",
        "shimmer":  "shimmer 1.6s linear infinite",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
export default config;
