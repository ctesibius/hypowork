import { Module } from "@nestjs/common";
import { CompanyDocumentPatchThrottleGuard } from "./company-document-patch-throttle.guard.js";
import { CompanyDocumentPatchThrottleService } from "./company-document-patch-throttle.service.js";
import { DocumentsController } from "./documents.controller.js";

@Module({
  controllers: [DocumentsController],
  providers: [CompanyDocumentPatchThrottleService, CompanyDocumentPatchThrottleGuard],
  imports: [],
})
export class DocumentsModule {}
