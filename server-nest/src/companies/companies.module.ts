import { Module } from "@nestjs/common";
import { CompaniesController } from "./companies.controller.js";
import { CompaniesService } from "./companies.service.js";
import { SkillsModule } from "../skills/skills.module.js";

@Module({
  imports: [SkillsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}

