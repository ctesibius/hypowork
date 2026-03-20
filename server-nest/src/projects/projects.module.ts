import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller.js";

@Module({
  controllers: [ProjectsController],
  providers: [],
})
export class ProjectsModule {}

