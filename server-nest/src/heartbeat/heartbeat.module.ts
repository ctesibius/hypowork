import { Module } from "@nestjs/common";
import { HeartbeatBootstrapService } from "./heartbeat.service.js";

@Module({
  providers: [HeartbeatBootstrapService],
})
export class HeartbeatModule {}
