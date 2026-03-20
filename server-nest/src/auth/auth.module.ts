import { Module } from "@nestjs/common";
import { ActorGuard } from "./actor.guard.js";
import { ActorMiddleware } from "./actor.middleware.js";
import { AuthBridgeService } from "./auth-bridge.service.js";
import { BetterAuthMiddleware } from "./better-auth.middleware.js";
import { BoardMutationMiddleware } from "./board-mutation.middleware.js";
import { NestAuthCompatController } from "./nest-auth-compat.controller.js";

@Module({
  providers: [ActorGuard, AuthBridgeService, ActorMiddleware, BetterAuthMiddleware, BoardMutationMiddleware],
  exports: [ActorGuard, AuthBridgeService, ActorMiddleware, BetterAuthMiddleware, BoardMutationMiddleware],
  controllers: [NestAuthCompatController],
})
export class AuthModule {}
