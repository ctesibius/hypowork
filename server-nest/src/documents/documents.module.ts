import { Module } from "@nestjs/common";
import { DB } from "../db/db.module.js";
import { DocumentsController } from "./documents.controller.js";

@Module({
  controllers: [DocumentsController],
  providers: [],
  imports: [],
})
export class DocumentsModule {}
