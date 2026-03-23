import { Module } from "@nestjs/common";
import { ConfigService } from "../config/config.service.js";
import { MemoryService } from "./memory.service.js";
import { MemoryController } from "./memory.controller.js";

@Module({
  controllers: [MemoryController],
  providers: [
    {
      provide: MemoryService,
      useFactory: (config: ConfigService) => new MemoryService(config),
      inject: [ConfigService],
    },
  ],
  exports: [MemoryService],
})
export class MemoryModule {}
