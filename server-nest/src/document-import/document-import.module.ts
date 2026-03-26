import { Module } from "@nestjs/common";
import { DocumentImportController } from "./document-import.controller.js";

@Module({
  controllers: [DocumentImportController],
})
export class DocumentImportModule {}
