/**
 * Hypowork MCP server — exposes Software Factory work order tools to coding agents.
 *
 * Agents (Cursor, Claude Code, etc.) connect via stdio and can:
 *  - List / get work orders for a company + project
 *  - Create, update, and batch-patch work orders
 *  - List requirements and blueprints
 *
 * Authentication: set `HYPOWORK_API_KEY` and `HYPOWORK_BASE_URL` env vars.
 * Example launch from Cursor:
 *   npx tsx packages/mcp/src/server.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.HYPOWORK_API_KEY ?? "";
const BASE_URL = process.env.HYPOWORK_BASE_URL ?? "http://localhost:3000";

if (!API_KEY) {
  console.error("[hypowork-mcp] HYPOWORK_API_KEY is not set — work order tools will return auth errors.");
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const WORK_ORDER_TOOLS = [
  {
    name: "list_work_orders",
    description:
      "List work orders for a project. Returns id, title, status, assignee, PLC stage, and linked issue.",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string", description: "Company UUID" },
        projectId: { type: "string", description: "Project UUID" },
      },
      required: ["companyId", "projectId"],
    },
  },
  {
    name: "get_work_order",
    description: "Get a single work order by id.",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        workOrderId: { type: "string" },
      },
      required: ["companyId", "workOrderId"],
    },
  },
  {
    name: "create_work_order",
    description: "Create a new work order in a project.",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        projectId: { type: "string" },
        title: { type: "string" },
        descriptionMd: { type: "string" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "blocked", "cancelled"],
          default: "todo",
        },
        assigneeAgentId: { type: "string" },
        assignedUserId: { type: "string" },
        linkedBlueprintId: { type: "string" },
        linkedIssueId: { type: "string" },
        dependsOnWorkOrderIds: { type: "array", items: { type: "string" } },
        plcStageId: { type: "string" },
        plcTemplateId: { type: "string" },
      },
      required: ["companyId", "projectId", "title"],
    },
  },
  {
    name: "patch_work_order",
    description: "Patch fields on an existing work order (status, assignee, title, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        workOrderId: { type: "string" },
        title: { type: "string" },
        descriptionMd: { type: "string" },
        status: { type: "string", enum: ["todo", "in_progress", "done", "blocked", "cancelled"] },
        assigneeAgentId: { type: "string" },
        assignedUserId: { type: "string" },
        linkedBlueprintId: { type: "string" },
        linkedIssueId: { type: "string" },
        dependsOnWorkOrderIds: { type: "array", items: { type: "string" } },
        plcStageId: { type: "string" },
        plannedStartAt: { type: "string", description: "ISO datetime" },
        plannedEndAt: { type: "string", description: "ISO datetime" },
        sortOrder: { type: "number" },
      },
      required: ["companyId", "workOrderId"],
    },
  },
  {
    name: "batch_patch_work_orders",
    description: "Batch-patch multiple work orders in one call (e.g., bulk status change).",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        projectId: { type: "string" },
        patches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              assigneeAgentId: { type: "string" },
              assignedUserId: { type: "string" },
            },
            required: ["id"],
          },
        },
      },
      required: ["companyId", "projectId", "patches"],
    },
  },
] as const;

const REQUIREMENT_TOOLS = [
  {
    name: "list_requirements",
    description: "List all requirements for a project.",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        projectId: { type: "string" },
      },
      required: ["companyId", "projectId"],
    },
  },
  {
    name: "search_requirements",
    description: "Search requirements using keyword (FTS) or semantic (embedding) mode.",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        query: { type: "string" },
        mode: { type: "string", enum: ["fts", "semantic"], default: "fts" },
        limit: { type: "number", default: 20 },
      },
      required: ["companyId", "query"],
    },
  },
] as const;

const BLUEPRINT_TOOLS = [
  {
    name: "list_blueprints",
    description: "List all blueprints for a project.",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        projectId: { type: "string" },
      },
      required: ["companyId", "projectId"],
    },
  },
] as const;

const ALL_TOOLS = [...WORK_ORDER_TOOLS, ...REQUIREMENT_TOOLS, ...BLUEPRINT_TOOLS];

// ── Server ─────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "hypowork-mcp",
    version: "0.0.1",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(ListResourcesRequestSchema, () => ({ resources: [] }));
server.setRequestHandler(ListPromptsRequestSchema, () => ({ prompts: [] }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params as { name: string; arguments: Record<string, unknown> };

  try {
    let result: unknown;

    switch (name) {
      // ── Work orders ──
      case "list_work_orders": {
        const { companyId, projectId } = args as { companyId: string; projectId: string };
        result = await apiFetch(`/api/workspaces/${companyId}/software-factory/projects/${projectId}/work-orders`);
        break;
      }
      case "get_work_order": {
        const { companyId, workOrderId } = args as { companyId: string; workOrderId: string };
        result = await apiFetch(`/api/workspaces/${companyId}/software-factory/work-orders/${workOrderId}`);
        break;
      }
      case "create_work_order": {
        const { companyId, projectId, ...body } = args as {
          companyId: string; projectId: string; title: string; descriptionMd?: string;
          status?: string; assigneeAgentId?: string; assignedUserId?: string;
          linkedBlueprintId?: string; linkedIssueId?: string;
          dependsOnWorkOrderIds?: string[]; plcStageId?: string; plcTemplateId?: string;
        };
        result = await apiFetch(
          `/api/workspaces/${companyId}/software-factory/projects/${projectId}/work-orders`,
          { method: "POST", body: JSON.stringify(body) },
        );
        break;
      }
      case "patch_work_order": {
        const { companyId, workOrderId, ...body } = args as {
          companyId: string; workOrderId: string; [key: string]: unknown;
        };
        result = await apiFetch(
          `/api/workspaces/${companyId}/software-factory/work-orders/${workOrderId}`,
          { method: "PATCH", body: JSON.stringify(body) },
        );
        break;
      }
      case "batch_patch_work_orders": {
        const { companyId, projectId, patches } = args as {
          companyId: string; projectId: string; patches: Array<{ id: string; [key: string]: unknown }>;
        };
        result = await apiFetch(
          `/api/workspaces/${companyId}/software-factory/projects/${projectId}/work-orders/batch-patch`,
          { method: "POST", body: JSON.stringify({ patches }) },
        );
        break;
      }

      // ── Requirements ──
      case "list_requirements": {
        const { companyId, projectId } = args as { companyId: string; projectId: string };
        result = await apiFetch(`/api/workspaces/${companyId}/software-factory/projects/${projectId}/requirements`);
        break;
      }
      case "search_requirements": {
        const { companyId, query, mode = "fts", limit = 20 } = args as {
          companyId: string; query: string; mode?: string; limit?: number;
        };
        result = await apiFetch(
          `/api/workspaces/${companyId}/software-factory/search?q=${encodeURIComponent(query)}&mode=${mode}&limit=${limit}`,
        );
        break;
      }

      // ── Blueprints ──
      case "list_blueprints": {
        const { companyId, projectId } = args as { companyId: string; projectId: string };
        result = await apiFetch(`/api/workspaces/${companyId}/software-factory/projects/${projectId}/blueprints`);
        break;
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[hypowork-mcp] Tool ${name} error:`, msg);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[hypowork-mcp] Connected — tools available to coding agents.");
}

main().catch((err) => {
  console.error("[hypowork-mcp] Fatal:", err);
  process.exit(1);
});
