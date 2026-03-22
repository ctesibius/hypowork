import {
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { companyCanvases } from "@paperclipai/db";
import { DB } from "../db/db.module.js";

@Controller()
export class CanvasesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get("companies/:companyId/canvas")
  async getCompanyCanvas(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);

    const [canvas] = await this.db
      .select()
      .from(companyCanvases)
      .where(eq(companyCanvases.companyId, companyId))
      .limit(1);

    if (!canvas) {
      return { nodes: [], edges: [] };
    }

    return { nodes: canvas.nodes, edges: canvas.edges };
  }

  @Patch("companies/:companyId/canvas")
  async upsertCompanyCanvas(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);

    const body = req.body as {
      nodes?: unknown[];
      edges?: unknown[];
    };

    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    const edges = Array.isArray(body.edges) ? body.edges : [];

    const [existing] = await this.db
      .select({ id: companyCanvases.id })
      .from(companyCanvases)
      .where(eq(companyCanvases.companyId, companyId))
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(companyCanvases)
        .set({ nodes, edges, updatedAt: new Date() })
        .where(eq(companyCanvases.id, existing.id))
        .returning();
      return { nodes: updated.nodes, edges: updated.edges };
    } else {
      const [created] = await this.db
        .insert(companyCanvases)
        .values({ companyId, nodes, edges })
        .returning();
      return { nodes: created.nodes, edges: created.edges };
    }
  }
}
