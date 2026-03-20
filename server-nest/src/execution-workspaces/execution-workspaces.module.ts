import { Module } from "@nestjs/common";
import { ExecutionWorkspacesController } from "./execution-workspaces.controller.js";

@Module({
  controllers: [ExecutionWorkspacesController],
})
export class ExecutionWorkspacesModule {}
