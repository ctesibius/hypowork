import { Module } from "@nestjs/common";
import { InstanceSettingsController } from "./instance-settings.controller.js";

@Module({
  controllers: [InstanceSettingsController],
})
export class InstanceSettingsModule {}
