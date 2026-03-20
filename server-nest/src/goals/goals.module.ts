import { Module } from "@nestjs/common";
import { GoalsController } from "./goals.controller.js";

@Module({
  controllers: [GoalsController],
  providers: [],
})
export class GoalsModule {}

