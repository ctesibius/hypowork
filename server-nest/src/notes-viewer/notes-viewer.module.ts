import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { LearnerModule } from "../learner/learner.module.js";
import { LearnerService } from "../learner/learner.service.js";
import { MemoryModule } from "../memory/memory.module.js";
import { MemoryService } from "../memory/memory.service.js";
import { VaultModule } from "../vault/vault.module.js";
import { VaultService } from "../vault/vault.service.js";
import { NotesViewerService } from "./notes-viewer.service.js";
import { NotesViewerController } from "./notes-viewer.controller.js";

@Module({
  imports: [MemoryModule, VaultModule, LearnerModule, DbModule],
  controllers: [NotesViewerController],
  providers: [NotesViewerService],
  exports: [NotesViewerService],
})
export class NotesViewerModule {}
