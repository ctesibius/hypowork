import { Module } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import { DB, DbModule } from "../db/db.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { MemoryService } from "../memory/memory.service.js";
import { VaultModule } from "../vault/vault.module.js";
import { VaultService } from "../vault/vault.service.js";
import { SkillsModule } from "../skills/skills.module.js";
import { ActiveSkillService } from "../skills/active-skills.service.js";
import { ChatService } from "./chat.service.js";
import { ChatController } from "./chat.controller.js";

@Module({
  imports: [MemoryModule, VaultModule, DbModule, SkillsModule],
  controllers: [ChatController],
  providers: [
    {
      provide: ChatService,
      useFactory: (memory: MemoryService, vault: VaultService, db: Db, activeSkills: ActiveSkillService) =>
        new ChatService(memory, vault, db, activeSkills),
      inject: [MemoryService, VaultService, DB, ActiveSkillService],
    },
  ],
  exports: [ChatService],
})
export class ChatModule {}
