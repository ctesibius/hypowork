import { and, eq } from "drizzle-orm";
import { Controller, Get, Patch, Inject, Param, Req, Res, Body, Query } from "@nestjs/common";
import type { Request, Response } from "express";
import { issues, projects, projectWorkspaces } from "@paperclipai/db";
import type { Actor } from "../auth/actor.guard.js";
import { assertWorkspaceAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { executionWorkspaceService as expressExecutionWorkspaceService } from "@paperclipai/server/services/execution-workspaces";
import { parseProjectExecutionWorkspacePolicy } from "@paperclipai/server/services/execution-workspace-policy";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { workspaceOperationService as expressWorkspaceOperationService } from "@paperclipai/server/services/workspace-operations";
import {
  cleanupExecutionWorkspaceArtifacts,
  stopRuntimeServicesForExecutionWorkspace,
} from "@paperclipai/server/services/workspace-runtime";
import { DB } from "../db/db.module.js";

const TERMINAL_ISSUE_STATUSES = new Set(["done", "cancelled"]);

@Controller()
export class ExecutionWorkspacesController {
  private readonly svc;
  private readonly workspaceOperationsSvc;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressExecutionWorkspaceService(db);
    this.workspaceOperationsSvc = expressWorkspaceOperationService(db);
  }

  @Get("companies/:companyId/execution-workspaces")
  async listWorkspaces(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query("projectId") projectId?: string,
    @Query("projectWorkspaceId") projectWorkspaceId?: string,
    @Query("issueId") issueId?: string,
    @Query("status") status?: string,
    @Query("reuseEligible") reuseEligible?: string,
  ) {
    assertWorkspaceAccess(req, companyId);
    return this.svc.list(companyId, {
      projectId,
      projectWorkspaceId,
      issueId,
      status,
      reuseEligible: reuseEligible === "true",
    });
  }

  @Get("execution-workspaces/:id")
  async getWorkspace(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const workspace = await this.svc.getById(id);
    if (!workspace) {
      return res.status(404).json({ error: "Execution workspace not found" });
    }
    assertWorkspaceAccess(req, workspace.companyId);
    return res.json(workspace);
  }

  @Patch("execution-workspaces/:id")
  async patchWorkspace(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Execution workspace not found" });
    }
    assertWorkspaceAccess(req, existing.companyId);

    const patch: Record<string, unknown> = {
      ...body,
      ...(typeof body.cleanupEligibleAt === "string"
        ? { cleanupEligibleAt: new Date(body.cleanupEligibleAt) }
        : {}),
    };
    let workspace = existing;
    let cleanupWarnings: string[] = [];

    if (body.status === "archived" && existing.status !== "archived") {
      const linkedIssues = await this.db
        .select({
          id: issues.id,
          status: issues.status,
        })
        .from(issues)
        .where(and(eq(issues.companyId, existing.companyId), eq(issues.executionWorkspaceId, existing.id)));
      const activeLinkedIssues = linkedIssues.filter((issue) => !TERMINAL_ISSUE_STATUSES.has(issue.status));

      if (activeLinkedIssues.length > 0) {
        return res.status(409).json({
          error: `Cannot archive execution workspace while ${activeLinkedIssues.length} linked issue(s) are still open`,
        });
      }

      const closedAt = new Date();
      const archivedWorkspace = await this.svc.update(id, {
        ...patch,
        status: "archived",
        closedAt,
        cleanupReason: null,
      });
      if (!archivedWorkspace) {
        return res.status(404).json({ error: "Execution workspace not found" });
      }
      workspace = archivedWorkspace;

      try {
        await stopRuntimeServicesForExecutionWorkspace({
          db: this.db,
          executionWorkspaceId: existing.id,
          workspaceCwd: existing.cwd,
        });
        const projectWorkspace = existing.projectWorkspaceId
          ? await this.db
              .select({
                cwd: projectWorkspaces.cwd,
                cleanupCommand: projectWorkspaces.cleanupCommand,
              })
              .from(projectWorkspaces)
              .where(
                and(
                  eq(projectWorkspaces.id, existing.projectWorkspaceId),
                  eq(projectWorkspaces.companyId, existing.companyId),
                ),
              )
              .then((rows) => rows[0] ?? null)
          : null;
        const projectPolicy = existing.projectId
          ? await this.db
              .select({
                executionWorkspacePolicy: projects.executionWorkspacePolicy,
              })
              .from(projects)
              .where(and(eq(projects.id, existing.projectId), eq(projects.companyId, existing.companyId)))
              .then((rows) => parseProjectExecutionWorkspacePolicy(rows[0]?.executionWorkspacePolicy))
          : null;
        const cleanupResult = await cleanupExecutionWorkspaceArtifacts({
          workspace: existing,
          projectWorkspace,
          teardownCommand: projectPolicy?.workspaceStrategy?.teardownCommand ?? null,
          recorder: this.workspaceOperationsSvc.createRecorder({
            companyId: existing.companyId,
            executionWorkspaceId: existing.id,
          }),
        });
        cleanupWarnings = cleanupResult.warnings;
        const cleanupPatch: Record<string, unknown> = {
          closedAt,
          cleanupReason: cleanupWarnings.length > 0 ? cleanupWarnings.join(" | ") : null,
        };
        if (!cleanupResult.cleaned) {
          cleanupPatch.status = "cleanup_failed";
        }
        if (cleanupResult.warnings.length > 0 || !cleanupResult.cleaned) {
          workspace = (await this.svc.update(id, cleanupPatch)) ?? workspace;
        }
      } catch (error) {
        const failureReason = error instanceof Error ? error.message : String(error);
        workspace =
          (await this.svc.update(id, {
            status: "cleanup_failed",
            closedAt,
            cleanupReason: failureReason,
          })) ?? workspace;
        return res.status(500).json({
          error: `Failed to archive execution workspace: ${failureReason}`,
        });
      }
    } else {
      const updatedWorkspace = await this.svc.update(id, patch);
      if (!updatedWorkspace) {
        return res.status(404).json({ error: "Execution workspace not found" });
      }
      workspace = updatedWorkspace;
    }

    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "execution_workspace.updated",
      entityType: "execution_workspace",
      entityId: workspace.id,
      details: {
        changedKeys: Object.keys(body).sort(),
        ...(cleanupWarnings.length > 0 ? { cleanupWarnings } : {}),
      },
    });

    return res.json(workspace);
  }
}
