import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card-solid)",
          hover: "var(--card-hover)",
        },
        border: "var(--border)",
        "border-bright": "var(--border-bright)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          glow: "var(--accent-glow)",
        },
        destructive: "var(--destructive)",
        muted: "var(--muted)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "progress-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "toast-out": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(100%)" },
        },
        "overlay-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 12px var(--accent-glow)" },
          "50%": { boxShadow: "0 0 24px var(--accent-glow), 0 0 48px rgba(16, 185, 129, 0.05)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-out-right": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out forwards",
        "fade-in-scale": "fade-in-scale 0.2s ease-out forwards",
        "slide-up": "slide-up 0.4s ease-out forwards",
        shimmer: "shimmer 1.5s infinite linear",
        "progress-pulse": "progress-pulse 2s ease-in-out infinite",
        "toast-in": "toast-in 0.3s ease-out forwards",
        "toast-out": "toast-out 0.2s ease-in forwards",
        "overlay-in": "overlay-in 0.15s ease-out forwards",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        "slide-out-right": "slide-out-right 0.2s ease-in forwards",
      },
      boxShadow: {
        glow: "0 0 12px var(--accent-glow)",
        "glow-lg": "0 0 24px var(--accent-glow), 0 0 48px rgba(16, 185, 129, 0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
