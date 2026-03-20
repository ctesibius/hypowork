import { Module } from "@nestjs/common";
import { SidebarBadgesController } from "./sidebar-badges.controller.js";

@Module({
  controllers: [SidebarBadgesController],
})
export class SidebarBadgesModule {}
