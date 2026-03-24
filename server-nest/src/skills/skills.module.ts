import { Module } from "@nestjs/common";
import { GlobalSkillService } from "./global-skills.service.js";
import { ActiveSkillService } from "./active-skills.service.js";
import { SkillsController } from "./skills.controller.js";
import { DbModule } from "../db/db.module.js";

@Module({
  imports: [DbModule],
  controllers: [SkillsController],
  providers: [GlobalSkillService, ActiveSkillService],
  exports: [GlobalSkillService, ActiveSkillService],
})
export class SkillsModule {}
