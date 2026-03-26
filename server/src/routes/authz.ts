import type { Request } from "express";
import { forbidden, unauthorized } from "../errors.js";

export function assertBoard(req: Request) {
  if (req.actor.type !== "board") {
    throw forbidden("Board access required");
  }
}

export function assertWorkspaceAccess(req: Request, workspaceId: string) {
  if (req.actor.type === "none") {
    throw unauthorized();
  }
  if (req.actor.type === "agent" && req.actor.workspaceId !== workspaceId) {
    throw forbidden("Agent key cannot access another workspace");
  }
  if (req.actor.type === "board" && req.actor.source !== "local_implicit" && !req.actor.isInstanceAdmin) {
    const allowed = req.actor.workspaceIds ?? [];
    if (!allowed.includes(workspaceId)) {
      throw forbidden("User does not have access to this workspace");
    }
  }
}

export function assertCanManageOrgChart(req: Request, workspaceId: string) {
  assertWorkspaceAccess(req, workspaceId);
}

export function getActorInfo(req: Request) {
  if (req.actor.type === "none") {
    throw unauthorized();
  }
  if (req.actor.type === "agent") {
    return {
      actorType: "agent" as const,
      actorId: req.actor.agentId ?? "unknown-agent",
      agentId: req.actor.agentId ?? null,
      runId: req.actor.runId ?? null,
    };
  }

  return {
    actorType: "user" as const,
    actorId: req.actor.userId ?? "board",
    agentId: null,
    runId: req.actor.runId ?? null,
  };
}
