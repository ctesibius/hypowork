# PLC Templates — Project Life Cycle Configuration

**Phase:** Phase 2 §2.8 (Infinite canvas — Software Factory)
**Status:** Shipped (2026-03-23)
**Last Updated:** 2026-03-23

---

## Context

Phase 2 ships a first **Software Design Factory** with four stages: **Refinery → Foundry → Planner → Validator**. The factory serves as the execution engine for software initiatives. However, the project lifecycle gates (PDR, CDR, TRR, etc.) are not yet first-class — they are represented only as work order titles or checklist text inside WO descriptions.

This design introduces **PLC Templates** — configurable, reusable project lifecycle graphs — so that:

- Each project can have its own lifecycle model (e.g., "SRR → PDR → CDR → TRR" vs "Sprint-based" vs "Lean startup")
- Documents can optionally override with a sub-lifecycle (e.g., a "CDR for Module X" sub-pipeline)
- Work orders can be tagged to a PLC stage
- The **project planning canvas** renders the PLC as a graph layer

This unblocks the "PDR → CDR flow" gap (§2.8) and lays the foundation for **Phase 3 Hardware Factory** lifecycle (which will use the same mechanism with different default templates).

---

## Data Model

### PLC Template

A **PLC template** is a named, ordered graph of lifecycle stages scoped to a company.

```sql
CREATE TABLE "plc_templates" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
  "name"       text NOT NULL,              -- e.g. "Standard SW PLC"
  "description" text,
  "stages"     jsonb NOT NULL DEFAULT '[]', -- ordered stage + transition graph
  "created_at"  timestamptz DEFAULT now() NOT NULL,
  "updated_at"  timestamptz DEFAULT now() NOT NULL
);
```

**`stages` JSONB structure** — a directed graph:

```json
{
  "nodes": [
    { "id": "srr",   "label": "SRR",   "kind": "gate",   "description": "System Requirements Review" },
    { "id": "pdr",   "label": "PDR",   "kind": "gate",   "description": "Preliminary Design Review" },
    { "id": "cdr",   "label": "CDR",   "kind": "gate",   "description": "Critical Design Review" },
    { "id": "trr",   "label": "TRR",   "kind": "gate",   "description": "Test Readiness Review" }
  ],
  "edges": [
    { "from": "srr", "to": "pdr" },
    { "from": "pdr", "to": "cdr" },
    { "from": "cdr", "to": "trr" }
  ]
}
```

Each node `kind` can be:
- `"gate"` — a review/decision milestone (SRR, PDR, CDR, TRR)
- `"phase"` — a development phase (e.g. "Implementation", "Testing")
- `"checkpoint"` — a lightweight status marker

**Validation rules:**
- Node `id`s are unique within a template
- All `from`/`to` references in `edges` must reference existing node `id`s
- No orphan edges

### Attachments

```sql
-- A project binds to one PLC template (its canonical lifecycle)
ALTER TABLE "projects" ADD COLUMN "plc_template_id" uuid REFERENCES plc_templates(id) ON DELETE set null;

-- A document can optionally have its own sub-lifecycle (override)
ALTER TABLE "documents" ADD COLUMN "plc_template_id" uuid REFERENCES plc_templates(id) ON DELETE set null;
ALTER TABLE "documents" ADD COLUMN "plc_override" jsonb; -- full own-config (no template FK needed)

-- Factory work orders can be tagged to a stage
ALTER TABLE "software_factory_work_orders" ADD COLUMN "plc_stage_id" text;
ALTER TABLE "software_factory_work_orders" ADD COLUMN "plc_template_id" uuid REFERENCES plc_templates(id);
```

### Attachment + Inheritance Resolution

When rendering a PLC for a given context, resolve in this order:

```
1. If document.plc_override is set → use it (self-contained snapshot)
2. If document.plc_template_id is set → load that template
3. If project.plc_template_id is set → load project template (default)
4. If company has a default PLC template → use it
5. Fall back: empty PLC (no stages shown)
```

### Stage tagging on work orders

`software_factory_work_orders.plc_stage_id` holds the node `id` string (e.g. `"pdr"`). The `plc_template_id` on the WO is optional — if absent, the WO inherits the project's PLC template for stage resolution.

---

## API Surface

