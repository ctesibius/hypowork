import { Module } from "@nestjs/common";
import { LlmsController, LlmsService } from "./llms.controller.js";

@Module({
  controllers: [LlmsController],
  providers: [LlmsService],
})
export class LlmsModule {}
