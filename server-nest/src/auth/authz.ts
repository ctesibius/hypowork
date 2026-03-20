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

export function assertCompanyAccess(req: Request & { actor?: Actor }, companyId: string) {
  const actor = getActor(req);

  if (actor.type === "none") {
    throw new UnauthorizedException("Unauthorized");
  }

  if (actor.type === "agent") {
    if (actor.companyId !== companyId) {
      throw new ForbiddenException("Agent key cannot access another company");
    }
    return;
  }

  // actor.type === "board"
  if (actor.source !== "local_implicit" && !actor.isInstanceAdmin) {
    const allowedCompanies = actor.companyIds ?? [];
    if (!allowedCompanies.includes(companyId)) {
      throw new ForbiddenException("User does not have access to this company");
    }
  }
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

// For now we mirror the Express route behavior that sends a custom 400 for `/issues`.
export function companiesIssuesMalformedCompanyId(req: Request) {
  if (req.params?.companyId !== undefined) {
    throw new BadRequestException("Missing companyId in path. Use /api/companies/{companyId}/issues.");
  }
}

