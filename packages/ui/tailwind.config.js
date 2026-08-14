// Preset partagé — plain JS (pas .ts) délibérément : ce fichier est chargé par le loader de
// config de Tailwind (jiti/lilconfig), pas par le graphe de modules Vite/TS. Un import cross-
// package d'un .ts via subpath (`@nimbalodge/ui/tailwind.config.ts`) dépend de la résolution
// d'extension du loader ; du JS évite complètement cette ambiguïté. Consommé par
// apps/web/tailwind.config.ts via `presets: [...]`. N'inclut pas `content` : chaque app déclare
// ses propres chemins à scanner.
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Vocabulaire sémantique shadcn/ui (voir src/styles/shadcn-bridge.css)
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        accent: { DEFAULT: "var(--accent-soft)", foreground: "var(--accent-foreground)" },
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        // Tokens de marque bruts — utilisables directement (ex. bg-brand-gold-soft, text-brand-ink-muted)
        brand: {
          bg: "var(--bg)",
          surface: "var(--surface)",
          "surface-2": "var(--surface-2)",
          "surface-3": "var(--surface-3)",
          "border-soft": "var(--border-soft)",
          ink: "var(--ink)",
          "ink-2": "var(--ink-2)",
          "ink-muted": "var(--ink-muted)",
          accent: "var(--accent)",
          "accent-strong": "var(--accent-strong)",
          "accent-soft": "var(--accent-soft)",
          "accent-ink": "var(--accent-ink)",
          gold: "var(--gold)",
          "gold-soft": "var(--gold-soft)",
        },
        good: { DEFAULT: "var(--good)", soft: "var(--good-soft)" },
        warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
        critical: { DEFAULT: "var(--critical)", soft: "var(--critical-soft)" },

        sidebar: {
          bg: "var(--sidebar-bg)",
          "bg-2": "var(--sidebar-bg-2)",
          ink: "var(--sidebar-ink)",
          "ink-muted": "var(--sidebar-ink-muted)",
          border: "var(--sidebar-border)",
          active: "var(--sidebar-active)",
        },

        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
          6: "var(--chart-6)",
        },
      },
      fontFamily: {
        title: ["var(--font-title)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius-m)",
        sm: "var(--radius-s)",
        xl: "var(--radius-l)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [animate],
};

export default preset;
