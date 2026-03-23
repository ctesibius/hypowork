import { Module } from "@nestjs/common";
import { DocumentModeService } from "./document-mode.service.js";
import { DocumentModeController } from "./document-mode.controller.js";

@Module({
  controllers: [DocumentModeController],
  providers: [DocumentModeService],
  exports: [DocumentModeService],
})
export class DocumentModeModule {}
