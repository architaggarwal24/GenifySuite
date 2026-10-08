import type { Config } from "tailwindcss";

// Tailwind's documented pattern for CSS-variable-backed colors that still
// support opacity modifiers (bg-brass/10, etc.): <alpha-value> is replaced
// by Tailwind at build time with the requested opacity. Using a plain
// string (rather than a function) keeps this fully type-safe against
// Tailwind's own Config type.
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
      },
      fontFamily: {
        display: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "4px",
        md: "6px",
      },
      backgroundImage: {
        blueprint:
          "linear-gradient(to right, rgb(var(--color-paper) / 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--color-paper) / 0.035) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "28px 28px",
      },
      keyframes: {
        "fade-slide-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-slide-up": "fade-slide-up 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
