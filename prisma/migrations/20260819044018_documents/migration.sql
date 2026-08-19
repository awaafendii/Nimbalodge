-- Étape 7 — architecture d'upload sécurisée. Association polymorphe (resourceType/resourceId,
-- même pattern qu'AuditLog) plutôt qu'une FK par type de ressource.

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");
CREATE INDEX "Document_resourceType_resourceId_idx" ON "Document"("resourceType", "resourceId");
CREATE INDEX "Document_hotelId_idx" ON "Document"("hotelId");
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
