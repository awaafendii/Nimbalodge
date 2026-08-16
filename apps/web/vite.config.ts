import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port dédié (5174) pour pouvoir faire tourner apps/web en parallèle de docs/legacy/nimbalodge-app (5173)
// pendant toute la durée de la migration progressive.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
