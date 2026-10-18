import type { Config } from "tailwindcss";

// Tailwind's documented pattern for CSS-variable-backed colors that still
// support opacity modifiers (bg-brass/10, etc.): <alpha-value> is replaced
// by Tailwind at build time with the requested opacity.
//
// NOTE: the token names (ink / paper / brass / sage / rust) are kept from the
// original design system so every existing component keeps working. Their
// values are now the new palette: brass = violet accent, sage = emerald
// (success), rust = rose (danger). See globals.css.
function withOpacity(varName: string): string {
  return `rgb(var(${varName}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: withOpacity("--color-ink"),
          raised: withOpacity("--color-ink-raised"),
          line: withOpacity("--color-ink-line"),
        },
        paper: {
          DEFAULT: withOpacity("--color-paper"),
          dim: withOpacity("--color-paper-dim"),
          faint: withOpacity("--color-paper-faint"),
        },
        brass: {
          DEFAULT: withOpacity("--color-brass"),
          dim: withOpacity("--color-brass-dim"),
          soft: withOpacity("--color-brass-soft"),
        },
        sage: {
          DEFAULT: withOpacity("--color-sage"),
          dim: withOpacity("--color-sage-dim"),
          soft: withOpacity("--color-sage-soft"),
        },
        rust: {
          DEFAULT: withOpacity("--color-rust"),
          dim: withOpacity("--color-rust-dim"),
          soft: withOpacity("--color-rust-soft"),
        },
        cyan: {
          glow: withOpacity("--color-cyan"),
        },
      },
      fontFamily: {
        display: ['"Geist"', '"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Geist"', '"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', '"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        md: "12px",
        lg: "14px",
        xl: "18px",
        "2xl": "24px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--color-brass) / 0.25), 0 8px 40px -8px rgb(var(--color-brass) / 0.45)",
        "glow-sm": "0 0 24px -6px rgb(var(--color-brass) / 0.5)",
        card: "0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 12px 32px -16px rgb(0 0 0 / 0.5)",
      },
      keyframes: {
        "fade-slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        aurora: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(6%,-4%,0) scale(1.08)" },
          "66%": { transform: "translate3d(-5%,5%,0) scale(0.95)" },
        },
        "gradient-pan": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
      animation: {
        "fade-slide-up": "fade-slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        marquee: "marquee 40s linear infinite",
        shimmer: "shimmer 2.2s linear infinite",
        float: "float 6s ease-in-out infinite",
        aurora: "aurora 22s ease-in-out infinite",
        "gradient-pan": "gradient-pan 6s linear infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
