import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { VaultModule } from "../vault/vault.module.js";
import { SkillsModule } from "../skills/skills.module.js";
import { EditorAiController } from "./editor-ai.controller.js";
import { EditorAiService } from "./editor-ai.service.js";

@Module({
  imports: [DbModule, MemoryModule, VaultModule, SkillsModule],
  controllers: [EditorAiController],
  providers: [EditorAiService],
  exports: [EditorAiService],
})
export class EditorAiModule {}
