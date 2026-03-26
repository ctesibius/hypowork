import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { Actor } from "./actor.guard.js";

function getActor(req: Request & { actor?: Actor }): Actor {
  if (!req.actor) throw new UnauthorizedException("No actor");
  return req.actor;
}

export function assertBoard(req: Request & { actor?: Actor }) {
  const actor = getActor(req);
  if (actor.type !== "board") {
    throw new ForbiddenException("Board access required");
  }
}

export function assertInstanceAdmin(req: Request & { actor?: Actor }) {
  const actor = getActor(req);
  if (actor.type !== "board") {
    throw new ForbiddenException("Board access required");
  }
  if (actor.source !== "local_implicit" && !actor.isInstanceAdmin) {
    throw new ForbiddenException("Instance admin required");
  }
}

export function assertWorkspaceAccess(req: Request & { actor?: Actor }, workspaceId: string) {
  const actor = getActor(req);

  if (actor.type === "none") {
    throw new UnauthorizedException("Unauthorized");
  }

  if (actor.type === "agent") {
    if (actor.workspaceId !== workspaceId) {
      throw new ForbiddenException("Agent key cannot access another workspace");
    }
    return;
  }

  if (actor.source !== "local_implicit" && !actor.isInstanceAdmin) {
    const allowed = actor.workspaceIds ?? [];
    if (!allowed.includes(workspaceId)) {
      throw new ForbiddenException("User does not have access to this workspace");
    }
  }
}

export function assertCanManageOrgChart(req: Request & { actor?: Actor }, workspaceId: string) {
  assertWorkspaceAccess(req, workspaceId);
}

export function getActorInfo(req: Request & { actor?: Actor }) {
  const actor = getActor(req);

  if (actor.type === "none") {
    throw new UnauthorizedException("Unauthorized");
  }

  if (actor.type === "agent") {
    return {
      actorType: "agent" as const,
      actorId: actor.agentId ?? "unknown-agent",
      agentId: actor.agentId ?? null,
      runId: actor.runId ?? null,
    };
  }

  return {
    actorType: "user" as const,
    actorId: actor.userId ?? "board",
    agentId: null,
    runId: actor.runId ?? null,
  };
}

export function companiesIssuesMalformedCompanyId(req: Request) {
  if (req.params?.companyId !== undefined) {
    throw new BadRequestException(
      "Missing workspace id in path. Use /api/workspaces/{workspaceId}/issues (or legacy /api/companies/{companyId}/issues).",
    );
  }
}
