import { Module } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import { DB, DbModule } from "../db/db.module.js";
import { PromptLearningController } from "./prompt-learning.controller.js";
import { PromptLearningService } from "./prompt-learning.service.js";

@Module({
  imports: [DbModule],
  controllers: [PromptLearningController],
  providers: [
    {
      provide: PromptLearningService,
      useFactory: (db: Db) => new PromptLearningService(db),
      inject: [DB],
    },
  ],
  exports: [PromptLearningService],
})
export class PromptLearningModule {}
