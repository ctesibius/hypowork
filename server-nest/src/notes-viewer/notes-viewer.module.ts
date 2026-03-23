import { Module } from "@nestjs/common";
import { MemoryModule } from "../memory/memory.module.js";
import { MemoryService } from "../memory/memory.service.js";
import { VaultModule } from "../vault/vault.module.js";
import { VaultService } from "../vault/vault.service.js";
import { NotesViewerService } from "./notes-viewer.service.js";
import { NotesViewerController } from "./notes-viewer.controller.js";

@Module({
  imports: [MemoryModule, VaultModule],
  controllers: [NotesViewerController],
  providers: [
    {
      provide: NotesViewerService,
      useFactory: (memory: MemoryService, vault: VaultService) => new NotesViewerService(memory, vault),
      inject: [MemoryService, VaultService],
    },
  ],
  exports: [NotesViewerService],
})
export class NotesViewerModule {}
