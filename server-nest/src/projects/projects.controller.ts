import { ConflictException, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { isUuidLike } from "@paperclipai/shared";
import { assertWorkspaceAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import {
  type ProjectWithGoals,
  projectService as expressProjectService,
} from "@paperclipai/server/services/projects";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { DB } from "../db/db.module.js";

@Controller()
export class ProjectsController {
  private readonly svc;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressProjectService(db);
  }

  private async normalizeProjectReference(req: Request & { actor?: Actor }, rawId: string) {
    if (isUuidLike(rawId)) return rawId;
    const companyIdQuery = req.query.companyId;
    const requestedCompanyId = typeof companyIdQuery === "string" && companyIdQuery.trim().length > 0
      ? companyIdQuery.trim()
      : null;
    if (requestedCompanyId) {
      assertWorkspaceAccess(req, requestedCompanyId);
      const resolved = await this.svc.resolveByReference(requestedCompanyId, rawId);
      if (resolved.ambiguous) {
        throw new ConflictException("Project shortname is ambiguous in this company. Use the project ID.");
      }
      return resolved.project?.id ?? rawId;
    }
    if (req.actor?.type === "agent" && req.actor.workspaceId) {
      const resolved = await this.svc.resolveByReference(req.actor.workspaceId, rawId);
      if (resolved.ambiguous) {
        throw new ConflictException("Project shortname is ambiguous in this company. Use the project ID.");
      }
      return resolved.project?.id ?? rawId;
    }
    return rawId;
  }

  @Get("companies/:companyId/projects")
  async listCompanyProjects(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ): Promise<ProjectWithGoals[]> {
    assertWorkspaceAccess(req, companyId);
    return this.svc.list(companyId);
  }

  @Get("projects/:id")
  async getProject(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Query("companyId") _companyId: string | undefined,
    @Res() res: Response,
  ) {
    const id = await this.normalizeProjectReference(req, rawId);
    const project = await this.svc.getById(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    assertWorkspaceAccess(req, project.companyId);
    return res.json(project);
  }

  @Get("projects/:id/workspaces")
  async listProjectWorkspaces(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Query("companyId") _companyId: string | undefined,
    @Res() res: Response,
  ) {
    const id = await this.normalizeProjectReference(req, rawId);
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }
    assertWorkspaceAccess(req, existing.companyId);
    const workspaces = await this.svc.listWorkspaces(id);
    return res.json(workspaces);
  }

  @Post("companies/:companyId/projects")
  async createProject(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertWorkspaceAccess(req, companyId);
    const {
      workspace,
      createdByAgentId: _omitCreatedByAgent,
      createdByUserId: _omitCreatedByUser,
      ...projectData
    } = (req.body ?? {}) as Record<string, any>;
    const actor = getActorInfo(req);
    const project = await this.svc.create(companyId, {
      ...projectData,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    } as any);
    let createdWorkspaceId: string | null = null;
    if (workspace) {
      const createdWorkspace = await this.svc.createWorkspace(project.id, workspace as any);
      if (!createdWorkspace) {
        await this.svc.remove(project.id);
        return res.status(422).json({ error: "Invalid project workspace payload" });
      }
      createdWorkspaceId = createdWorkspace.id;
    }
    const hydratedProject = workspace ? await this.svc.getById(project.id) : project;
    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      details: {
        name: project.name,
        workspaceId: createdWorkspaceId,
      },
    });
    return res.status(201).json(hydratedProject ?? project);
  }

  @Patch("projects/:id")
  async updateProject(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Query("companyId") _companyId: string | undefined,
    @Res() res: Response,
  ) {
    const id = await this.normalizeProjectReference(req, rawId);
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }
    assertWorkspaceAccess(req, existing.companyId);
    const body = { ...(req.body as Record<string, any>) };
    if (typeof body.archivedAt === "string") {
      body.archivedAt = new Date(body.archivedAt);
    }
    let project: Awaited<ReturnType<typeof this.svc.update>>;
    try {
      project = await this.svc.update(id, body as any);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("Invalid planningCanvasDocumentId")) {
        return res.status(422).json({ error: msg });
      }
      throw err;
    }
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: project.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.updated",
      entityType: "project",
      entityId: project.id,
      details: req.body as any,
    });
    return res.json(project);
  }

  @Post("projects/:id/workspaces")
  async createWorkspace(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Query("companyId") _companyId: string | undefined,
    @Res() res: Response,
  ) {
    const id = await this.normalizeProjectReference(req, rawId);
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }
    assertWorkspaceAccess(req, existing.companyId);
    const workspace = await this.svc.createWorkspace(id, req.body as any);
    if (!workspace) {
      return res.status(422).json({ error: "Invalid project workspace payload" });
    }
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.workspace_created",
      entityType: "project",
      entityId: id,
      details: {
        workspaceId: workspace.id,
        name: workspace.name,
        cwd: workspace.cwd,
        isPrimary: workspace.isPrimary,
      },
    });
    return res.status(201).json(workspace);
  }

  @Patch("projects/:id/workspaces/:workspaceId")
  async updateWorkspace(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("workspaceId") workspaceId: string,
    @Query("companyId") _companyId: string | undefined,
    @Res() res: Response,
  ) {
    const id = await this.normalizeProjectReference(req, rawId);
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }
    assertWorkspaceAccess(req, existing.companyId);
    const workspaceExists = (await this.svc.listWorkspaces(id)).some((workspace) => workspace.id === workspaceId);
    if (!workspaceExists) {
      return res.status(404).json({ error: "Project workspace not found" });
    }
    const workspace = await this.svc.updateWorkspace(id, workspaceId, req.body as any);
    if (!workspace) {
      return res.status(422).json({ error: "Invalid project workspace payload" });
    }
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.workspace_updated",
      entityType: "project",
      entityId: id,
      details: {
        workspaceId: workspace.id,
        changedKeys: Object.keys((req.body ?? {}) as Record<string, unknown>).sort(),
      },
    });
    return res.json(workspace);
  }

  @Delete("projects/:id/workspaces/:workspaceId")
  async deleteWorkspace(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("workspaceId") workspaceId: string,
    @Query("companyId") _companyId: string | undefined,
    @Res() res: Response,
  ) {
    const id = await this.normalizeProjectReference(req, rawId);
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }
    assertWorkspaceAccess(req, existing.companyId);
    const workspace = await this.svc.removeWorkspace(id, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: "Project workspace not found" });
    }
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.workspace_deleted",
      entityType: "project",
      entityId: id,
      details: {
        workspaceId: workspace.id,
        name: workspace.name,
      },
    });
    return res.json(workspace);
  }

  @Delete("projects/:id")
  async deleteProject(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Query("companyId") _companyId: string | undefined,
    @Res() res: Response,
  ) {
    const id = await this.normalizeProjectReference(req, rawId);
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }
    assertWorkspaceAccess(req, existing.companyId);
    const project = await this.svc.remove(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: project.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.deleted",
      entityType: "project",
      entityId: project.id,
    });
    return res.json(project);
  }
}

