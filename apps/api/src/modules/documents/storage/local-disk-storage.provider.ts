import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { Injectable } from "@nestjs/common";

import type { StorageProvider } from "./storage-provider.interface";

// Étape 7 — DÉCISION PRODUIT EXPLICITE : pas de stockage cloud branché pour cette phase (aucune
// clé d'accès S3/R2 dans le projet). Écrit sur le disque local du process API, dans un répertoire
// EN DEHORS de tout dossier servi statiquement (jamais accessible par une URL directe — le seul
// chemin d'accès à un fichier passe par DocumentsController, avec ses propres contrôles
// d'autorisation). Le système de fichiers de Render est éphémère : tout fichier uploadé est
// PERDU au prochain redéploiement/redémarrage. Non fonctionnel en production telle quelle — à
// remplacer par un provider S3-compatible (implémentant la même StorageProvider) avant la mise en
// production réelle. Utilisable en développement local sans dépendance externe entre-temps.
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly rootDir = join(process.cwd(), "uploads-data");

  async save(key: string, buffer: Buffer): Promise<void> {
    const fullPath = this.resolve(key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  // `key` est toujours généré côté serveur (randomUUID, voir DocumentsService) — jamais dérivé
  // d'une entrée utilisateur — donc pas de risque de traversée de répertoire ("../..") en pratique.
  // `join` normalise quand même le chemin par défense en profondeur.
  private resolve(key: string): string {
    return join(this.rootDir, key);
  }
}
