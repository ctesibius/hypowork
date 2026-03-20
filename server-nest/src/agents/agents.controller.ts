import { Controller, Delete, Get, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { resolveAgentRouteParamId } from "./resolve-agent-route-id.js";
import {
  createAgentHireSchema,
  createAgentSchema,
  deriveAgentUrlKey,
  testAdapterEnvironmentSchema,
  updateAgentInstructionsPathSchema,
  updateAgentSchema,
  updateAgentPermissionsSchema,
  wakeAgentSchema,
  resetAgentSessionSchema,
} from "@paperclipai/shared";
import path from "node:path";
import { and, desc, eq, inArray, not, sql } from "drizzle-orm";
import { assertBoard, assertCompanyAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { agents as agentsTable, companies, heartbeatRuns } from "@paperclipai/db";
import { findServerAdapter, listAdapterModels } from "@paperclipai/server/adapters";
import { agentService as expressAgentService } from "@paperclipai/server/services/agents";
import { approvalService as expressApprovalService } from "@paperclipai/server/services/approvals";
import { budgetService as expressBudgetService } from "@paperclipai/server/services/budgets";
import { heartbeatService as expressHeartbeatService } from "@paperclipai/server/services/heartbeat";
import { issueApprovalService as expressIssueApprovalService } from "@paperclipai/server/services/issue-approvals";
import { issueService as expressIssueService } from "@paperclipai/server/services/issues";
import { secretService as expressSecretService } from "@paperclipai/server/services/secrets";
import { workspaceOperationService as expressWorkspaceOperationService } from "@paperclipai/server/services/workspace-operations";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { DB } from "../db/db.module.js";

@Controller()
export class AgentsController {
  private readonly svc;
  private readonly heartbeat;
  private readonly secrets;
  private readonly budgets;
  private readonly strictSecretsMode;
  private readonly issues;
  private readonly workspaceOps;
  private readonly defaultInstructionsPathKeys;
  private readonly approvals;
  private readonly issueApprovals;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressAgentService(db);
    this.heartbeat = expressHeartbeatService(db);
    this.secrets = expressSecretService(db);
    this.budgets = expressBudgetService(db);
    this.strictSecretsMode = process.env.PAPERCLIP_SECRETS_STRICT_MODE === "true";
    this.issues = expressIssueService(db);
    this.workspaceOps = expressWorkspaceOperationService(db);
    this.approvals = expressApprovalService(db);
    this.issueApprovals = expressIssueApprovalService(db);
    this.defaultInstructionsPathKeys = {
      claude_local: "instructionsFilePath",
      codex_local: "instructionsFilePath",
      gemini_local: "instructionsFilePath",
      opencode_local: "instructionsFilePath",
      cursor: "instructionsFilePath",
    } as Record<string, string>;
  }

  private parseSchedulerHeartbeatPolicy(runtimeConfig: unknown) {
    const heartbeat =
      runtimeConfig && typeof runtimeConfig === "object" && !Array.isArray(runtimeConfig)
        ? (runtimeConfig as Record<string, unknown>).heartbeat
        : null;
    const heartbeatObj =
      heartbeat && typeof heartbeat === "object" && !Array.isArray(heartbeat)
        ? (heartbeat as Record<string, unknown>)
        : {};
    const enabled =
      typeof heartbeatObj.enabled === "boolean"
        ? heartbeatObj.enabled
        : true;
    const intervalRaw =
      typeof heartbeatObj.intervalSec === "number"
        ? heartbeatObj.intervalSec
        : typeof heartbeatObj.intervalSec === "string"
          ? Number(heartbeatObj.intervalSec)
          : 0;
    return {
      enabled,
      intervalSec: Number.isFinite(intervalRaw) ? Math.max(0, Math.floor(intervalRaw)) : 0,
    };
  }

  private parseSourceIssueIds(input: {
    sourceIssueId?: string | null;
    sourceIssueIds?: string[];
  }): string[] {
    const values: string[] = [];
    if (Array.isArray(input.sourceIssueIds)) values.push(...input.sourceIssueIds);
    if (typeof input.sourceIssueId === "string" && input.sourceIssueId.length > 0) {
      values.push(input.sourceIssueId);
    }
    return Array.from(new Set(values));
  }

  @Get("companies/:companyId/agents")
  async listCompanyAgents(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ): Promise<unknown[]> {
    assertCompanyAccess(req, companyId);
    return this.svc.list(companyId);
  }

  @Get("companies/:companyId/adapters/:type/models")
  async listAdapterTypeModels(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("type") type: string,
  ) {
    assertCompanyAccess(req, companyId);
    return listAdapterModels(type);
  }

  @Post("companies/:companyId/adapters/:type/test-environment")
  async testAdapterEnvironment(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("type") type: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const body = testAdapterEnvironmentSchema.parse(req.body ?? {});
    const adapter = findServerAdapter(type);
    if (!adapter) return res.status(404).json({ error: `Unknown adapter type: ${type}` });
    const normalizedAdapterConfig = await this.secrets.normalizeAdapterConfigForPersistence(
      companyId,
      (body.adapterConfig ?? {}) as Record<string, unknown>,
      { strictMode: this.strictSecretsMode },
    );
    const { config: runtimeAdapterConfig } = await this.secrets.resolveAdapterConfigForRuntime(
      companyId,
      normalizedAdapterConfig,
    );
    const result = await adapter.testEnvironment({
      companyId,
      adapterType: type,
      config: runtimeAdapterConfig,
    });
    return res.json(result);
  }

  @Post("companies/:companyId/agents")
  async createAgent(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const body = createAgentSchema.parse(req.body ?? {});
    const normalizedAdapterConfig = await this.secrets.normalizeAdapterConfigForPersistence(
      companyId,
      ((body.adapterConfig ?? {}) as Record<string, unknown>),
      { strictMode: this.strictSecretsMode },
    );
    const agent = await this.svc.create(companyId, {
      ...body,
      adapterConfig: normalizedAdapterConfig,
      status: "idle",
      spentMonthlyCents: 0,
      lastHeartbeatAt: null,
    });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.created",
      entityType: "agent",
      entityId: agent.id,
      details: { name: agent.name, role: agent.role },
    });
    if (agent.budgetMonthlyCents > 0) {
      await this.budgets.upsertPolicy(
        companyId,
        {
          scopeType: "agent",
          scopeId: agent.id,
          amount: agent.budgetMonthlyCents,
          windowKind: "calendar_month_utc",
        },
        actor.actorType === "user" ? actor.actorId : null,
      );
    }
    return res.status(201).json(agent);
  }

  @Post("companies/:companyId/agent-hires")
  async createAgentHire(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const body = createAgentHireSchema.parse(req.body ?? {});
    const sourceIssueIds = this.parseSourceIssueIds(body);
    const { sourceIssueId: _sourceIssueId, sourceIssueIds: _sourceIssueIds, ...hireInput } = body as Record<string, unknown>;
    const normalizedAdapterConfig = await this.secrets.normalizeAdapterConfigForPersistence(
      companyId,
      ((hireInput.adapterConfig ?? {}) as Record<string, unknown>),
      { strictMode: this.strictSecretsMode },
    );

    const company = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .then((rows) => rows[0] ?? null);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const requiresApproval = company.requireBoardApprovalForNewAgents;
    const status = requiresApproval ? "pending_approval" : "idle";
    const agent = await this.svc.create(companyId, {
      ...(hireInput as Record<string, unknown>),
      adapterConfig: normalizedAdapterConfig,
      status,
      spentMonthlyCents: 0,
      lastHeartbeatAt: null,
    } as any);

    const actor = getActorInfo(req);
    let approval: unknown = null;
    if (requiresApproval) {
      const requestedAdapterType = (hireInput.adapterType as string | null | undefined) ?? agent.adapterType;
      const requestedAdapterConfig = ((hireInput.adapterConfig ?? agent.adapterConfig) as Record<string, unknown>) ?? {};
      const requestedRuntimeConfig = ((hireInput.runtimeConfig ?? agent.runtimeConfig) as Record<string, unknown>) ?? {};
      const requestedMetadata = ((hireInput.metadata ?? agent.metadata ?? {}) as Record<string, unknown>) ?? {};
      approval = await this.approvals.create(companyId, {
        type: "hire_agent",
        requestedByAgentId: actor.actorType === "agent" ? actor.actorId : null,
        requestedByUserId: actor.actorType === "user" ? actor.actorId : null,
        status: "pending",
        payload: {
          name: hireInput.name,
          role: hireInput.role,
          title: hireInput.title ?? null,
          icon: hireInput.icon ?? null,
          reportsTo: hireInput.reportsTo ?? null,
          capabilities: hireInput.capabilities ?? null,
          adapterType: requestedAdapterType,
          adapterConfig: requestedAdapterConfig,
          runtimeConfig: requestedRuntimeConfig,
          budgetMonthlyCents:
            typeof hireInput.budgetMonthlyCents === "number"
              ? hireInput.budgetMonthlyCents
              : agent.budgetMonthlyCents,
          metadata: requestedMetadata,
          agentId: agent.id,
          requestedByAgentId: actor.actorType === "agent" ? actor.actorId : null,
          requestedConfigurationSnapshot: {
            adapterType: requestedAdapterType,
            adapterConfig: requestedAdapterConfig,
            runtimeConfig: requestedRuntimeConfig,
          },
        },
        decisionNote: null,
        decidedByUserId: null,
        decidedAt: null,
        updatedAt: new Date(),
      } as any);
      if (sourceIssueIds.length > 0 && approval && typeof approval === "object" && "id" in approval) {
        await this.issueApprovals.linkManyForApproval((approval as { id: string }).id, sourceIssueIds, {
          agentId: actor.actorType === "agent" ? actor.actorId : null,
          userId: actor.actorType === "user" ? actor.actorId : null,
        });
      }
    }

    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.hire_created",
      entityType: "agent",
      entityId: agent.id,
      details: {
        name: agent.name,
        role: agent.role,
        requiresApproval,
        approvalId: approval && typeof approval === "object" && "id" in approval ? (approval as { id: string }).id : null,
        issueIds: sourceIssueIds,
      },
    });

    if (approval && typeof approval === "object" && "id" in approval && "type" in approval) {
      await logActivity(this.db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "approval.created",
        entityType: "approval",
        entityId: (approval as { id: string }).id,
        details: { type: (approval as { type: string }).type, linkedAgentId: agent.id },
      });
    }

    return res.status(201).json({ agent, approval });
  }

  @Patch("agents/:id/permissions")
  async updateAgentPermissions(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const body = updateAgentPermissionsSchema.parse(req.body ?? {});
    const existing = await this.svc.getById(id);
    if (!existing) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, existing.companyId);
    const agent = await this.svc.updatePermissions(id, body);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.permissions_updated",
      entityType: "agent",
      entityId: agent.id,
      details: body as Record<string, unknown>,
    });
    return res.json(agent);
  }

  @Patch("agents/:id")
  async updateAgent(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const body = updateAgentSchema.parse(req.body ?? {});
    const existing = await this.svc.getById(id);
    if (!existing) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, existing.companyId);
    if (Object.prototype.hasOwnProperty.call(body as Record<string, unknown>, "permissions")) {
      return res.status(422).json({ error: "Use /api/agents/:id/permissions for permission changes" });
    }
    const patchData = { ...(body as Record<string, unknown>) };
    if (Object.prototype.hasOwnProperty.call(patchData, "adapterConfig")) {
      const adapterConfig =
        patchData.adapterConfig &&
        typeof patchData.adapterConfig === "object" &&
        !Array.isArray(patchData.adapterConfig)
          ? (patchData.adapterConfig as Record<string, unknown>)
          : null;
      if (!adapterConfig) {
        return res.status(422).json({ error: "adapterConfig must be an object" });
      }
      patchData.adapterConfig = await this.secrets.normalizeAdapterConfigForPersistence(
        existing.companyId,
        adapterConfig,
        { strictMode: this.strictSecretsMode },
      );
    }
    const actor = getActorInfo(req);
    const agent = await this.svc.update(id, patchData, {
      recordRevision: {
        createdByAgentId: actor.agentId,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
        source: "patch",
      },
    });
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.updated",
      entityType: "agent",
      entityId: agent.id,
      details: { changedTopLevelKeys: Object.keys(patchData).sort() },
    });
    return res.json(agent);
  }

  @Patch("agents/:id/instructions-path")
  async updateAgentInstructionsPath(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const body = updateAgentInstructionsPathSchema.parse(req.body ?? {});
    const existing = await this.svc.getById(id);
    if (!existing) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, existing.companyId);
    const existingAdapterConfig =
      existing.adapterConfig &&
      typeof existing.adapterConfig === "object" &&
      !Array.isArray(existing.adapterConfig)
        ? (existing.adapterConfig as Record<string, unknown>)
        : {};
    const explicitKey = typeof body.adapterConfigKey === "string" && body.adapterConfigKey.trim().length > 0
      ? body.adapterConfigKey.trim()
      : null;
    const defaultKey = this.defaultInstructionsPathKeys[existing.adapterType] ?? null;
    const adapterConfigKey = explicitKey ?? defaultKey;
    if (!adapterConfigKey) {
      return res.status(422).json({
        error: `No default instructions path key for adapter type '${existing.adapterType}'. Provide adapterConfigKey.`,
      });
    }
    const nextAdapterConfig: Record<string, unknown> = { ...existingAdapterConfig };
    if (body.path === null) {
      delete nextAdapterConfig[adapterConfigKey];
    } else {
      const trimmed = body.path.trim();
      const resolvedPath = path.isAbsolute(trimmed)
        ? trimmed
        : (() => {
            const cwd =
              typeof existingAdapterConfig.cwd === "string" && path.isAbsolute(existingAdapterConfig.cwd)
                ? existingAdapterConfig.cwd
                : null;
            if (!cwd) {
              throw new Error("Relative instructions path requires adapterConfig.cwd to be an absolute path");
            }
            return path.resolve(cwd, trimmed);
          })();
      nextAdapterConfig[adapterConfigKey] = resolvedPath;
    }
    const normalizedAdapterConfig = await this.secrets.normalizeAdapterConfigForPersistence(
      existing.companyId,
      nextAdapterConfig,
      { strictMode: this.strictSecretsMode },
    );
    const actor = getActorInfo(req);
    const agent = await this.svc.update(
      id,
      { adapterConfig: normalizedAdapterConfig },
      {
        recordRevision: {
          createdByAgentId: actor.agentId,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
          source: "instructions_path_patch",
        },
      },
    );
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const updatedAdapterConfig =
      agent.adapterConfig && typeof agent.adapterConfig === "object" && !Array.isArray(agent.adapterConfig)
        ? (agent.adapterConfig as Record<string, unknown>)
        : {};
    const pathValue = typeof updatedAdapterConfig[adapterConfigKey] === "string"
      ? updatedAdapterConfig[adapterConfigKey] as string
      : null;
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.instructions_path_updated",
      entityType: "agent",
      entityId: agent.id,
      details: { adapterConfigKey, path: pathValue, cleared: body.path === null },
    });
    return res.json({
      agentId: agent.id,
      adapterType: agent.adapterType,
      adapterConfigKey,
      path: pathValue,
    });
  }

  @Get("agents/:id")
  async getAgent(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.getById(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, agent.companyId);
    const chainOfCommand = await this.svc.getChainOfCommand(agent.id);
    return res.json({ ...agent, chainOfCommand });
  }

  @Get("agents/me")
  async getMe(
    @Req() req: Request & { actor?: Actor },
    @Res() res: Response,
  ) {
    if (req.actor?.type !== "agent" || !req.actor.agentId) {
      return res.status(401).json({ error: "Agent authentication required" });
    }
    const agent = await this.svc.getById(req.actor.agentId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const chainOfCommand = await this.svc.getChainOfCommand(agent.id);
    return res.json({ ...agent, chainOfCommand });
  }

  @Get("companies/:companyId/org")
  async getCompanyOrg(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.svc.orgForCompany(companyId);
  }

  @Get("companies/:companyId/agent-configurations")
  async getCompanyAgentConfigurations(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ): Promise<unknown[]> {
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const rows = await this.svc.list(companyId);
    return rows.map((agent) => ({
      id: agent.id,
      companyId: agent.companyId,
      name: agent.name,
      role: agent.role,
      title: agent.title,
      status: agent.status,
      reportsTo: agent.reportsTo,
      adapterType: agent.adapterType,
      adapterConfig: agent.adapterConfig,
      runtimeConfig: agent.runtimeConfig,
      permissions: agent.permissions,
      updatedAt: agent.updatedAt,
    }));
  }

  @Get("agents/:id/configuration")
  async getAgentConfiguration(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.getById(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, agent.companyId);
    return res.json({
      id: agent.id,
      companyId: agent.companyId,
      name: agent.name,
      role: agent.role,
      title: agent.title,
      status: agent.status,
      reportsTo: agent.reportsTo,
      adapterType: agent.adapterType,
      adapterConfig: agent.adapterConfig,
      runtimeConfig: agent.runtimeConfig,
      permissions: agent.permissions,
      updatedAt: agent.updatedAt,
    });
  }

  @Get("agents/:id/config-revisions")
  async listAgentConfigRevisions(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ): Promise<unknown> {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.getById(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, agent.companyId);
    const revisions = await this.svc.listConfigRevisions(id);
    return res.json(revisions);
  }

  @Get("agents/:id/config-revisions/:revisionId")
  async getAgentConfigRevision(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("revisionId") revisionId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.getById(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, agent.companyId);
    const revision = await this.svc.getConfigRevision(id, revisionId);
    if (!revision) return res.status(404).json({ error: "Revision not found" });
    return res.json(revision);
  }

  @Post("agents/:id/config-revisions/:revisionId/rollback")
  async rollbackAgentConfigRevision(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("revisionId") revisionId: string,
    @Res() res: Response,
  ) {
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const existing = await this.svc.getById(id);
    if (!existing) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, existing.companyId);
    const actor = getActorInfo(req);
    const updated = await this.svc.rollbackConfigRevision(id, revisionId, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });
    if (!updated) return res.status(404).json({ error: "Revision not found" });
    await logActivity(this.db, {
      companyId: updated.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.config_rolled_back",
      entityType: "agent",
      entityId: updated.id,
      details: { revisionId },
    });
    return res.json(updated);
  }

  @Get("agents/:id/runtime-state")
  async getAgentRuntimeState(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.getById(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, agent.companyId);
    const state = await this.heartbeat.getRuntimeState(id);
    return res.json(state);
  }

  @Get("agents/:id/task-sessions")
  async listAgentTaskSessions(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.getById(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, agent.companyId);
    const sessions = await this.heartbeat.listTaskSessions(id);
    return res.json(sessions);
  }

  @Post("agents/:id/runtime-state/reset-session")
  async resetAgentRuntimeSession(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const body = resetAgentSessionSchema.parse(req.body ?? {});
    const agent = await this.svc.getById(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, agent.companyId);
    const taskKey =
      typeof body.taskKey === "string" && body.taskKey.trim().length > 0
        ? body.taskKey.trim()
        : null;
    const state = await this.heartbeat.resetRuntimeSession(id, { taskKey });
    const actorId = req.actor?.type === "board" ? req.actor.userId ?? "board" : "board";
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: "user",
      actorId,
      action: "agent.runtime_session_reset",
      entityType: "agent",
      entityId: id,
      details: { taskKey: taskKey ?? null },
    });
    return res.json(state);
  }

  @Post("agents/:id/pause")
  async pauseAgent(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.pause(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    await this.heartbeat.cancelActiveForAgent(id);
    const actor = req.actor?.type === "board" ? req.actor.userId ?? "board" : "board";
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: "user",
      actorId: actor,
      action: "agent.paused",
      entityType: "agent",
      entityId: agent.id,
    });
    return res.json(agent);
  }

  @Post("agents/:id/resume")
  async resumeAgent(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.resume(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const actor = req.actor?.type === "board" ? req.actor.userId ?? "board" : "board";
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: "user",
      actorId: actor,
      action: "agent.resumed",
      entityType: "agent",
      entityId: agent.id,
    });
    return res.json(agent);
  }

  @Post("agents/:id/terminate")
  async terminateAgent(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.terminate(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    await this.heartbeat.cancelActiveForAgent(id);
    const actor = req.actor?.type === "board" ? req.actor.userId ?? "board" : "board";
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: "user",
      actorId: actor,
      action: "agent.terminated",
      entityType: "agent",
      entityId: agent.id,
    });
    return res.json(agent);
  }

  @Delete("agents/:id")
  async deleteAgent(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.remove(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const actor = req.actor?.type === "board" ? req.actor.userId ?? "board" : "board";
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: "user",
      actorId: actor,
      action: "agent.deleted",
      entityType: "agent",
      entityId: agent.id,
    });
    return res.json({ ok: true });
  }

  @Get("agents/:id/keys")
  async listAgentKeys(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    return this.svc.listKeys(id);
  }

  @Post("agents/:id/keys")
  async createAgentKey(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    if (!name.trim()) return res.status(400).json({ error: "name is required" });
    const key = await this.svc.createApiKey(id, name.trim());
    const agent = await this.svc.getById(id);
    if (agent) {
      const actor = req.actor?.type === "board" ? req.actor.userId ?? "board" : "board";
      await logActivity(this.db, {
        companyId: agent.companyId,
        actorType: "user",
        actorId: actor,
        action: "agent.key_created",
        entityType: "agent",
        entityId: agent.id,
        details: { keyId: key.id, name: key.name },
      });
    }
    return res.status(201).json(key);
  }

  @Delete("agents/:id/keys/:keyId")
  async revokeAgentKey(
    @Req() req: Request & { actor?: Actor },
    @Param("keyId") keyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const revoked = await this.svc.revokeKey(keyId);
    if (!revoked) return res.status(404).json({ error: "Key not found" });
    return res.json({ ok: true });
  }

  @Post("agents/:id/wakeup")
  async wakeAgent(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const body = wakeAgentSchema.parse(req.body ?? {});
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.getById(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, agent.companyId);

    if (req.actor?.type === "agent" && req.actor.agentId !== id) {
      return res.status(403).json({ error: "Agent can only invoke itself" });
    }

    const run = await this.heartbeat.wakeup(id, {
      source: body.source,
      triggerDetail: body.triggerDetail ?? "manual",
      reason: body.reason ?? null,
      payload: body.payload ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
      requestedByActorType: req.actor?.type === "agent" ? "agent" : "user",
      requestedByActorId: req.actor?.type === "agent" ? req.actor.agentId ?? null : req.actor?.type === "board" ? req.actor.userId ?? null : null,
      contextSnapshot: {
        triggeredBy: req.actor?.type ?? "none",
        actorId: req.actor?.type === "agent" ? req.actor.agentId : req.actor?.type === "board" ? req.actor.userId : null,
        forceFreshSession: body.forceFreshSession === true,
      },
    });

    if (!run) return res.status(202).json({ status: "skipped" });

    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "heartbeat.invoked",
      entityType: "heartbeat_run",
      entityId: run.id,
      details: { agentId: id },
    });
    return res.status(202).json(run);
  }

  @Post("agents/:id/heartbeat/invoke")
  async invokeHeartbeat(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await resolveAgentRouteParamId(this.svc, req, rawId);
    const agent = await this.svc.getById(id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    assertCompanyAccess(req, agent.companyId);
    if (req.actor?.type === "agent" && req.actor.agentId !== id) {
      return res.status(403).json({ error: "Agent can only invoke itself" });
    }
    const run = await this.heartbeat.invoke(
      id,
      "on_demand",
      {
        triggeredBy: req.actor?.type ?? "none",
        actorId: req.actor?.type === "agent" ? req.actor.agentId : req.actor?.type === "board" ? req.actor.userId : null,
      },
      "manual",
      {
        actorType: req.actor?.type === "agent" ? "agent" : "user",
        actorId: req.actor?.type === "agent" ? req.actor.agentId ?? null : req.actor?.type === "board" ? req.actor.userId ?? null : null,
      },
    );
    if (!run) return res.status(202).json({ status: "skipped" });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "heartbeat.invoked",
      entityType: "heartbeat_run",
      entityId: run.id,
      details: { agentId: id },
    });
    return res.status(202).json(run);
  }

  @Get("companies/:companyId/heartbeat-runs")
  async listCompanyHeartbeatRuns(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);
    const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
    const limitParam = typeof req.query.limit === "string" ? req.query.limit : undefined;
    const limit = limitParam
      ? Math.max(1, Math.min(1000, Number.parseInt(limitParam, 10) || 200))
      : undefined;
    return this.heartbeat.list(companyId, agentId, limit);
  }

  @Get("instance/scheduler-heartbeats")
  async listInstanceSchedulerHeartbeats(
    @Req() req: Request & { actor?: Actor },
  ) {
    assertBoard(req);
    const accessConditions = [];
    if (req.actor?.type === "board" && req.actor.source !== "local_implicit" && !req.actor.isInstanceAdmin) {
      const allowedCompanyIds = req.actor.companyIds ?? [];
      if (allowedCompanyIds.length === 0) return [];
      accessConditions.push(inArray(agentsTable.companyId, allowedCompanyIds));
    }
    const rows = await this.db
      .select({
        id: agentsTable.id,
        companyId: agentsTable.companyId,
        agentName: agentsTable.name,
        role: agentsTable.role,
        title: agentsTable.title,
        status: agentsTable.status,
        adapterType: agentsTable.adapterType,
        runtimeConfig: agentsTable.runtimeConfig,
        lastHeartbeatAt: agentsTable.lastHeartbeatAt,
        companyName: companies.name,
        companyIssuePrefix: companies.issuePrefix,
      })
      .from(agentsTable)
      .innerJoin(companies, eq(agentsTable.companyId, companies.id))
      .where(accessConditions.length > 0 ? and(...accessConditions) : undefined)
      .orderBy(companies.name, agentsTable.name);
    return rows
      .map((row) => {
        const policy = this.parseSchedulerHeartbeatPolicy(row.runtimeConfig);
        const statusEligible =
          row.status !== "paused" &&
          row.status !== "terminated" &&
          row.status !== "pending_approval";
        return {
          id: row.id,
          companyId: row.companyId,
          companyName: row.companyName,
          companyIssuePrefix: row.companyIssuePrefix,
          agentName: row.agentName,
          agentUrlKey: deriveAgentUrlKey(row.agentName, row.id),
          role: row.role,
          title: row.title,
          status: row.status,
          adapterType: row.adapterType,
          intervalSec: policy.intervalSec,
          heartbeatEnabled: policy.enabled,
          schedulerActive: statusEligible && policy.enabled && policy.intervalSec > 0,
          lastHeartbeatAt: row.lastHeartbeatAt,
        };
      })
      .filter((item) =>
        item.intervalSec > 0 &&
        item.status !== "paused" &&
        item.status !== "terminated" &&
        item.status !== "pending_approval",
      );
  }

  @Get("companies/:companyId/live-runs")
  async listCompanyLiveRuns(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);
    const minCountParam = typeof req.query.minCount === "string" ? req.query.minCount : undefined;
    const minCount = minCountParam ? Math.max(0, Math.min(20, Number.parseInt(minCountParam, 10) || 0)) : 0;
    const columns = {
      id: heartbeatRuns.id,
      status: heartbeatRuns.status,
      invocationSource: heartbeatRuns.invocationSource,
      triggerDetail: heartbeatRuns.triggerDetail,
      startedAt: heartbeatRuns.startedAt,
      finishedAt: heartbeatRuns.finishedAt,
      createdAt: heartbeatRuns.createdAt,
      agentId: heartbeatRuns.agentId,
      agentName: agentsTable.name,
      adapterType: agentsTable.adapterType,
      issueId: sql<string | null>`${heartbeatRuns.contextSnapshot} ->> 'issueId'`.as("issueId"),
    };
    const liveRuns = await this.db
      .select(columns)
      .from(heartbeatRuns)
      .innerJoin(agentsTable, eq(heartbeatRuns.agentId, agentsTable.id))
      .where(and(eq(heartbeatRuns.companyId, companyId), inArray(heartbeatRuns.status, ["queued", "running"])))
      .orderBy(desc(heartbeatRuns.createdAt));
    if (minCount > 0 && liveRuns.length < minCount) {
      const activeIds = liveRuns.map((r) => r.id);
      const recentRuns = await this.db
        .select(columns)
        .from(heartbeatRuns)
        .innerJoin(agentsTable, eq(heartbeatRuns.agentId, agentsTable.id))
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            not(inArray(heartbeatRuns.status, ["queued", "running"])),
            ...(activeIds.length > 0 ? [not(inArray(heartbeatRuns.id, activeIds))] : []),
          ),
        )
        .orderBy(desc(heartbeatRuns.createdAt))
        .limit(minCount - liveRuns.length);
      return [...liveRuns, ...recentRuns];
    }
    return liveRuns;
  }

  @Get("heartbeat-runs/:runId")
  async getHeartbeatRun(
    @Req() req: Request & { actor?: Actor },
    @Param("runId") runId: string,
    @Res() res: Response,
  ) {
    const run = await this.heartbeat.getRun(runId);
    if (!run) return res.status(404).json({ error: "Heartbeat run not found" });
    assertCompanyAccess(req, run.companyId);
    return res.json(run);
  }

  @Post("heartbeat-runs/:runId/cancel")
  async cancelHeartbeatRun(
    @Req() req: Request & { actor?: Actor },
    @Param("runId") runId: string,
  ) {
    assertBoard(req);
    const run = await this.heartbeat.cancelRun(runId);
    if (run) {
      const actorId = req.actor?.type === "board" ? req.actor.userId ?? "board" : "board";
      await logActivity(this.db, {
        companyId: run.companyId,
        actorType: "user",
        actorId,
        action: "heartbeat.cancelled",
        entityType: "heartbeat_run",
        entityId: run.id,
        details: { agentId: run.agentId },
      });
    }
    return run;
  }

  @Get("heartbeat-runs/:runId/events")
  async listHeartbeatRunEvents(
    @Req() req: Request & { actor?: Actor },
    @Param("runId") runId: string,
    @Res() res: Response,
  ) {
    const run = await this.heartbeat.getRun(runId);
    if (!run) return res.status(404).json({ error: "Heartbeat run not found" });
    assertCompanyAccess(req, run.companyId);
    const afterSeq = Number(req.query.afterSeq ?? 0);
    const limit = Number(req.query.limit ?? 200);
    const events = await this.heartbeat.listEvents(
      runId,
      Number.isFinite(afterSeq) ? afterSeq : 0,
      Number.isFinite(limit) ? limit : 200,
    );
    return res.json(events);
  }

  @Get("heartbeat-runs/:runId/log")
  async getHeartbeatRunLog(
    @Req() req: Request & { actor?: Actor },
    @Param("runId") runId: string,
    @Res() res: Response,
  ) {
    const run = await this.heartbeat.getRun(runId);
    if (!run) return res.status(404).json({ error: "Heartbeat run not found" });
    assertCompanyAccess(req, run.companyId);
    const offset = Number(req.query.offset ?? 0);
    const limitBytes = Number(req.query.limitBytes ?? 256000);
    const result = await this.heartbeat.readLog(runId, {
      offset: Number.isFinite(offset) ? offset : 0,
      limitBytes: Number.isFinite(limitBytes) ? limitBytes : 256000,
    });
    return res.json(result);
  }

  @Get("heartbeat-runs/:runId/workspace-operations")
  async listRunWorkspaceOperations(
    @Req() req: Request & { actor?: Actor },
    @Param("runId") runId: string,
    @Res() res: Response,
  ) {
    const run = await this.heartbeat.getRun(runId);
    if (!run) return res.status(404).json({ error: "Heartbeat run not found" });
    assertCompanyAccess(req, run.companyId);
    const context =
      run.contextSnapshot && typeof run.contextSnapshot === "object" && !Array.isArray(run.contextSnapshot)
        ? (run.contextSnapshot as Record<string, unknown>)
        : null;
    const executionWorkspaceId =
      context && typeof context.executionWorkspaceId === "string" && context.executionWorkspaceId.trim().length > 0
        ? context.executionWorkspaceId.trim()
        : null;
    const operations = await this.workspaceOps.listForRun(runId, executionWorkspaceId);
    return res.json(operations);
  }

  @Get("workspace-operations/:operationId/log")
  async getWorkspaceOperationLog(
    @Req() req: Request & { actor?: Actor },
    @Param("operationId") operationId: string,
    @Res() res: Response,
  ) {
    const operation = await this.workspaceOps.getById(operationId);
    if (!operation) return res.status(404).json({ error: "Workspace operation not found" });
    assertCompanyAccess(req, operation.companyId);
    const offset = Number(req.query.offset ?? 0);
    const limitBytes = Number(req.query.limitBytes ?? 256000);
    const result = await this.workspaceOps.readLog(operationId, {
      offset: Number.isFinite(offset) ? offset : 0,
      limitBytes: Number.isFinite(limitBytes) ? limitBytes : 256000,
    });
    return res.json(result);
  }

  @Get("issues/:issueId/live-runs")
  async listIssueLiveRuns(
    @Req() req: Request & { actor?: Actor },
    @Param("issueId") rawId: string,
    @Res() res: Response,
  ) {
    const isIdentifier = /^[A-Z]+-\d+$/i.test(rawId);
    const issue = isIdentifier ? await this.issues.getByIdentifier(rawId) : await this.issues.getById(rawId);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertCompanyAccess(req, issue.companyId);
    const liveRuns = await this.db
      .select({
        id: heartbeatRuns.id,
        status: heartbeatRuns.status,
        invocationSource: heartbeatRuns.invocationSource,
        triggerDetail: heartbeatRuns.triggerDetail,
        startedAt: heartbeatRuns.startedAt,
        finishedAt: heartbeatRuns.finishedAt,
        createdAt: heartbeatRuns.createdAt,
        agentId: heartbeatRuns.agentId,
        agentName: agentsTable.name,
        adapterType: agentsTable.adapterType,
      })
      .from(heartbeatRuns)
      .innerJoin(agentsTable, eq(heartbeatRuns.agentId, agentsTable.id))
      .where(
        and(
          eq(heartbeatRuns.companyId, issue.companyId),
          inArray(heartbeatRuns.status, ["queued", "running"]),
          sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issue.id}`,
        ),
      )
      .orderBy(desc(heartbeatRuns.createdAt));
    return res.json(liveRuns);
  }

  @Get("issues/:issueId/active-run")
  async getIssueActiveRun(
    @Req() req: Request & { actor?: Actor },
    @Param("issueId") rawId: string,
    @Res() res: Response,
  ) {
    const isIdentifier = /^[A-Z]+-\d+$/i.test(rawId);
    const issue = isIdentifier ? await this.issues.getByIdentifier(rawId) : await this.issues.getById(rawId);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertCompanyAccess(req, issue.companyId);
    let run = issue.executionRunId ? await this.heartbeat.getRun(issue.executionRunId) : null;
    if (run && run.status !== "queued" && run.status !== "running") run = null;
    if (!run && issue.assigneeAgentId && issue.status === "in_progress") {
      const candidateRun = await this.heartbeat.getActiveRunForAgent(issue.assigneeAgentId);
      const candidateContext =
        candidateRun?.contextSnapshot && typeof candidateRun.contextSnapshot === "object" && !Array.isArray(candidateRun.contextSnapshot)
          ? (candidateRun.contextSnapshot as Record<string, unknown>)
          : null;
      const candidateIssueId =
        candidateContext && typeof candidateContext.issueId === "string" ? candidateContext.issueId : null;
      if (candidateRun && candidateIssueId === issue.id) run = candidateRun;
    }
    if (!run) return res.json(null);
    const agent = await this.svc.getById(run.agentId);
    if (!agent) return res.json(null);
    return res.json({
      ...run,
      agentId: agent.id,
      agentName: agent.name,
      adapterType: agent.adapterType,
    });
  }
}

