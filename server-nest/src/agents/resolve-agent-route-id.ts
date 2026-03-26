import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Request } from "express";
import { isUuidLike } from "@paperclipai/shared";
import type { Actor } from "../auth/actor.guard.js";
import { assertWorkspaceAccess } from "../auth/authz.js";

type ResolveByRef = (companyId: string, reference: string) => Promise<{
  agent: { id: string } | null;
  ambiguous: boolean;
}>;

/**
 * Matches Express `normalizeAgentReference` in `server/src/routes/agents.ts` (via `router.param("id")`).
 */
export async function resolveAgentRouteParamId(
  svc: { resolveByReference: ResolveByRef },
  req: Request & { actor?: Actor },
  rawId: string,
): Promise<string> {
  const raw = rawId.trim();
  if (isUuidLike(raw)) return raw;

  const q = req.query?.companyId;
  const queryCompanyId = typeof q === "string" && q.trim().length > 0 ? q.trim() : null;
  const actorCompanyId =
    req.actor?.type === "agent" && req.actor.workspaceId ? req.actor.workspaceId : null;
  const companyId = queryCompanyId ?? actorCompanyId;
  if (!companyId) {
    throw new UnprocessableEntityException(
      "Agent shortname lookup requires companyId query parameter",
    );
  }
  assertWorkspaceAccess(req, companyId);
  const resolved = await svc.resolveByReference(companyId, raw);
  if (resolved.ambiguous) {
    throw new ConflictException(
      "Agent shortname is ambiguous in this company. Use the agent ID.",
    );
  }
  if (!resolved.agent) {
    throw new NotFoundException("Agent not found");
  }
  return resolved.agent.id;
}
