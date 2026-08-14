import type { Config } from "tailwindcss";
import uiPreset from "@nimbalodge/ui/tailwind.config.js";

export default {
  presets: [uiPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;
