import { Module } from "@nestjs/common";
import { VaultService } from "./vault.service.js";
import { VaultController } from "./vault.controller.js";

@Module({
  controllers: [VaultController],
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}
