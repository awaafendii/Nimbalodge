import { Module } from "@nestjs/common";

import { PermissionsModule } from "../permissions/permissions.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { LocalDiskStorageProvider } from "./storage/local-disk-storage.provider";
import { STORAGE_PROVIDER } from "./storage/storage-provider.interface";

@Module({
  imports: [PermissionsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, { provide: STORAGE_PROVIDER, useClass: LocalDiskStorageProvider }],
})
export class DocumentsModule {}
