import { Module } from "@nestjs/common";
import { AccessController } from "./access.controller.js";

@Module({
  controllers: [AccessController],
})
export class AccessModule {}
