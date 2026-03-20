import { Controller, Get, Patch, Inject, Req, Res } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import type { Db } from "@paperclipai/db";
import { instanceSettingsService as expressInstanceSettingsService } from "@paperclipai/server/services/instance-settings";
import { DB } from "../db/db.module.js";

function assertCanManageInstanceSettings(actor: Actor) {
  if (actor.type !== "board") {
    throw new ForbiddenException("Board access required");
  }
  if (actor.source === "local_implicit" || actor.isInstanceAdmin) {
    return;
  }
  throw new ForbiddenException("Instance admin access required");
}

@Controller()
export class InstanceSettingsController {
  private readonly svc;

  constructor(@Inject(DB) db: Db) {
    this.svc = expressInstanceSettingsService(db);
  }

  @Get("instance/settings/experimental")
  async getExperimental(
    @Req() req: Request & { actor?: Actor },
  ) {
    assertCanManageInstanceSettings(req.actor!);
    return this.svc.getExperimental();
  }

  @Patch("instance/settings/experimental")
  async patchExperimental(
    @Req() req: Request & { actor?: Actor },
    @Res() res: Response,
  ) {
    assertCanManageInstanceSettings(req.actor!);
    const updated = await this.svc.updateExperimental(req.body);
    // TODO: logActivity requires additional export
    return res.json(updated.experimental);
  }
}
