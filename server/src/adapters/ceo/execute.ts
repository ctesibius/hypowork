import { desc, eq, and, isNull, sql } from "drizzle-orm";
import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { createDb } from "@paperclipai/db";
import { agents, budgetIncidents, budgetPolicies, companies, issues, pods } from "@paperclipai/db";

let _db: ReturnType<typeof createDb> | null = null;

async function getDb() {
  if (!_db) {
    _db = createDb(process.env.DATABASE_URL ?? "");
  }
  return _db;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { agent, config, runId, onLog } = ctx;

  const db = await getDb();
  const companyId = agent.companyId;
  const cfg = config as Record<string, unknown>;
  const checkBudgetStatus = cfg.checkBudgetStatus ?? true;
  const checkGoalProgress = cfg.checkGoalProgress ?? true;
  const checkPodHealth = cfg.checkPodHealth ?? true;
  const maxIssuesPerReport = Number(cfg.maxIssuesPerReport ?? 20);

  const sections: string[] = [];
  const now = new Date();

  // --- Company + budget health ---
  if (checkBudgetStatus) {
    const [company] = await db
      .select({ status: companies.status, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (company) {
      sections.push(`## Company: ${company.name}`);
      sections.push(`Status: ${company.status}`);

      if (company.status === "paused") {
        sections.push("⚠️  Company is paused.");
      }

      const policies = await db
        .select()
        .from(budgetPolicies)
        .where(and(eq(budgetPolicies.companyId, companyId), eq(budgetPolicies.isActive, true)));

      const activeIncidents = await db
        .select()
        .from(budgetIncidents)
        .where(and(eq(budgetIncidents.companyId, companyId), isNull(budgetIncidents.resolvedAt)));

      if (policies.length > 0) {
        sections.push(`\n### Budget Policies (${policies.length} active)`);
        for (const p of policies) {
          const hardLabel = p.hardStopEnabled ? `⚠️ hard-stop @ ${p.amount}¢` : "no hard-stop";
          sections.push(`- ${p.scopeType}:${p.scopeId.slice(0, 8)} — ${hardLabel}`);
        }
      }

      if (activeIncidents.length > 0) {
        sections.push(`\n⚠️  Active budget incidents: ${activeIncidents.length}`);
        for (const inc of activeIncidents) {
          const age = Math.round((now.getTime() - inc.createdAt.getTime()) / 86_400_000);
          sections.push(
            `  - [${inc.thresholdType}] ${inc.scopeType}:${inc.scopeId?.slice(0, 8) ?? "?"} — ` +
            `${inc.thresholdType === "hard" ? "HARD" : "soft"} threshold — ` +
            `${inc.amountObserved}/${inc.amountLimit}¢ (${age}d ago)`,
          );
        }
      } else {
        sections.push("\n✅  No active budget incidents.");
      }
    }
  }

  // --- Pod health ---
  if (checkPodHealth) {
    const allPods = await db
      .select()
      .from(pods)
      .where(and(eq(pods.companyId, companyId), eq(pods.status, "active")));

    if (allPods.length > 0) {
      sections.push("\n## Pods");
      for (const pod of allPods) {
        const podAgents = await db
          .select({ id: agents.id, name: agents.name, status: agents.status })
          .from(agents)
          .where(and(eq(agents.companyId, companyId), eq(agents.role, `pod:${pod.id}`)));

        const activeCount = podAgents.filter((a) => a.status === "running" || a.status === "idle").length;
        const pausedCount = podAgents.filter((a) => a.status === "paused").length;

        sections.push(
          `### ${pod.name} (${pod.kind}) — ${activeCount} active, ${pausedCount} paused, ${podAgents.length} total`,
        );

        if (podAgents.length === 0) {
          sections.push("  ⚠️  No agents in pod.");
        } else {
          for (const a of podAgents.slice(0, 5)) {
            sections.push(`  - ${a.name} (${a.status})`);
          }
          if (podAgents.length > 5) sections.push(`  ... and ${podAgents.length - 5} more`);
        }
      }
    }
  }

  // --- Goal / issue progress ---
  if (checkGoalProgress) {
    const recentDone = await db
      .select({
        id: issues.id,
        title: issues.title,
        status: issues.status,
        assigneeAgentId: issues.assigneeAgentId,
        updatedAt: issues.updatedAt,
      })
      .from(issues)
      .where(and(eq(issues.companyId, companyId), eq(issues.status, "done")))
      .orderBy(desc(issues.updatedAt))
      .limit(maxIssuesPerReport);

    const inProgressIssues = await db
      .select({
        id: issues.id,
        title: issues.title,
        status: issues.status,
        assigneeAgentId: issues.assigneeAgentId,
      })
      .from(issues)
      .where(and(eq(issues.companyId, companyId), sql`${issues.status} IN ('in_progress', 'todo')`))
      .limit(maxIssuesPerReport);

    sections.push("\n## Issue Pipeline");
    sections.push(`Completed (recent): ${recentDone.length}`);
    sections.push(`In progress / todo: ${inProgressIssues.length}`);

    if (inProgressIssues.length > 0) {
      sections.push("\n**In-flight issues:**");
      for (const issue of inProgressIssues.slice(0, 10)) {
        const assignee = issue.assigneeAgentId
          ? await db
              .select({ name: agents.name })
              .from(agents)
              .where(eq(agents.id, issue.assigneeAgentId))
              .limit(1)
              .then((r) => r[0]?.name ?? "unknown")
          : "unassigned";
        sections.push(`- [${issue.status}] ${issue.title ?? issue.id.slice(0, 8)} — @${assignee}`);
      }
    }
  }

  const report = sections.join("\n") || "CEO report: no data available.";

  await onLog?.("stdout", `CEO report for company ${companyId.slice(0, 8)}\n${report}\n`);

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    summary: `CEO report generated at ${now.toISOString()}`,
  };
}
