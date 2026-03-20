import { Module } from "@nestjs/common";
import { IssuesController } from "./issues.controller.js";

@Module({
  controllers: [IssuesController],
  providers: [],
})
export class IssuesModule {}

