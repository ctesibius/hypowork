import { Module } from "@nestjs/common";
import { MemoryModule } from "../memory/memory.module.js";
import { MemoryService } from "../memory/memory.service.js";
import { PromptLearningModule } from "../prompt-learning/prompt-learning.module.js";
import { PromptLearningService } from "../prompt-learning/prompt-learning.service.js";
import { VaultModule } from "../vault/vault.module.js";
import { VaultService } from "../vault/vault.service.js";
import { LearnerService } from "./learner.service.js";
import { LearnerController } from "./learner.controller.js";

@Module({
  imports: [MemoryModule, VaultModule, PromptLearningModule],
  controllers: [LearnerController],
  providers: [
    {
      provide: LearnerService,
      useFactory: (memory: MemoryService, vault: VaultService, promptLearning: PromptLearningService) =>
        new LearnerService(memory, vault, promptLearning),
      inject: [MemoryService, VaultService, PromptLearningService],
    },
  ],
  exports: [LearnerService],
})
export class LearnerModule {}