### PLC Templates CRUD

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/companies/:companyId/plc-templates` | List all PLC templates for company |
| `POST` | `/companies/:companyId/plc-templates` | Create a PLC template |
| `GET` | `/companies/:companyId/plc-templates/:id` | Get one template |
| `PATCH` | `/companies/:companyId/plc-templates/:id` | Update template (name, stages) |
| `DELETE` | `/companies/:companyId/plc-templates/:id` | Delete template |

**Authorization:** Same `assertCompanyAccess` guard as all company-scoped resources.

### Binding PLC to Projects

PLC is bound via the existing `PATCH /projects/:id` endpoint:

```
PATCH /projects/:id
{ "plcTemplateId": "uuid" | null }
```

Validation: `plcTemplateId` must reference a `plc_templates` row with matching `company_id`.

### Work Order Stage Tagging

Added to existing work order DTOs:

```typescript
// CreateWorkOrderDto / PatchWorkOrderDto
interface CreateWorkOrderDto {
  // ... existing fields ...
  plcStageId?: string | null;   // node id from the project's PLC template
  plcTemplateId?: string | null; // override template (optional)
}
```

---

## Implementation Plan

### Step 1 — Migration (`0047_plc_templates`)

- Create `plc_templates` table
- Add `plc_template_id` to `projects`
- Add `plc_template_id` + `plc_override` to `documents`
- Add `plc_stage_id` + `plc_template_id` to `software_factory_work_orders`
- Add `factory_template` constraint to allow new values (`hybrid`) — extend enum
- Seed a **default SW PLC template** for each company on creation (via trigger or app logic)

### Step 2 — DB Schema (TypeScript)

- `packages/db/src/schema/plc_templates.ts` — Drizzle table definition
- Export from `packages/db/src/schema/index.ts`
- `packages/shared/src/types/plc_template.ts` — shared types for client + server
- `packages/shared/src/validators/plc_template.ts` — Zod schemas for API validation

### Step 3 — Nest PLC Module

New module at `server-nest/src/plc/`:
- `plc.controller.ts` — CRUD at `/companies/:companyId/plc-templates`
- `plc.service.ts` — DB operations, validation of stages JSON graph
- `plc.types.ts` — DTOs
- Import into `server-nest/src/software-factory/software-factory.module.ts` (or top-level `AppModule`)

### Step 4 — Projects Service Update

In `server/src/services/projects.ts`, add validation for `plcTemplateId` on project update (same pattern as `planningCanvasDocumentId`):
- Must reference a `plc_templates` row
- Must have matching `company_id`

### Step 5 — Factory Playground Seed Update

Update `SoftwareFactoryService.ensureDevPlaygroundProject()` to also create a default PLC template and attach it to the playground project, with demo stage nodes (SRR, PDR, CDR, TRR).

### Step 6 — UI: PLC Template Editor

New page at `/companies/:companyId/settings/plc-templates`:
- List view of all company PLC templates
- Create / edit form: name, description, stage graph builder
- Stage graph builder: add/remove/reorder nodes, draw edges between nodes, set node `kind`
- Delete confirmation (blocked if in use by projects)

### Step 7 — UI: Project PLC Selector

In project settings or Overview tab:
- Dropdown to select PLC template from company's templates
- Shows currently selected template with stage count

### Step 8 — UI: Work Order PLC Stage Tagging

In `SoftwareFactoryProject.tsx` Planner stage:
- Work order create/edit modal gains a **Stage** field (dropdown populated from project's PLC template stages)
- Kanban columns optionally grouped by PLC stage

### Step 9 — Canvas PLC Graph Layer

On the project planning canvas (`planningCanvasDocumentId`):
- Render PLC stages as horizontally laid out nodes (SRR → PDR → CDR → TRR)
- Factory artifact nodes (requirements, blueprints, WOs) can be visually connected to their stage
- The canvas already has `canvasGraph` (React Flow JSON); PLC stages become a special node type

---

## Canvas Integration Detail

The `planningCanvasDocumentId` is a `documents` row with `kind = 'canvas'`. Its `canvas_graph` React Flow JSON already supports custom node types. A PLC overlay adds:

```typescript
// New node type: plc_stage_node
interface PlcStageNode {
  type: "plc_stage";
  data: {
    stageId: string;       // "srr", "pdr", etc.
    label: string;         // "SRR", "PDR", etc.
    kind: "gate" | "phase" | "checkpoint";
    status: "pending" | "active" | "complete";
  };
  position: { x: number; y: number }; // laid out horizontally
}

// Edges from PLC template connect plc_stage nodes
// Edges from factory artifact nodes → plc_stage nodes (WO → its assigned stage)
```

On load, the canvas resolves the project's PLC template and renders the stage graph. User can drag artifact nodes onto stage nodes to tag them.

---

## Migration Detail

```sql
-- 0047_plc_templates.sql

CREATE TABLE "plc_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
  "name" text NOT NULL,
  "description" text,
  "stages" jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "plc_templates_company_idx" ON "plc_templates" USING btree ("company_id");

