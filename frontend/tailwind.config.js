/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ─── Primary Gold / Amber System (Happy Car Wash Logo Theme) ───
        "primary": "#D97706",
        "primary-light": "#F59E0B",
        "primary-dark": "#B45309",
        "primary-50": "#FFFBEB",
        "primary-100": "#FEF3C7",
        "primary-200": "#FDE68A",
        "primary-300": "#FCD34D",
        "primary-400": "#FBBF24",
        "primary-500": "#F59E0B",
        "primary-600": "#D97706",
        "primary-700": "#B45309",
        "primary-800": "#92400E",
        "primary-900": "#78350F",
        "on-primary": "#ffffff",

        // ─── Accent Gold System ───
        "accent": "#F59E0B",
        "accent-light": "#FBBF24",
        "accent-dark": "#D97706",

        // ─── Surface / Background ───
        "background": "var(--bg-background)",
        "surface": "var(--bg-surface)",
        "surface-card": "var(--bg-surface-card)",
        "surface-hover": "var(--bg-surface-hover)",
        "surface-muted": "var(--bg-surface-muted)",
        "surface-elevated": "var(--bg-surface-elevated)",

        // ─── Text Colors ───
        "on-surface": "var(--text-on-surface)",
        "on-surface-variant": "var(--text-on-surface-variant)",
        "on-surface-muted": "var(--text-on-surface-muted)",

        // ─── Status Colors ───
        "status-rfe": "#F59E0B",
        "status-estimation": "#8B5CF6",
        "status-spares": "#EA580C",
        "status-wip": "#D97706",
        "status-ready": "#10B981",
        "status-delivered": "#059669",
        "status-invoiced": "#7C3AED",

        // ─── Semantic Colors ───
        "success": "#10B981",
        "success-light": "#D1FAE5",
        "warning": "#F59E0B",
        "warning-light": "#FEF3C7",
        "error": "#EF4444",
        "error-light": "#FEE2E2",
        "info": "#D97706",
        "info-light": "#FEF3C7",

        // ─── Card Gradient Stops ───
        "grad-blue-from": "#B45309",
        "grad-blue-to": "#F59E0B",
        "grad-cyan-from": "#D97706",
        "grad-cyan-to": "#FBBF24",
        "grad-purple-from": "#7C3AED",
        "grad-purple-to": "#A78BFA",
        "grad-green-from": "#059669",
        "grad-green-to": "#34D399",
        "grad-orange-from": "#EA580C",
        "grad-orange-to": "#FB923C",

        // ─── Dark Mode Overrides ───
        "dark-bg": "#0C0A09",
        "dark-surface": "#1C1917",
        "dark-card": "#292524",
        "dark-border": "#44403C",
        "dark-text": "#F5F5F4",
        "dark-muted": "#A8A29E",
        "neon-blue": "#FBBF24",
      },
      fontFamily: {
        "headline": ["Manrope", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"],
        "mono": ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "sm": "0.375rem",
        "DEFAULT": "0.5rem",
        "md": "0.625rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "glass": "0 8px 32px rgba(217, 119, 6, 0.08)",
        "card": "0 4px 16px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)",
        "card-hover": "0 12px 40px rgba(217, 119, 6, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04)",
        "metric": "0 8px 24px rgba(217, 119, 6, 0.15)",
        "sidebar": "4px 0 24px rgba(0, 0, 0, 0.06)",
        "modal": "0 24px 48px rgba(0, 0, 0, 0.12)",
        "button": "0 4px 14px rgba(217, 119, 6, 0.25)",
        "button-hover": "0 6px 20px rgba(217, 119, 6, 0.35)",
        "inner-glow": "inset 0 1px 0 rgba(255, 255, 255, 0.1)",
      },
      backdropBlur: {
        "glass": "16px",
        "heavy": "24px",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
