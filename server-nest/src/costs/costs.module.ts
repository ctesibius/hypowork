import { Module } from "@nestjs/common";
import { CostsController } from "./costs.controller.js";

@Module({
  controllers: [CostsController],
})
export class CostsModule {}
