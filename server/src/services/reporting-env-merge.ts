import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents } from "@paperclipai/db";
import { parseObject } from "../adapters/utils.js";

/**
 * When `inheritReportingEnv` is not false, merge manager adapter `env` bindings before secret resolution
 * (this agent's keys win on conflict). Used by heartbeat and test-environment parity.
 */
export async function mergeReportingEnvForHeartbeat(
  db: Db,
  companyId: string,
  agent: { reportsTo: string | null; adapterConfig: unknown },
  mergedConfig: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!agent.reportsTo) return mergedConfig;
  const selfCfg = parseObject(agent.adapterConfig);
  if (selfCfg.inheritReportingEnv === false) return mergedConfig;

  const rows = await db
    .select({ adapterConfig: agents.adapterConfig })
    .from(agents)
    .where(and(eq(agents.id, agent.reportsTo), eq(agents.companyId, companyId)))
    .limit(1);
  const mgr = rows[0];
  if (!mgr) return mergedConfig;
  const mgrCfg = parseObject(mgr.adapterConfig);
  const mgrEnv = parseObject(mgrCfg.env);
  const selfEnv = parseObject(mergedConfig.env);
  return { ...mergedConfig, env: { ...mgrEnv, ...selfEnv } };
}
