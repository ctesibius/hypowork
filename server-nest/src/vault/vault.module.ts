import { Module } from "@nestjs/common";
import { MemoryModule } from "../memory/memory.module.js";
import { MemoryService } from "../memory/memory.service.js";
import { VaultService } from "./vault.service.js";
import { VaultController } from "./vault.controller.js";

@Module({
  imports: [MemoryModule],
  controllers: [VaultController],
  providers: [
    {
      provide: VaultService,
      useFactory: (memory: MemoryService) => new VaultService(memory),
      inject: [MemoryService],
    },
  ],
  exports: [VaultService],
})
export class VaultModule {}