ALTER TABLE "projects" ADD COLUMN "plc_template_id" uuid;
ALTER TABLE "projects" ADD CONSTRAINT "projects_plc_template_id_plc_templates_id_fk"
  FOREIGN KEY ("plc_template_id") REFERENCES "plc_templates"("id") ON DELETE set null;

ALTER TABLE "documents" ADD COLUMN "plc_template_id" uuid;
ALTER TABLE "documents" ADD COLUMN "plc_override" jsonb;
ALTER TABLE "documents" ADD CONSTRAINT "documents_plc_template_id_plc_templates_id_fk"
  FOREIGN KEY ("plc_template_id") REFERENCES "plc_templates"("id") ON DELETE set null;

ALTER TABLE "software_factory_work_orders" ADD COLUMN "plc_stage_id" text;
ALTER TABLE "software_factory_work_orders" ADD COLUMN "plc_template_id" uuid;
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "sf_work_orders_plc_template_id_plc_templates_id_fk"
  FOREIGN KEY ("plc_template_id") REFERENCES "plc_templates"("id") ON DELETE set null;
```

---

## Open Questions

1. **Per-document PLC override vs. template link** — `plc_override` is a self-contained graph. Should documents also be able to just reference a template but with a different `stageId` mapping (e.g., "CDR for this doc")? Or is `plc_override` sufficient?

2. **PLC stage statuses** — Who marks a stage as "complete"? The user, or does it auto-complete when all work orders for that stage are done? Consider: status `pending | active | complete` on the project's PLC instance (not template).

3. **Template versioning** — If a template is edited, should existing projects using it be affected? Probably not (they reference by ID). But should there be a "template version" concept for audit trail?

---

## Canvas Integration — Factory Artifact Nodes (Implemented)

Three new React Flow node types added to `DocumentCanvasEditor` toolbar when `projectId` is set on the canvas document:

| Node type | Color | Icon | Fetches |
|---|---|---|---|
| `requirementRef` | Emerald | `CheckSquare` | `GET /requirements/:id` |
| `blueprintRef` | Blue | `BookOpen` | `GET /blueprints/:id` |
| `workOrderRef` | Orange | `ListChecks` | `GET /work-orders/:id` |

**Toolbar UX:**
- Left rail: icon buttons for Requirement, Blueprint, Work Order (color-coded to match card style)
- Top strip: labeled buttons with same icons (only shown when `requirements`/`blueprints`/`workOrders` are loaded)
- Each opens a picker dialog with a `<select>` dropdown listing all artifacts in the project
- Clicking "Add" places the node at the viewport center

**Data flow:**
1. `DocumentCanvasEditor` receives `projectId` prop from `DocumentDetail` (via `doc.projectId`)
2. `DocumentCanvasEditor` queries `listRequirements`, `listBlueprints`, `listWorkOrders` for that project
3. Data passed to `HypoworkCanvasToolbar` which offers pickers and `addRequirementRef`/`addBlueprintRef`/`addWorkOrderRef` functions
4. Each node self-loads its full data via `getRequirement`/`getBlueprint`/`getWorkOrder` on render

**Backend GET endpoints added:**
- `GET /companies/:companyId/requirements/:id`
- `GET /companies/:companyId/blueprints/:id`
- `GET /companies/:companyId/work-orders/:id`

**Files changed:**
- `client/src/components/canvas/CompanyCanvasBoard.tsx` — `RequirementRefNode`, `BlueprintRefNode`, `WorkOrderRefNode`
- `client/src/components/canvas/HypoworkCanvasToolbar.tsx` — toolbar buttons + picker dialogs
- `client/src/components/canvas/DocumentCanvasEditor.tsx` — `projectId` prop, factory queries
- `client/src/pages/DocumentDetail.tsx` — passes `doc.projectId`
- `client/src/api/software-factory.ts` — `getRequirement`, `getBlueprint`, `getWorkOrder`
- `server-nest/src/software-factory/software-factory.service.ts` — `getRequirement`, `getBlueprint`, `getWorkOrder`
- `server-nest/src/software-factory/software-factory.controller.ts` — `GET /requirements/:id`, `GET /blueprints/:id`, `GET /work-orders/:id`

4. **Phase 3 hardware templates** — They use the same table; just different default content (e.g., "Concept → Detailed Design → Prototype → Validation"). The `factory_template` project field (`software` vs `hardware`) can drive which templates are suggested.

5. **Canvas graph persistence** — The `planningCanvasDocumentId` document's `canvas_graph` holds the React Flow JSON. If we add PLC nodes to the canvas, should we store the PLC state in `plc_templates` (source of truth) or in the canvas graph (UI state)? Recommendation: store PLC in `plc_templates`; canvas shows a rendered view of it; drag-to-connect is a UI convenience that updates the WO's `plc_stage_id`.
