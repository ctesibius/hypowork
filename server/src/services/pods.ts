import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, pods } from "@paperclipai/db";
import { notFound } from "../errors.js";
import { logActivity } from "./activity-log.js";

type PodRow = typeof pods.$inferSelect;

export type PodServiceHooks = {
  onPodActivated?: (podId: string) => Promise<void>;
  onPodDeactivated?: (podId: string) => Promise<void>;
};

export function podsService(db: Db, hooks: PodServiceHooks = {}) {
  async function getById(id: string): Promise<PodRow | null> {
    return db
      .select()
      .from(pods)
      .where(eq(pods.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function listByCompany(companyId: string): Promise<PodRow[]> {
    return db
      .select()
      .from(pods)
      .where(eq(pods.companyId, companyId))
      .orderBy(desc(pods.updatedAt));
  }

  async function create(
    companyId: string,
    input: { name: string; kind?: string },
    actorUserId: string | null,
  ): Promise<PodRow> {
    const now = new Date();
    const [row] = await db
      .insert(pods)
      .values({
        companyId,
        name: input.name,
        kind: input.kind ?? "general",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) throw new Error("Failed to create pod");

    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: actorUserId ?? "board",
      action: "pod.created",
      entityType: "pod",
      entityId: row.id,
      details: { name: row.name, kind: row.kind },
    });

    return row;
  }

  async function updateLead(
    podId: string,
    leadAgentId: string | null,
    actor: { actorType: "user" | "agent"; actorId: string },
  ): Promise<PodRow> {
    const existing = await getById(podId);
    if (!existing) throw notFound("Pod not found");

    const now = new Date();
    const [row] = await db
      .update(pods)
      .set({ leadAgentId, updatedAt: now })
      .where(eq(pods.id, podId))
      .returning();
    if (!row) throw new Error("Failed to update pod lead");

    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.actorType === "agent" ? actor.actorId : null,
      action: "pod.lead_updated",
      entityType: "pod",
      entityId: podId,
      details: { previousLeadAgentId: existing.leadAgentId, newLeadAgentId: leadAgentId },
    });

    return row;
  }

  async function setStatus(
    podId: string,
    status: string,
    actor: { actorType: "user" | "agent"; actorId: string },
  ): Promise<PodRow> {
    const existing = await getById(podId);
    if (!existing) throw notFound("Pod not found");

    const now = new Date();
    const [row] = await db
      .update(pods)
      .set({
        status,
        updatedAt: now,
        ...(status === "active" ? { lastActiveAt: now } : {}),
      })
      .where(eq(pods.id, podId))
      .returning();
    if (!row) throw new Error("Failed to update pod status");

    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.actorType === "agent" ? actor.actorId : null,
      action: "pod.status_changed",
      entityType: "pod",
      entityId: podId,
      details: { previousStatus: existing.status, newStatus: status },
    });

    if (status === "active") {
      await hooks.onPodActivated?.(podId);
    } else {
      await hooks.onPodDeactivated?.(podId);
    }

    return row;
  }

  async function touchLastActive(podId: string): Promise<void> {
    await db
      .update(pods)
      .set({ lastActiveAt: new Date(), updatedAt: new Date() })
      .where(eq(pods.id, podId));
  }

  async function addAgent(
    podId: string,
    agentId: string,
    actor: { actorType: "user" | "agent"; actorId: string },
  ): Promise<void> {
    const pod = await getById(podId);
    if (!pod) throw notFound("Pod not found");

    await db
      .update(agents)
      .set({
        role: `pod:${podId}`,
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, agentId), eq(agents.companyId, pod.companyId)));

    await logActivity(db, {
      companyId: pod.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.actorType === "agent" ? actor.actorId : null,
      action: "pod.agent_added",
      entityType: "pod",
      entityId: podId,
      details: { agentId },
    });

    await touchLastActive(podId);
  }

  async function removeAgent(
    podId: string,
    agentId: string,
    actor: { actorType: "user" | "agent"; actorId: string },
  ): Promise<void> {
    const pod = await getById(podId);
    if (!pod) throw notFound("Pod not found");

    await db
      .update(agents)
      .set({
        role: "general",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, pod.companyId),
          eq(agents.role, `pod:${podId}`),
        ),
      );

    await logActivity(db, {
      companyId: pod.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.actorType === "agent" ? actor.actorId : null,
      action: "pod.agent_removed",
      entityType: "pod",
      entityId: podId,
      details: { agentId },
    });
  }

  async function getAgentsInPod(podId: string) {
    const pod = await getById(podId);
    if (!pod) throw notFound("Pod not found");

    return db
      .select()
      .from(agents)
      .where(and(eq(agents.companyId, pod.companyId), eq(agents.role, `pod:${podId}`)));
  }

  async function deletePod(podId: string, actorUserId: string | null): Promise<void> {
    const pod = await getById(podId);
    if (!pod) throw notFound("Pod not found");

    // Remove all agents from pod first
    await db
      .update(agents)
      .set({ role: "general", updatedAt: new Date() })
      .where(and(eq(agents.companyId, pod.companyId), eq(agents.role, `pod:${podId}`)));

    await db.delete(pods).where(eq(pods.id, podId));

    await logActivity(db, {
      companyId: pod.companyId,
      actorType: "user",
      actorId: actorUserId ?? "board",
      action: "pod.deleted",
      entityType: "pod",
      entityId: podId,
      details: { name: pod.name },
    });
  }

  return {
    getById,
    listByCompany,
    create,
    updateLead,
    setStatus,
    touchLastActive,
    addAgent,
    removeAgent,
    getAgentsInPod,
    delete: deletePod,
  };
}
