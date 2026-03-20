import { BadRequestException, Controller, ForbiddenException, Get, Inject, Param, Patch, Post, Put, Req, Res, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Request, Response } from "express";
import type { Db } from "@paperclipai/db";
import { agentApiKeys, authUsers, invites, joinRequests } from "@paperclipai/db";
import { claimBoardOwnership, inspectBoardClaimChallenge } from "@paperclipai/server/board-claim";
import { accessService } from "@paperclipai/server/services/access";
import { agentService, deduplicateAgentName } from "@paperclipai/server/services/agents";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { PERMISSION_KEYS, isUuidLike, listJoinRequestsQuerySchema } from "@paperclipai/shared";
import {
  buildInviteOnboardingManifest,
  buildInviteOnboardingTextDocument,
  buildJoinDefaultsPayloadForAccept,
  canReplayOpenClawGatewayInviteAccept,
  mergeJoinDefaultsPayloadForReplay,
  normalizeAgentDefaultsForJoin,
  toInviteSummaryResponse,
} from "@paperclipai/server/routes/access";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess } from "../auth/authz.js";
import { ConfigService } from "../config/config.service.js";
import { DB } from "../db/db.module.js";
import { acceptInviteSchema } from "@paperclipai/shared";

function assertAdminUserIdParam(raw: string): string {
  const userId = raw.trim();
  if (!isUuidLike(userId)) {
    throw new BadRequestException("userId must be a UUID");
  }
  return userId;
}

type SkillEntry = { name: string; path: string };
type CompanyPermissionKey =
  | "agents:create"
  | "users:invite"
  | "users:manage_permissions"
  | "tasks:assign"
  | "tasks:assign_scope"
  | "joins:approve";

function getSkillsDir() {
  return join(process.cwd(), "server", "skills");
}

function listAvailableSkills(): SkillEntry[] {
  const skillsDir = getSkillsDir();
  const files = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".md")
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  return files.map((name) => {
    const skillName = name.slice(0, -3).toLowerCase();
    return {
      name: skillName,
      path: `/api/skills/${skillName}`,
    };
  });
}

