import { Module } from "@nestjs/common";
import { ChatService } from "./chat.service.js";
import { ChatController } from "./chat.controller.js";
import { MemoryModule } from "../memory/memory.module.js";
import { VaultModule } from "../vault/vault.module.js";

@Module({
  imports: [MemoryModule, VaultModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
