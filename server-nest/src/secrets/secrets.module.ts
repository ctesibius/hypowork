import { Module } from "@nestjs/common";
import { SecretsController } from "./secrets.controller.js";

@Module({
  controllers: [SecretsController],
})
export class SecretsModule {}