function readSkillMarkdown(skillName: string): string | null {
  const normalized = skillName.trim().toLowerCase();
  if (!normalized) return null;
  const filePath = join(getSkillsDir(), `${normalized}.md`);
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenHashesMatch(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

function requestBaseUrl(req: Request) {
  const protocol = req.protocol || "http";
  const host = req.get("host");
  if (!host) return null;
  return `${protocol}://${host}`;
}

function inviteExpired(invite: typeof invites.$inferSelect) {
  return invite.expiresAt.getTime() <= Date.now();
}

function createClaimSecret() {
  return `pcp_claim_${randomBytes(24).toString("hex")}`;
}

@Controller()
export class AccessController {
  private readonly access;
  private readonly agents;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    this.access = accessService(db);
    this.agents = agentService(db);
  }

  private assertBoardActor(req: Request & { actor?: Actor }) {
    if (req.actor?.type !== "board") {
      throw new UnauthorizedException("Board access required");
    }
  }

  private async assertInstanceAdmin(req: Request & { actor?: Actor }) {
    this.assertBoardActor(req);
    const actor = req.actor;
    if (!actor || actor.type !== "board") throw new UnauthorizedException("Board access required");
    if (actor.source === "local_implicit" || actor.isInstanceAdmin) return;
    const allowed = await this.access.isInstanceAdmin(actor.userId);
    if (!allowed) throw new ForbiddenException("Instance admin required");
  }

  private async assertCompanyPermission(
    req: Request & { actor?: Actor },
    companyId: string,
    permissionKey: CompanyPermissionKey,
  ) {
    assertCompanyAccess(req, companyId);
    this.assertBoardActor(req);
    const actor = req.actor;
    if (!actor || actor.type !== "board") throw new UnauthorizedException("Board access required");
    if (actor.source === "local_implicit" || actor.isInstanceAdmin) return;
    const allowed = await this.access.canUser(companyId, actor.userId, permissionKey);
    if (!allowed) throw new ForbiddenException("Missing permission");
  }

  private toJoinRequestResponse(row: typeof joinRequests.$inferSelect) {
    const { claimSecretHash: _claimSecretHash, ...safe } = row;
    return safe;
  }

  private requestIp(req: Request) {
    const forwarded = req.header("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
    return req.ip || "unknown";
  }

  private isLocalImplicit(req: Request & { actor?: Actor }) {
    return req.actor?.type === "board" && req.actor.source === "local_implicit";
  }

  private async resolveActorEmail(req: Request & { actor?: Actor }): Promise<string | null> {
    if (this.isLocalImplicit(req)) return "local@paperclip.local";
    if (req.actor?.type !== "board" || !req.actor.userId) return null;
    const user = await this.db
      .select({ email: authUsers.email })
      .from(authUsers)
      .where(eq(authUsers.id, req.actor.userId))
      .then((rows) => rows[0] ?? null);
    return user?.email ?? null;
  }

  private grantsFromDefaults(
    defaultsPayload: Record<string, unknown> | null | undefined,
    key: "human" | "agent",
  ): Array<{
    permissionKey: (typeof PERMISSION_KEYS)[number];
    scope: Record<string, unknown> | null;
  }> {
    if (!defaultsPayload || typeof defaultsPayload !== "object") return [];
    const scoped = defaultsPayload[key];
    if (!scoped || typeof scoped !== "object") return [];
    const grants = (scoped as Record<string, unknown>).grants;
    if (!Array.isArray(grants)) return [];
    const validPermissionKeys = new Set<string>(PERMISSION_KEYS);
    const result: Array<{
      permissionKey: (typeof PERMISSION_KEYS)[number];
      scope: Record<string, unknown> | null;
    }> = [];
    for (const item of grants) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (typeof record.permissionKey !== "string") continue;
      if (!validPermissionKeys.has(record.permissionKey)) continue;
      result.push({
        permissionKey: record.permissionKey as (typeof PERMISSION_KEYS)[number],
        scope:
          record.scope &&
          typeof record.scope === "object" &&
          !Array.isArray(record.scope)
            ? (record.scope as Record<string, unknown>)
            : null,
      });
    }
    return result;
  }

  private resolveJoinRequestAgentManagerId(
    candidates: Array<{ id: string; role: string; reportsTo: string | null }>,
  ): string | null {
    const ceoCandidates = candidates.filter((candidate) => candidate.role === "ceo");
    if (ceoCandidates.length === 0) return null;
    const rootCeo = ceoCandidates.find((candidate) => candidate.reportsTo === null);
    return (rootCeo ?? ceoCandidates[0] ?? null)?.id ?? null;
  }

  @Get("board-claim/:token")
  inspectBoardClaim(
    @Param("token") token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const trimmed = token.trim();
    const code = typeof req.query.code === "string" ? req.query.code.trim() : undefined;
    if (!trimmed) {
      return res.status(404).json({ error: "Board claim challenge not found" });
    }
    const challenge = inspectBoardClaimChallenge(trimmed, code);
    if (challenge.status === "invalid") {
      return res.status(404).json({ error: "Board claim challenge not found" });
    }
    return res.json(challenge);
  }

  @Post("board-claim/:token/claim")
  async claimBoard(
    @Param("token") token: string,
    @Req() req: Request & { actor?: Actor },
    @Res() res: Response,
  ) {
    const trimmed = token.trim();
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : undefined;
    if (!trimmed) {
      return res.status(404).json({ error: "Board claim challenge not found" });
    }
    if (!code) {
      throw new BadRequestException("Claim code is required");
    }
    if (
      req.actor?.type !== "board" ||
      req.actor.source !== "session" ||
      !req.actor.userId
    ) {
      throw new UnauthorizedException("Sign in before claiming board ownership");
    }

    const claimed = await claimBoardOwnership(this.db, {
      token: trimmed,
      code,
      userId: req.actor.userId,
    });

    if (claimed.status === "invalid") {
      return res.status(404).json({ error: "Board claim challenge not found" });
    }
    if (claimed.status === "expired") {
      return res.status(409).json({
        error: "Board claim challenge expired. Restart server to generate a new one.",
      });
    }
    if (claimed.status === "claimed") {
      return res.json({
        claimed: true,
        userId: claimed.claimedByUserId ?? req.actor.userId,
      });
    }
    return res.json({ claimed: false });
  }

  @Get("skills/available")
  getSkillsAvailable(@Res() res: Response) {
    return res.json({ skills: listAvailableSkills() });
  }

  @Get("skills/index")
  getSkillsIndex(@Res() res: Response) {
    return res.json({
      skills: listAvailableSkills(),
    });
  }

  @Get("skills/:skillName")
  getSkillMarkdown(@Param("skillName") skillName: string, @Res() res: Response) {
    const markdown = readSkillMarkdown(skillName);
    if (!markdown) {
      return res.status(404).json({ error: "Skill not found" });
    }
    return res.type("text/markdown").send(markdown);
  }

  @Get("invites/:token")
  async getInviteSummary(
    @Req() req: Request,
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    const trimmed = token.trim();
    if (!trimmed) return res.status(404).json({ error: "Invite not found" });
    const invite = await this.db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(trimmed)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || invite.acceptedAt || inviteExpired(invite)) {
      return res.status(404).json({ error: "Invite not found" });
    }
    return res.json(toInviteSummaryResponse(req, trimmed, invite));
  }

  @Get("invites/:token/onboarding")
  async getInviteOnboarding(
    @Req() req: Request,
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    const trimmed = token.trim();
    if (!trimmed) return res.status(404).json({ error: "Invite not found" });
    const invite = await this.db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(trimmed)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || inviteExpired(invite)) {
      return res.status(404).json({ error: "Invite not found" });
    }
    return res.json(
      buildInviteOnboardingManifest(req, trimmed, invite, {
        deploymentMode: this.config.deploymentMode,
        deploymentExposure: this.config.deploymentExposure,
        bindHost: this.config.host,
        allowedHostnames: this.config.allowedHostnames,
      }),
    );
  }

  @Get("invites/:token/onboarding.txt")
  async getInviteOnboardingText(
    @Req() req: Request,
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    const trimmed = token.trim();
    if (!trimmed) return res.status(404).json({ error: "Invite not found" });
    const invite = await this.db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(trimmed)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || inviteExpired(invite)) {
      return res.status(404).json({ error: "Invite not found" });
    }
    return res
      .type("text/plain; charset=utf-8")
      .send(
        buildInviteOnboardingTextDocument(req, trimmed, invite, {
          deploymentMode: this.config.deploymentMode,
          deploymentExposure: this.config.deploymentExposure,
          bindHost: this.config.host,
          allowedHostnames: this.config.allowedHostnames,
        }),
      );
  }

  @Get("invites/:token/test-resolution")
  async testInviteResolution(
    @Req() req: Request,
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    const trimmed = token.trim();
    if (!trimmed) return res.status(404).json({ error: "Invite not found" });
    const invite = await this.db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(trimmed)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || inviteExpired(invite)) {
      return res.status(404).json({ error: "Invite not found" });
    }

    const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!rawUrl) throw new BadRequestException("url query parameter is required");
    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      throw new BadRequestException("url must be an absolute http(s) URL");
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new BadRequestException("url must use http or https");
    }
    const parsedTimeoutMs =
      typeof req.query.timeoutMs === "string" ? Number(req.query.timeoutMs) : NaN;
    const timeoutMs = Number.isFinite(parsedTimeoutMs)
      ? Math.max(1000, Math.min(15000, Math.floor(parsedTimeoutMs)))
      : 5000;
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target, {
        method: "HEAD",
        signal: controller.signal,
      });
      return res.json({
        inviteId: invite.id,
        testResolutionPath: `/api/invites/${trimmed}/test-resolution`,
        requestedUrl: target.toString(),
        timeoutMs,
        status: "reachable",
        method: "HEAD",
        durationMs: Date.now() - started,
        httpStatus: response.status,
        message: "Target is reachable",
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      return res.json({
        inviteId: invite.id,
        testResolutionPath: `/api/invites/${trimmed}/test-resolution`,
        requestedUrl: target.toString(),
        timeoutMs,
        status: timedOut ? "timeout" : "unreachable",
        method: "HEAD",
        durationMs: Date.now() - started,
        httpStatus: null,
        message: timedOut ? "Resolution probe timed out" : (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  @Post("invites/:token/accept")
  async acceptInvite(
    @Req() req: Request & { actor?: Actor },
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    const trimmed = token.trim();
    if (!trimmed) return res.status(404).json({ error: "Invite not found" });

    const body = acceptInviteSchema.parse(req.body);
    const invite = await this.db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(trimmed)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || inviteExpired(invite)) {
      return res.status(404).json({ error: "Invite not found" });
    }

    const inviteAlreadyAccepted = Boolean(invite.acceptedAt);
    const existingJoinRequestForInvite = inviteAlreadyAccepted
      ? await this.db
          .select()
          .from(joinRequests)
          .where(eq(joinRequests.inviteId, invite.id))
          .then((rows) => rows[0] ?? null)
      : null;

    if (invite.inviteType === "bootstrap_ceo") {
      if (inviteAlreadyAccepted) return res.status(404).json({ error: "Invite not found" });
      if (body.requestType !== "human") {
        throw new BadRequestException("Bootstrap invite requires human request type");
      }
      if (
        req.actor?.type !== "board" ||
        (!req.actor.userId && !this.isLocalImplicit(req))
      ) {
        throw new UnauthorizedException("Authenticated user required for bootstrap acceptance");
      }
      const userId = req.actor.userId ?? "local-board";
      const existingAdmin = await this.access.isInstanceAdmin(userId);
      if (!existingAdmin) {
        await this.access.promoteInstanceAdmin(userId);
      }
      const updatedInvite = await this.db
        .update(invites)
        .set({ acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(invites.id, invite.id))
        .returning()
        .then((rows) => rows[0] ?? invite);
      return res.status(202).json({
        inviteId: updatedInvite.id,
        inviteType: updatedInvite.inviteType,
        bootstrapAccepted: true,
        userId,
      });
    }

    const requestType = body.requestType;
    const companyId = invite.companyId;
    if (!companyId) return res.status(409).json({ error: "Invite is missing company scope" });
    if (invite.allowedJoinTypes !== "both" && invite.allowedJoinTypes !== requestType) {
      throw new BadRequestException(`Invite does not allow ${requestType} joins`);
    }
    if (requestType === "human" && req.actor?.type !== "board") {
      throw new UnauthorizedException("Human invite acceptance requires authenticated user");
    }
    const boardUserIdForHuman = req.actor?.type === "board" ? req.actor.userId : null;
    if (requestType === "human" && !boardUserIdForHuman && !this.isLocalImplicit(req)) {
      throw new UnauthorizedException("Authenticated user is required");
    }
    if (requestType === "agent" && !body.agentName) {
      if (!inviteAlreadyAccepted || !existingJoinRequestForInvite?.agentName) {
        throw new BadRequestException("agentName is required for agent join requests");
      }
    }

    const adapterType = body.adapterType ?? null;
    if (
      inviteAlreadyAccepted &&
      !canReplayOpenClawGatewayInviteAccept({
        requestType,
        adapterType,
        existingJoinRequest: existingJoinRequestForInvite,
      })
    ) {
      return res.status(404).json({ error: "Invite not found" });
    }

    const replayJoinRequestId = inviteAlreadyAccepted
      ? existingJoinRequestForInvite?.id ?? null
      : null;
    if (inviteAlreadyAccepted && !replayJoinRequestId) {
      return res.status(409).json({ error: "Join request not found" });
    }

    const replayMergedDefaults = inviteAlreadyAccepted
      ? mergeJoinDefaultsPayloadForReplay(
          existingJoinRequestForInvite?.agentDefaultsPayload ?? null,
          body.agentDefaultsPayload ?? null,
        )
      : body.agentDefaultsPayload ?? null;

    const gatewayDefaultsPayload = requestType === "agent"
      ? buildJoinDefaultsPayloadForAccept({
          adapterType,
          defaultsPayload: replayMergedDefaults,
          paperclipApiUrl: body.paperclipApiUrl ?? null,
          inboundOpenClawAuthHeader: req.header("x-openclaw-auth") ?? null,
          inboundOpenClawTokenHeader: req.header("x-openclaw-token") ?? null,
        })
      : null;

    const joinDefaults = requestType === "agent"
      ? normalizeAgentDefaultsForJoin({
          adapterType,
          defaultsPayload: gatewayDefaultsPayload,
          deploymentMode: this.config.deploymentMode,
          deploymentExposure: this.config.deploymentExposure,
          bindHost: this.config.host,
          allowedHostnames: this.config.allowedHostnames,
        })
      : {
          normalized: null as Record<string, unknown> | null,
          diagnostics: [],
          fatalErrors: [],
        };

    if (requestType === "agent" && joinDefaults.fatalErrors.length > 0) {
      throw new BadRequestException(joinDefaults.fatalErrors.join("; "));
    }

    const claimSecret = requestType === "agent" && !inviteAlreadyAccepted
      ? createClaimSecret()
      : null;
    const claimSecretHash = claimSecret ? hashToken(claimSecret) : null;
    const claimSecretExpiresAt = claimSecret
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : null;

    const actorEmail = requestType === "human" ? await this.resolveActorEmail(req) : null;
    const created = !inviteAlreadyAccepted
      ? await this.db.transaction(async (tx) => {
          await tx
            .update(invites)
            .set({ acceptedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt), isNull(invites.revokedAt)));

          return tx
            .insert(joinRequests)
            .values({
              inviteId: invite.id,
              companyId,
              requestType,
              status: "pending_approval",
              requestIp: this.requestIp(req),
              requestingUserId:
                requestType === "human"
                  ? boardUserIdForHuman ?? "local-board"
                  : null,
              requestEmailSnapshot:
                requestType === "human" ? actorEmail : null,
              agentName: requestType === "agent" ? body.agentName : null,
              adapterType: requestType === "agent" ? adapterType : null,
              capabilities:
                requestType === "agent"
                  ? body.capabilities ?? null
                  : null,
              agentDefaultsPayload:
                requestType === "agent" ? joinDefaults.normalized : null,
              claimSecretHash,
              claimSecretExpiresAt,
            })
            .returning()
            .then((rows) => rows[0]);
        })
      : await this.db
          .update(joinRequests)
          .set({
            requestIp: this.requestIp(req),
            agentName:
              requestType === "agent"
                ? body.agentName ?? existingJoinRequestForInvite?.agentName ?? null
                : null,
            capabilities:
              requestType === "agent"
                ? body.capabilities ?? existingJoinRequestForInvite?.capabilities ?? null
                : null,
            adapterType: requestType === "agent" ? adapterType : null,
            agentDefaultsPayload:
              requestType === "agent" ? joinDefaults.normalized : null,
            updatedAt: new Date(),
          })
          .where(eq(joinRequests.id, replayJoinRequestId as string))
          .returning()
          .then((rows) => rows[0] ?? null);

    if (!created) return res.status(409).json({ error: "Join request not found" });

    if (
      inviteAlreadyAccepted &&
      requestType === "agent" &&
      adapterType === "openclaw_gateway" &&
      created.status === "approved" &&
      created.createdAgentId
    ) {
      const existingAgent = await this.agents.getById(created.createdAgentId);
      if (!existingAgent) return res.status(409).json({ error: "Approved join request agent not found" });
      const existingAdapterConfig =
        existingAgent.adapterConfig &&
        typeof existingAgent.adapterConfig === "object" &&
        !Array.isArray(existingAgent.adapterConfig)
          ? (existingAgent.adapterConfig as Record<string, unknown>)
          : {};
      const nextAdapterConfig = {
        ...existingAdapterConfig,
        ...(joinDefaults.normalized ?? {}),
      };
      const updatedAgent = await this.agents.update(created.createdAgentId, {
        adapterType,
        adapterConfig: nextAdapterConfig,
      });
      if (!updatedAgent) return res.status(409).json({ error: "Approved join request agent not found" });
      await logActivity(this.db, {
        companyId,
        actorType: req.actor?.type === "agent" ? "agent" : "user",
        actorId:
          req.actor?.type === "agent"
            ? req.actor.agentId ?? "invite-agent"
            : boardUserIdForHuman ?? "board",
        action: "agent.updated_from_join_replay",
        entityType: "agent",
        entityId: updatedAgent.id,
        details: { inviteId: invite.id, joinRequestId: created.id },
      });
    }

    await logActivity(this.db, {
      companyId,
      actorType: req.actor?.type === "agent" ? "agent" : "user",
      actorId:
        req.actor?.type === "agent"
          ? req.actor.agentId ?? "invite-agent"
          : boardUserIdForHuman ?? (requestType === "agent" ? "invite-anon" : "board"),
      action: inviteAlreadyAccepted ? "join.request_replayed" : "join.requested",
      entityType: "join_request",
      entityId: created.id,
      details: {
        requestType,
        requestIp: created.requestIp,
        inviteReplay: inviteAlreadyAccepted,
      },
    });

    const response = this.toJoinRequestResponse(created);
    if (claimSecret) {
      const onboardingManifest = buildInviteOnboardingManifest(req, trimmed, invite, {
        deploymentMode: this.config.deploymentMode,
        deploymentExposure: this.config.deploymentExposure,
        bindHost: this.config.host,
        allowedHostnames: this.config.allowedHostnames,
      });
      return res.status(202).json({
        ...response,
        claimSecret,
        claimApiKeyPath: `/api/join-requests/${created.id}/claim-api-key`,
        onboarding: onboardingManifest.onboarding,
        diagnostics: joinDefaults.diagnostics,
      });
    }

    return res.status(202).json({
      ...response,
      ...(joinDefaults.diagnostics.length > 0 ? { diagnostics: joinDefaults.diagnostics } : {}),
    });
  }

  @Get("companies/:companyId/members")
  async listMembers(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    await this.assertCompanyPermission(req, companyId, "users:manage_permissions");
    const members = await this.access.listMembers(companyId);
    return res.json(members);
  }

  @Post("invites/:inviteId/revoke")
  async revokeInvite(
    @Req() req: Request & { actor?: Actor },
    @Param("inviteId") inviteId: string,
    @Res() res: Response,
  ) {
    const invite = await this.db
      .select()
      .from(invites)
      .where(eq(invites.id, inviteId))
      .then((rows) => rows[0] ?? null);
    if (!invite) return res.status(404).json({ error: "Invite not found" });

    if (invite.inviteType === "bootstrap_ceo") {
      await this.assertInstanceAdmin(req);
    } else {
      if (!invite.companyId) return res.status(409).json({ error: "Invite is missing company scope" });
      await this.assertCompanyPermission(req, invite.companyId, "users:invite");
    }
    if (invite.acceptedAt) return res.status(409).json({ error: "Invite already consumed" });
    if (invite.revokedAt) return res.json(invite);

    const revoked = await this.db
      .update(invites)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(invites.id, inviteId))
      .returning()
      .then((rows) => rows[0]);

    if (invite.companyId) {
      await logActivity(this.db, {
        companyId: invite.companyId,
        actorType: req.actor?.type === "agent" ? "agent" : "user",
        actorId:
          req.actor?.type === "agent"
            ? req.actor.agentId ?? "unknown-agent"
            : req.actor?.type === "board"
              ? req.actor.userId ?? "board"
              : "board",
        action: "invite.revoked",
        entityType: "invite",
        entityId: inviteId,
      });
    }

    return res.json(revoked);
  }

  @Get("companies/:companyId/join-requests")
  async listJoinRequests(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    await this.assertCompanyPermission(req, companyId, "joins:approve");
    const query = listJoinRequestsQuerySchema.parse(req.query);
    const all = await this.db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.companyId, companyId))
      .orderBy(desc(joinRequests.createdAt));
    const filtered = all.filter((row) => {
      if (query.status && row.status !== query.status) return false;
      if (query.requestType && row.requestType !== query.requestType) return false;
      return true;
    });
    return res.json(filtered.map((row) => this.toJoinRequestResponse(row)));
  }

  @Post("companies/:companyId/join-requests/:requestId/approve")
  async approveJoinRequest(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("requestId") requestId: string,
    @Res() res: Response,
  ) {
    await this.assertCompanyPermission(req, companyId, "joins:approve");
    const actor = req.actor as Extract<Actor, { type: "board" }>;

    const existing = await this.db
      .select()
      .from(joinRequests)
      .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.id, requestId)))
      .then((rows) => rows[0] ?? null);
    if (!existing) return res.status(404).json({ error: "Join request not found" });
    if (existing.status !== "pending_approval") return res.status(409).json({ error: "Join request is not pending" });

    const invite = await this.db
      .select()
      .from(invites)
      .where(eq(invites.id, existing.inviteId))
      .then((rows) => rows[0] ?? null);
    if (!invite) return res.status(404).json({ error: "Invite not found" });

    let createdAgentId: string | null = existing.createdAgentId ?? null;
    if (existing.requestType === "human") {
      if (!existing.requestingUserId) return res.status(409).json({ error: "Join request missing user identity" });
      await this.access.ensureMembership(
        companyId,
        "user",
        existing.requestingUserId,
        "member",
        "active",
      );
      const grants = this.grantsFromDefaults(
        invite.defaultsPayload as Record<string, unknown> | null,
        "human",
      );
      await this.access.setPrincipalGrants(
        companyId,
        "user",
        existing.requestingUserId,
        grants,
        actor.userId ?? null,
      );
    } else {
      const existingAgents = await this.agents.list(companyId);
      const managerId = this.resolveJoinRequestAgentManagerId(existingAgents);
      if (!managerId) {
        return res.status(409).json({ error: "Join request cannot be approved because this company has no active CEO" });
      }
      const agentName = deduplicateAgentName(
        existing.agentName ?? "New Agent",
        existingAgents.map((a) => ({ id: a.id, name: a.name, status: a.status })),
      );
      const created = await this.agents.create(companyId, {
        name: agentName,
        role: "general",
        title: null,
        status: "idle",
        reportsTo: managerId,
        capabilities: existing.capabilities ?? null,
        adapterType: existing.adapterType ?? "process",
        adapterConfig:
          existing.agentDefaultsPayload &&
          typeof existing.agentDefaultsPayload === "object"
            ? (existing.agentDefaultsPayload as Record<string, unknown>)
            : {},
        runtimeConfig: {},
        budgetMonthlyCents: 0,
        spentMonthlyCents: 0,
        permissions: {},
        lastHeartbeatAt: null,
        metadata: null,
      });
      createdAgentId = created.id;
      await this.access.ensureMembership(companyId, "agent", created.id, "member", "active");
      const grants = this.grantsFromDefaults(
        invite.defaultsPayload as Record<string, unknown> | null,
        "agent",
      );
      await this.access.setPrincipalGrants(
        companyId,
        "agent",
        created.id,
        grants,
        actor.userId ?? null,
      );
    }

    const approved = await this.db
      .update(joinRequests)
      .set({
        status: "approved",
        approvedByUserId: actor.userId ?? (actor.source === "local_implicit" ? "local-board" : null),
        approvedAt: new Date(),
        createdAgentId,
        updatedAt: new Date(),
      })
      .where(eq(joinRequests.id, requestId))
      .returning()
      .then((rows) => rows[0]);

    await logActivity(this.db, {
      companyId,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "join.approved",
      entityType: "join_request",
      entityId: requestId,
      details: { requestType: existing.requestType, createdAgentId },
    });
    return res.json(this.toJoinRequestResponse(approved));
  }

  @Post("companies/:companyId/join-requests/:requestId/reject")
  async rejectJoinRequest(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("requestId") requestId: string,
    @Res() res: Response,
  ) {
    await this.assertCompanyPermission(req, companyId, "joins:approve");
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    const existing = await this.db
      .select()
      .from(joinRequests)
      .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.id, requestId)))
      .then((rows) => rows[0] ?? null);
    if (!existing) return res.status(404).json({ error: "Join request not found" });
    if (existing.status !== "pending_approval") return res.status(409).json({ error: "Join request is not pending" });

    const rejected = await this.db
      .update(joinRequests)
      .set({
        status: "rejected",
        rejectedByUserId: actor.userId ?? (actor.source === "local_implicit" ? "local-board" : null),
        rejectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(joinRequests.id, requestId))
      .returning()
      .then((rows) => rows[0]);
    await logActivity(this.db, {
      companyId,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "join.rejected",
      entityType: "join_request",
      entityId: requestId,
      details: { requestType: existing.requestType },
    });
    return res.json(this.toJoinRequestResponse(rejected));
  }

  @Post("join-requests/:requestId/claim-api-key")
  async claimJoinRequestApiKey(
    @Param("requestId") requestId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const body = req.body as { claimSecret?: string };
    if (!body.claimSecret || typeof body.claimSecret !== "string") {
      throw new BadRequestException("claimSecret is required");
    }
    const presentedClaimSecretHash = hashToken(body.claimSecret);
    const joinRequest = await this.db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, requestId))
      .then((rows) => rows[0] ?? null);
    if (!joinRequest) return res.status(404).json({ error: "Join request not found" });
    if (joinRequest.requestType !== "agent") {
      return res.status(400).json({ error: "Only agent join requests can claim API keys" });
    }
    if (joinRequest.status !== "approved") {
      return res.status(409).json({ error: "Join request must be approved before key claim" });
    }
    if (!joinRequest.createdAgentId) {
      return res.status(409).json({ error: "Join request has no created agent" });
    }
    if (!joinRequest.claimSecretHash) {
      return res.status(409).json({ error: "Join request is missing claim secret metadata" });
    }
    if (!tokenHashesMatch(joinRequest.claimSecretHash, presentedClaimSecretHash)) {
      return res.status(403).json({ error: "Invalid claim secret" });
    }
    if (joinRequest.claimSecretExpiresAt && joinRequest.claimSecretExpiresAt.getTime() <= Date.now()) {
      return res.status(409).json({ error: "Claim secret expired" });
    }
    if (joinRequest.claimSecretConsumedAt) {
      return res.status(409).json({ error: "Claim secret already used" });
    }

    const existingKey = await this.db
      .select({ id: agentApiKeys.id })
      .from(agentApiKeys)
      .where(eq(agentApiKeys.agentId, joinRequest.createdAgentId))
      .then((rows) => rows[0] ?? null);
    if (existingKey) {
      return res.status(409).json({ error: "API key already claimed" });
    }

    const consumed = await this.db
      .update(joinRequests)
      .set({ claimSecretConsumedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(joinRequests.id, requestId), isNull(joinRequests.claimSecretConsumedAt)))
      .returning({ id: joinRequests.id })
      .then((rows) => rows[0] ?? null);
    if (!consumed) {
      return res.status(409).json({ error: "Claim secret already used" });
    }

    const created = await this.agents.createApiKey(
      joinRequest.createdAgentId,
      "initial-join-key",
    );
    await logActivity(this.db, {
      companyId: joinRequest.companyId,
      actorType: "system",
      actorId: "join-claim",
      action: "agent_api_key.claimed",
      entityType: "agent_api_key",
      entityId: created.id,
      details: {
        agentId: joinRequest.createdAgentId,
        joinRequestId: requestId,
      },
    });
    return res.status(201).json({
      keyId: created.id,
      token: created.token,
      agentId: joinRequest.createdAgentId,
      createdAt: created.createdAt,
    });
  }

  @Patch("companies/:companyId/members/:memberId/permissions")
  async setMemberPermissions(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("memberId") memberId: string,
    @Res() res: Response,
  ) {
    await this.assertCompanyPermission(req, companyId, "users:manage_permissions");
    const body = req.body as { grants?: unknown[] };
    const updated = await this.access.setMemberPermissions(
      companyId,
      memberId,
      (body.grants as any[]) ?? [],
      req.actor?.type === "board" ? req.actor.userId ?? null : null,
    );
    if (!updated) {
      return res.status(404).json({ error: "Member not found" });
    }
    return res.json(updated);
  }

  @Post("admin/users/:userId/promote-instance-admin")
  async promoteInstanceAdmin(
    @Req() req: Request & { actor?: Actor },
    @Param("userId") userId: string,
    @Res() res: Response,
  ) {
    await this.assertInstanceAdmin(req);
    const id = assertAdminUserIdParam(userId);
    const result = await this.access.promoteInstanceAdmin(id);
    return res.status(201).json(result);
  }

  @Post("admin/users/:userId/demote-instance-admin")
  async demoteInstanceAdmin(
    @Req() req: Request & { actor?: Actor },
    @Param("userId") userId: string,
    @Res() res: Response,
  ) {
    await this.assertInstanceAdmin(req);
    const id = assertAdminUserIdParam(userId);
    const removed = await this.access.demoteInstanceAdmin(id);
    if (!removed) {
      return res.status(404).json({ error: "Instance admin role not found" });
    }
    return res.json(removed);
  }

  @Get("admin/users/:userId/company-access")
  async listUserCompanyAccess(
    @Req() req: Request & { actor?: Actor },
    @Param("userId") userId: string,
    @Res() res: Response,
  ) {
    await this.assertInstanceAdmin(req);
    const id = assertAdminUserIdParam(userId);
    const memberships = await this.access.listUserCompanyAccess(id);
    return res.json(memberships);
  }

  @Put("admin/users/:userId/company-access")
  async setUserCompanyAccess(
    @Req() req: Request & { actor?: Actor },
    @Param("userId") userId: string,
    @Res() res: Response,
  ) {
    await this.assertInstanceAdmin(req);
    const id = assertAdminUserIdParam(userId);
    const body = req.body as { companyIds?: string[] };
    const memberships = await this.access.setUserCompanyAccess(
      id,
      body.companyIds ?? [],
    );
    return res.json(memberships);
  }
}
