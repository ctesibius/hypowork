import { Module } from "@nestjs/common";
import { CanvasesController } from "./canvases.controller.js";

@Module({
  controllers: [CanvasesController],
  providers: [],
  imports: [],
})
export class CanvasesModule {}
