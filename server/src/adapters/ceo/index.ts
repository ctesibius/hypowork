import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";

export const ceoAdapter: ServerAdapterModule = {
  type: "ceo",
  execute,
  testEnvironment: async () => ({
    adapterType: "ceo",
    status: "pass",
    message: "CEO adapter always available",
    checks: [],
    testedAt: new Date().toISOString(),
  }),
  models: [],
  agentConfigurationDoc: `# CEO Agent Configuration

Adapter: ceo

The CEO adapter is a system-level agent that monitors pods, goals, and issues
on a timer interval. It does not execute code or call external APIs — it reads
company state from the database and logs observations / recommended actions.

Core configuration fields:
- intervalMinutes (number, optional): how often to run. Default: 60.
  Set via the agent's heartbeat.intervalSec field.
- checkBudgetStatus (boolean, optional): include budget overview in CEO report.
- checkGoalProgress (boolean, optional): include goal completion % in CEO report.
- checkPodHealth (boolean, optional): include pod activity summary in CEO report.
- maxIssuesPerReport (number, optional): cap on issues reviewed per run. Default: 20.
`,
};
