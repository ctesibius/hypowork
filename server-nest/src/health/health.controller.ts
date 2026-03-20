import { Controller, Get, Inject } from "@nestjs/common";
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { instanceUserRoles, invites } from "@paperclipai/db";
import { ConfigService } from "../config/config.service.js";
import { DB } from "../db/db.module.js";

const SERVER_VERSION = "0.1.0";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Get()
  async get() {

    let bootstrapStatus: "ready" | "bootstrap_pending" = "ready";
    let bootstrapInviteActive = false;
    if (this.config.deploymentMode === "authenticated") {
      const roleCount = await this.db
        .select({ count: count() })
        .from(instanceUserRoles)
        .where(sql`${instanceUserRoles.role} = 'instance_admin'`)
        .then((rows) => Number(rows[0]?.count ?? 0));
      bootstrapStatus = roleCount > 0 ? "ready" : "bootstrap_pending";
      if (bootstrapStatus === "bootstrap_pending") {
        const now = new Date();
        const inviteCount = await this.db
          .select({ count: count() })
          .from(invites)
          .where(
            and(
              eq(invites.inviteType, "bootstrap_ceo"),
              isNull(invites.revokedAt),
              isNull(invites.acceptedAt),
              gt(invites.expiresAt, now),
            ),
          )
          .then((rows) => Number(rows[0]?.count ?? 0));
        bootstrapInviteActive = inviteCount > 0;
      }
    }
    return {
      status: "ok",
      version: SERVER_VERSION,
      deploymentMode: this.config.deploymentMode,
      deploymentExposure: this.config.deploymentExposure,
      // After Nest listen(), auth stack is initialized (local_trusted or Better Auth).
      authReady: true,
      bootstrapStatus,
      bootstrapInviteActive,
      features: { companyDeletionEnabled: this.config.companyDeletionEnabled },
    };
  }
}
