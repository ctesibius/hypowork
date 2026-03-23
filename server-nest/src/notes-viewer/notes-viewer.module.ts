import { Module } from "@nestjs/common";
import { NotesViewerService } from "./notes-viewer.service.js";
import { NotesViewerController } from "./notes-viewer.controller.js";
import { MemoryModule } from "../memory/memory.module.js";
import { VaultModule } from "../vault/vault.module.js";

@Module({
  imports: [MemoryModule, VaultModule],
  controllers: [NotesViewerController],
  providers: [NotesViewerService],
  exports: [NotesViewerService],
})
export class NotesViewerModule {}
