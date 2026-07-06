import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Near-black canvas + cool dark surfaces
        base: {
          DEFAULT: "#060608",
          900: "#0c0c10",
          800: "#111116",
          700: "#16161d",
          600: "#1d1d26",
        },
        // RSG ruby — deep, restrained crimson for a dark executive palette
        crimson: {
          DEFAULT: "#b3243a",
          light: "#d94b5e",
          dark: "#8a1a2c",
          deep: "#57101d",
          soft: "rgba(179,36,58,0.12)",
        },
        platinum: "#e8e6e3",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        label: "0.2em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(179,36,58,0.3), 0 12px 40px -10px rgba(179,36,58,0.35)",
        "glow-sm": "0 0 20px -8px rgba(179,36,58,0.4)",
        card: "0 20px 50px -24px rgba(0,0,0,0.8)",
        lift: "0 40px 90px -40px rgba(0,0,0,0.9)",
      },
      maxWidth: {
        content: "1240px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "marquee-reverse": {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
        marquee: "marquee 32s linear infinite",
        "marquee-reverse": "marquee-reverse 32s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
