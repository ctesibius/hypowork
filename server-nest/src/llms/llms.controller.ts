import { Controller, Get, Param, Req, Res, Inject, Injectable } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import type { Db } from "@paperclipai/db";
import { AGENT_ICON_NAMES } from "@paperclipai/shared";
import { listServerAdapters } from "@paperclipai/server/adapters";
import { agentService } from "@paperclipai/server/services/agents";
import { DB } from "../db/db.module.js";

function hasCreatePermission(agent: { role: string; permissions: Record<string, unknown> | null | undefined }) {
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

@Injectable()
export class LlmsService {
  private readonly agentsSvc;

  constructor(@Inject(DB) private readonly db: Db) {
    this.agentsSvc = agentService(db);
  }

  async assertCanRead(actor: Actor) {
    if (actor.type === "board") return;
    if (actor.type !== "agent" || !actor.agentId) {
      throw new ForbiddenException("Board or permitted agent authentication required");
    }
    const actorAgent = await this.agentsSvc.getById(actor.agentId);
    if (!actorAgent || !hasCreatePermission(actorAgent)) {
      throw new ForbiddenException("Missing permission to read agent configuration reflection");
    }
  }
}

@Controller()
export class LlmsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(LlmsService) private readonly svc: LlmsService,
  ) {}

  @Get("llms/agent-configuration.txt")
  async getAgentConfiguration(
    @Req() req: Request & { actor?: Actor },
    @Res() res: Response,
  ) {
    await this.svc.assertCanRead(req.actor!);
    const adapters = listServerAdapters().sort((a, b) => a.type.localeCompare(b.type));
    const lines = [
      "# Hypowork Agent Configuration Index",
      "",
      "Installed adapters:",
      ...adapters.map((adapter) => `- ${adapter.type}: /llms/agent-configuration/${adapter.type}.txt`),
      "",
      "Related API endpoints:",
      "- GET /api/workspaces/:workspaceId/agent-configurations",
      "- GET /api/agents/:id/configuration",
      "- POST /api/workspaces/:workspaceId/agent-hires",
      "",
      "Agent identity references:",
      "- GET /llms/agent-icons.txt",
      "",
      "Notes:",
      "- Sensitive values are redacted in configuration read APIs.",
      "- New hires may be created in pending_approval state depending on company settings.",
      "",
    ];
    return res.type("text/plain").send(lines.join("\n"));
  }

  @Get("llms/agent-icons.txt")
  async getAgentIcons(
    @Req() req: Request & { actor?: Actor },
    @Res() res: Response,
  ) {
    await this.svc.assertCanRead(req.actor!);
    const lines = [
      "# Hypowork Agent Icon Names",
      "",
      "Set the `icon` field on hire/create payloads to one of:",
      ...AGENT_ICON_NAMES.map((name) => `- ${name}`),
      "",
      "Example:",
      '{ "name": "SearchOps", "role": "researcher", "icon": "search" }',
      "",
    ];
    return res.type("text/plain").send(lines.join("\n"));
  }

  @Get("llms/agent-configuration/:adapterType.txt")
  async getAdapterConfiguration(
    @Req() req: Request & { actor?: Actor },
    @Param("adapterType") adapterType: string,
    @Res() res: Response,
  ) {
    await this.svc.assertCanRead(req.actor!);
    const adapter = listServerAdapters().find((entry) => entry.type === adapterType);
    if (!adapter) {
      return res.status(404).type("text/plain").send(`Unknown adapter type: ${adapterType}`);
    }
    return res
      .type("text/plain")
      .send(
        adapter.agentConfigurationDoc ??
          `# ${adapterType} agent configuration\n\nNo adapter-specific documentation registered.`,
      );
  }
}
