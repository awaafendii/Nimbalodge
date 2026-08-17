import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Port dédié (5174) pour pouvoir faire tourner apps/web en parallèle de docs/legacy/nimbalodge-app (5173)
// pendant toute la durée de la migration progressive.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' et jamais 'autoUpdate' : un rechargement silencieux en plein milieu d'une saisie
      // financière (facture, dépense...) serait une perte de données inacceptable pour un ERP réel.
      // L'utilisateur confirme via UpdatePrompt (apps/web/src/components/common/update-prompt.tsx,
      // Étape 6 incrément 2) avant que le nouveau service worker ne prenne le contrôle.
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "NimbaLodge",
        short_name: "NimbaLodge",
        description: "NimbaLodge — ERP hôtelier",
        lang: "fr",
        theme_color: "#102019",
        background_color: "#102019",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Précache le shell applicatif uniquement (JS/CSS hashés, polices, icônes, HTML) — jamais
        // les données métier, qui ne transitent jamais par dist/ de toute façon. Aucune entrée
        // runtimeCaching pour /api/v1/* : son absence fait que tout appel API traverse le service
        // worker sans interception, donc jamais mis en cache (voir docs/architecture, section
        // Étape 6 — plus sûr qu'un NetworkOnly explicite, rien à mal configurer plus tard).
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Désactivé par défaut en dev — un SW actif pendant `vite dev` complique le rechargement à
        // chaud et le débogage ; l'installabilité/le cache se vérifient sur un build de prod réel
        // (`npm run build:web && npm run preview -w @nimbalodge/web`), pas en dev.
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5174,
  },
  // Port dédié, distinct du défaut Vite (4173) : un ancien projet sans lien avec NimbaLodge
  // (découvert lors des tests PWA de l'Étape 6) avait déjà servi son propre service worker sur ce
  // port par défaut, qui interceptait ensuite silencieusement toute nouvelle preview lancée dessus
  // (le SW d'un ancien projet reste enregistré pour l'origine http://localhost:4173 dans Chrome,
  // indépendamment du process qui écoute réellement le port).
  preview: {
    port: 4174,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
