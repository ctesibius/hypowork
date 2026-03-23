import { Module } from "@nestjs/common";
import { PromptLearningService } from "./prompt-learning.service.js";

@Module({
  providers: [PromptLearningService],
  exports: [PromptLearningService],
})
export class PromptLearningModule {}
