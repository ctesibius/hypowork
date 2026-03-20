import {
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { SecretProvider } from "@paperclipai/shared";
import { SECRET_PROVIDERS } from "@paperclipai/shared";
import type { Actor } from "../auth/actor.guard.js";
import { assertBoard, assertCompanyAccess } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { secretService as expressSecretService } from "@paperclipai/server/services/secrets";
import { DB } from "../db/db.module.js";

@Controller()
export class SecretsController {
  private readonly svc;
  private readonly defaultProvider: SecretProvider;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressSecretService(db);
    const configuredDefaultProvider = process.env.PAPERCLIP_SECRETS_PROVIDER;
    this.defaultProvider = (
      configuredDefaultProvider && SECRET_PROVIDERS.includes(configuredDefaultProvider as SecretProvider)
        ? configuredDefaultProvider
        : "local_encrypted"
    ) as SecretProvider;
  }

  @Get("companies/:companyId/secret-providers")
  async listProviders(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    return res.json(this.svc.listProviders());
  }

  @Get("companies/:companyId/secrets")
  async listSecrets(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const secrets = await this.svc.list(companyId);
    return res.json(secrets);
  }

  @Post("companies/:companyId/secrets")
  async createSecret(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    const body = req.body as {
      name: string;
      provider?: string;
      value: string;
      description?: string | null;
      externalRef?: string | null;
    };
    const created = await this.svc.create(
      companyId,
      {
        name: body.name,
        provider: (body.provider as SecretProvider | undefined) ?? this.defaultProvider,
        value: body.value,
        description: body.description,
        externalRef: body.externalRef,
      },
      { userId: actor.userId ?? "board", agentId: null },
    );

    await logActivity(this.db, {
      companyId,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "secret.created",
      entityType: "secret",
      entityId: created.id,
      details: { name: created.name, provider: created.provider },
    });

    return res.status(201).json(created);
  }

  @Post("secrets/:id/rotate")
  async rotateSecret(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Secret not found" });
    }
    assertCompanyAccess(req, existing.companyId);
    const body = req.body as { value: string; externalRef?: string | null };
    const rotated = await this.svc.rotate(
      id,
      {
        value: body.value,
        externalRef: body.externalRef,
      },
      { userId: actor.userId ?? "board", agentId: null },
    );

    await logActivity(this.db, {
      companyId: rotated.companyId,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "secret.rotated",
      entityType: "secret",
      entityId: rotated.id,
      details: { version: rotated.latestVersion },
    });
    return res.json(rotated);
  }

  @Patch("secrets/:id")
  async updateSecret(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Secret not found" });
    }
    assertCompanyAccess(req, existing.companyId);
    const body = req.body as {
      name?: string;
      description?: string | null;
      externalRef?: string | null;
    };
    const updated = await this.svc.update(id, {
      name: body.name,
      description: body.description,
      externalRef: body.externalRef,
    });
    if (!updated) {
      return res.status(404).json({ error: "Secret not found" });
    }
    await logActivity(this.db, {
      companyId: updated.companyId,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "secret.updated",
      entityType: "secret",
      entityId: updated.id,
      details: { name: updated.name },
    });
    return res.json(updated);
  }

  @Delete("secrets/:id")
  async deleteSecret(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Secret not found" });
    }
    assertCompanyAccess(req, existing.companyId);

    const removed = await this.svc.remove(id);
    if (!removed) {
      return res.status(404).json({ error: "Secret not found" });
    }

    await logActivity(this.db, {
      companyId: removed.companyId,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "secret.deleted",
      entityType: "secret",
      entityId: removed.id,
      details: { name: removed.name },
    });
    return res.json({ ok: true });
  }
}
