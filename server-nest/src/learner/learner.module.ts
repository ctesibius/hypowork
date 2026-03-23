import { Module } from "@nestjs/common";
import { LearnerService } from "./learner.service.js";
import { LearnerController } from "./learner.controller.js";
import { MemoryModule } from "../memory/memory.module.js";
import { VaultModule } from "../vault/vault.module.js";
import { PromptLearningModule } from "../prompt-learning/prompt-learning.module.js";

@Module({
  imports: [MemoryModule, VaultModule, PromptLearningModule],
  controllers: [LearnerController],
  providers: [LearnerService],
  exports: [LearnerService],
})
export class LearnerModule {}
