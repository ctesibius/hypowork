import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { RequestHandler } from "express";
import type { Request } from "express";
import type { Db } from "@paperclipai/db";
import type { BetterAuthSessionResult } from "@paperclipai/server/auth/better-auth";
import { DB } from "../db/db.module.js";
import { ConfigService } from "../config/config.service.js";

@Injectable()
export class AuthBridgeService implements OnModuleInit {
  private readonly log = new Logger(AuthBridgeService.name);

  betterAuthHandler: RequestHandler | null = null;
  resolveSession: ((req: Request) => Promise<BetterAuthSessionResult | null>) | undefined;
  resolveSessionFromHeaders:
    | ((headers: Headers) => Promise<BetterAuthSessionResult | null>)
    | undefined;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.config.deploymentMode !== "authenticated") return;

    const betterAuthSecret =
      process.env.BETTER_AUTH_SECRET?.trim() ?? process.env.PAPERCLIP_AGENT_JWT_SECRET?.trim();
    if (!betterAuthSecret) {
      throw new Error(
        "authenticated mode requires BETTER_AUTH_SECRET (or PAPERCLIP_AGENT_JWT_SECRET) to be set",
      );
    }

    const {
      createBetterAuthHandler,
      createBetterAuthInstance,
      deriveAuthTrustedOrigins,
      resolveBetterAuthSession,
      resolveBetterAuthSessionFromHeaders,
    } = await import("@paperclipai/server/auth/better-auth");
    const { initializeBoardClaimChallenge } = await import("@paperclipai/server/board-claim");

    const cfg = this.config.loaded;
    const derivedTrustedOrigins = deriveAuthTrustedOrigins(cfg);
    const envTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const effectiveTrustedOrigins = Array.from(new Set([...derivedTrustedOrigins, ...envTrustedOrigins]));

    this.log.log(
      `Better Auth enabled (trustedOrigins=${effectiveTrustedOrigins.length}, baseUrlMode=${cfg.authBaseUrlMode})`,
    );

    const auth = createBetterAuthInstance(this.db, cfg, effectiveTrustedOrigins);
    this.betterAuthHandler = createBetterAuthHandler(auth);
    this.resolveSession = (req) => resolveBetterAuthSession(auth, req);
    this.resolveSessionFromHeaders = (headers) => resolveBetterAuthSessionFromHeaders(auth, headers);

    await initializeBoardClaimChallenge(this.db, { deploymentMode: cfg.deploymentMode });
  }
}
