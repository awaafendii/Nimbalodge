// Étape 7 — abstraction volontaire : DocumentsService ne connaît que cette interface, jamais
// `fs`/un SDK cloud directement. Le seul provider aujourd'hui est LocalDiskStorageProvider (décision
// produit explicite : pas de stockage cloud branché, système de fichiers de Render éphémère —
// documenté comme non fonctionnel en production, à remplacer par un provider S3-compatible avant
// le lancement réel). Un futur provider S3/R2 implémente cette même interface, aucun changement
// dans DocumentsService.
export interface StorageProvider {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
