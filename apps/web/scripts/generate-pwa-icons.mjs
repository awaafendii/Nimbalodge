// Rastérise public/pwa/icon-source.svg en PNG pour le manifest PWA — aucun éditeur d'image
// disponible dans cet environnement, donc icône source dessinée à la main (SVG, réutilise le
// tracé exact d'IconMark) puis convertie ici via sharp (devDependency, outillage de build
// uniquement, jamais expédié en production). Reproductible : `npm run generate:pwa-icons`.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const sourceSvg = await readFile(join(publicDir, "pwa", "icon-source.svg"));

const targets = [
  { file: "pwa-192.png", size: 192 },
  { file: "pwa-512.png", size: 512 },
  // Même source que pwa-512.png : le fond plein-bord (#102019) et le glyphe déjà centré dans la
  // zone sûre (~60% du canevas, voir icon-source.svg) rendent la source directement valide comme
  // icône "maskable" sans transformation supplémentaire.
  { file: "maskable-512.png", size: 512 },
  // apple-touch-icon : iOS ignore la transparence et attend un fond opaque — déjà le cas ici
  // (rect de fond plein-bord dans la source), donc pas de traitement différent, juste une taille
  // dédiée.
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  await sharp(sourceSvg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, file));
  console.log(`✓ ${file} (${size}x${size})`);
}
