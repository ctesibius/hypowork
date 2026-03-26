import { Module } from "@nestjs/common";
import { CompaniesModule } from "../companies/companies.module.js";
import { SkillsModule } from "../skills/skills.module.js";
import { WorkspacesController } from "./workspaces.controller.js";

@Module({
  imports: [CompaniesModule, SkillsModule],
  controllers: [WorkspacesController],
})
export class WorkspacesModule {}
