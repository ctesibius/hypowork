import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { podsService } from "../services/pods.js";
import { assertBoard, assertWorkspaceAccess, getActorInfo } from "./authz.js";

const createPodSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.string().min(1).max(100).optional().default("general"),
});

const updateLeadSchema = z.object({
  leadAgentId: z.string().uuid().nullable(),
});

export function podsRoutes(db: Db) {
  const router = Router();
  const podsSvc = podsService(db);

  // POST /api/companies/:companyId/pods
  router.post(
    "/companies/:companyId/pods",
    validate(createPodSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      assertWorkspaceAccess(req, companyId);

      const row = await podsSvc.create(companyId, req.body, req.actor.userId ?? "board");
      res.status(201).json(row);
    },
  );

  // GET /api/companies/:companyId/pods
  router.get("/companies/:companyId/pods", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertWorkspaceAccess(req, companyId);

    const rows = await podsSvc.listByCompany(companyId);
    res.json(rows);
  });

  // GET /api/pods/:podId
  router.get("/pods/:podId", async (req, res) => {
    const podId = req.params.podId as string;
    const pod = await podsSvc.getById(podId);
    if (!pod) {
      res.status(404).json({ error: "Pod not found" });
      return;
    }
    assertWorkspaceAccess(req, pod.companyId);
    res.json(pod);
  });

  // PATCH /api/pods/:podId/lead
  router.patch("/pods/:podId/lead", validate(updateLeadSchema), async (req, res) => {
    const podId = req.params.podId as string;
    const pod = await podsSvc.getById(podId);
    if (!pod) {
      res.status(404).json({ error: "Pod not found" });
      return;
    }
    assertWorkspaceAccess(req, pod.companyId);

    const actor = getActorInfo(req);
    const row = await podsSvc.updateLead(podId, req.body.leadAgentId, {
      actorType: actor.actorType,
      actorId: actor.actorId,
    });
    res.json(row);
  });

  // PATCH /api/pods/:podId/status
  router.patch(
    "/pods/:podId/status",
    validate(z.object({ status: z.enum(["active", "paused", "archived"]) })),
    async (req, res) => {
      const podId = req.params.podId as string;
      const pod = await podsSvc.getById(podId);
      if (!pod) {
        res.status(404).json({ error: "Pod not found" });
        return;
      }
      assertWorkspaceAccess(req, pod.companyId);

      const actor = getActorInfo(req);
      const row = await podsSvc.setStatus(podId, req.body.status, {
        actorType: actor.actorType,
        actorId: actor.actorId,
      });
      res.json(row);
    },
  );

  // POST /api/pods/:podId/agents
  router.post(
    "/pods/:podId/agents",
    validate(z.object({ agentId: z.string().uuid() })),
    async (req, res) => {
      const podId = req.params.podId as string;
      const pod = await podsSvc.getById(podId);
      if (!pod) {
        res.status(404).json({ error: "Pod not found" });
        return;
      }
      assertWorkspaceAccess(req, pod.companyId);

      const actor = getActorInfo(req);
      await podsSvc.addAgent(podId, req.body.agentId, {
        actorType: actor.actorType,
        actorId: actor.actorId,
      });

      // Update leadAgentId to this agent if pod has no lead
      if (!pod.leadAgentId) {
        await podsSvc.updateLead(podId, req.body.agentId, {
          actorType: actor.actorType,
          actorId: actor.actorId,
        });
      }

      res.status(201).json({ ok: true });
    },
  );

  // DELETE /api/pods/:podId/agents/:agentId
  router.delete("/pods/:podId/agents/:agentId", async (req, res) => {
    const podId = req.params.podId as string;
    const agentId = req.params.agentId as string;
    const pod = await podsSvc.getById(podId);
    if (!pod) {
      res.status(404).json({ error: "Pod not found" });
      return;
    }
    assertWorkspaceAccess(req, pod.companyId);

    const actor = getActorInfo(req);
    await podsSvc.removeAgent(podId, agentId, {
      actorType: actor.actorType,
      actorId: actor.actorId,
    });
    res.json({ ok: true });
  });

  // GET /api/pods/:podId/agents
  router.get("/pods/:podId/agents", async (req, res) => {
    const podId = req.params.podId as string;
    const pod = await podsSvc.getById(podId);
    if (!pod) {
      res.status(404).json({ error: "Pod not found" });
      return;
    }
    assertWorkspaceAccess(req, pod.companyId);

    const agents = await podsSvc.getAgentsInPod(podId);
    res.json(agents);
  });

  // DELETE /api/pods/:podId
  router.delete("/pods/:podId", async (req, res) => {
    const podId = req.params.podId as string;
    const pod = await podsSvc.getById(podId);
    if (!pod) {
      res.status(404).json({ error: "Pod not found" });
      return;
    }
    assertBoard(req);
    assertWorkspaceAccess(req, pod.companyId);

    await podsSvc.delete(podId, req.actor.userId ?? "board");
    res.json({ ok: true });
  });

  return router;
}
