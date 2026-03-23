import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, ilike, isNotNull, notInArray, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  issues,
  projects,
  softwareFactoryBlueprints,
  softwareFactoryRequirements,
  softwareFactoryValidationEvents,
  softwareFactoryWorkOrders,
} from "@paperclipai/db";
import { projectService } from "@paperclipai/server/services/projects";
import { DB } from "../db/db.module.js";
import type {
  BatchPatchWorkOrdersDto,
  CreateBlueprintDto,
  CreateRequirementDto,
  CreateValidationEventDto,
  CreateWorkOrderDto,
  DesignAssistSuggestion,
  DesignAssistSuggestionsDto,
  PatchBlueprintDto,
  PatchRequirementDto,
  PatchWorkOrderDto,
  SoftwareFactorySearchHit,
} from "./software-factory.types.js";

function escapeIlikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/** Real `projects` row name; idempotent dev fixture for Software Factory UI testing. */
export const FACTORY_PLAYGROUND_PROJECT_NAME = "Factory playground (dev)";

/** First requirement title prefix — if missing, playground factory rows are replaced with current demo seed. */
export const PLAYGROUND_SEED_MARKER = "[Demo] PLC";

@Injectable()
export class SoftwareFactoryService {
  constructor(@Inject(DB) private readonly db: Db) {}

  private async assertProjectInCompany(companyId: string, projectId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("Project not found in this company");
    }
  }

  private parseOptionalInstant(input: string | null | undefined): Date | null | undefined {
    if (input === undefined) return undefined;
    if (input === null || input === "") return null;
    const d = new Date(input);
    if (!Number.isFinite(d.getTime())) {
      throw new BadRequestException("Invalid ISO datetime for planned start/end");
    }
    return d;
  }

  private async assertLinkedIssueForWorkOrder(
    companyId: string,
    projectId: string,
    issueId: string | null | undefined,
  ): Promise<void> {
    if (issueId === undefined || issueId === null) return;
    const [iss] = await this.db
      .select({ id: issues.id, companyId: issues.companyId, projectId: issues.projectId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);
    if (!iss || iss.companyId !== companyId || iss.projectId !== projectId) {
      throw new BadRequestException("linkedIssueId must reference an issue in this company and project");
    }
  }

  /** PostgreSQL full-text rank over title+body (GIN in migration 0046); falls back to ILIKE. */
  private async searchRequirementsRanked(
    companyId: string,
    q: string,
    cap: number,
  ): Promise<{ id: string; projectId: string; title: string; bodyMd: string | null }[]> {
    try {
      const res = await this.db.execute(sql`
        SELECT id, project_id AS "projectId", title, body_md AS "bodyMd"
        FROM software_factory_requirements
        WHERE company_id = ${companyId}::uuid
          AND (
            to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body_md, ''))
            @@ plainto_tsquery('english', ${q})
          )
        ORDER BY ts_rank(
          to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body_md, '')),
          plainto_tsquery('english', ${q})
        ) DESC NULLS LAST,
          updated_at DESC
        LIMIT ${cap}
      `);
      const raw = res as unknown as { rows?: unknown[] } | unknown[];
      const rows = Array.isArray(raw) ? raw : (raw.rows ?? []);
      return rows as { id: string; projectId: string; title: string; bodyMd: string | null }[];
    } catch {
      return [];
    }
  }

  private async listRequirementSearchRowsIlike(
    companyId: string,
    pat: string,
    cap: number,
    excludeIds: string[],
  ) {
    const base = and(
      eq(softwareFactoryRequirements.companyId, companyId),
      or(
        ilike(softwareFactoryRequirements.title, pat),
        ilike(softwareFactoryRequirements.bodyMd, pat),
        and(
          isNotNull(softwareFactoryRequirements.structuredYaml),
          ilike(softwareFactoryRequirements.structuredYaml, pat),
        ),
      ),
    );
    const where =
      excludeIds.length > 0
        ? and(base, notInArray(softwareFactoryRequirements.id, excludeIds))
        : base;
    return this.db
      .select({
        id: softwareFactoryRequirements.id,
        projectId: softwareFactoryRequirements.projectId,
        title: softwareFactoryRequirements.title,
        bodyMd: softwareFactoryRequirements.bodyMd,
      })
      .from(softwareFactoryRequirements)
      .where(where)
      .orderBy(desc(softwareFactoryRequirements.updatedAt))
      .limit(cap);
  }

  async globalSearch(companyId: string, query: string, limit = 40): Promise<SoftwareFactorySearchHit[]> {
    const q = query.trim();
    if (q.length === 0) return [];
    const pat = `%${escapeIlikePattern(q)}%`;
    const cap = Math.min(Math.max(limit, 1), 200);

    const ftsReq = await this.searchRequirementsRanked(companyId, q, cap);
    const seenReq = new Set(ftsReq.map((r) => r.id));
    const remaining = cap - ftsReq.length;
    const ilikeReq =
      remaining > 0
        ? await this.listRequirementSearchRowsIlike(companyId, pat, remaining, [...seenReq])
        : [];
    const reqRows = [...ftsReq, ...ilikeReq];

    const [bpRows, woRows, valRows] = await Promise.all([
      this.db
        .select({
          id: softwareFactoryBlueprints.id,
          projectId: softwareFactoryBlueprints.projectId,
          title: softwareFactoryBlueprints.title,
          bodyMd: softwareFactoryBlueprints.bodyMd,
        })
        .from(softwareFactoryBlueprints)
        .where(
          and(
            eq(softwareFactoryBlueprints.companyId, companyId),
            or(
              ilike(softwareFactoryBlueprints.title, pat),
              ilike(softwareFactoryBlueprints.bodyMd, pat),
              and(
                isNotNull(softwareFactoryBlueprints.diagramMermaid),
                ilike(softwareFactoryBlueprints.diagramMermaid, pat),
              ),
            ),
          ),
        )
        .orderBy(desc(softwareFactoryBlueprints.updatedAt))
        .limit(cap),
      this.db
        .select({
          id: softwareFactoryWorkOrders.id,
          projectId: softwareFactoryWorkOrders.projectId,
          title: softwareFactoryWorkOrders.title,
          descriptionMd: softwareFactoryWorkOrders.descriptionMd,
        })
        .from(softwareFactoryWorkOrders)
        .where(
          and(
            eq(softwareFactoryWorkOrders.companyId, companyId),
            or(
              ilike(softwareFactoryWorkOrders.title, pat),
              ilike(softwareFactoryWorkOrders.descriptionMd, pat),
            ),
          ),
        )
        .orderBy(desc(softwareFactoryWorkOrders.updatedAt))
        .limit(cap),
      this.db
        .select({
          id: softwareFactoryValidationEvents.id,
          projectId: softwareFactoryValidationEvents.projectId,
          source: softwareFactoryValidationEvents.source,
          summary: softwareFactoryValidationEvents.summary,
        })
        .from(softwareFactoryValidationEvents)
        .where(
          and(
            eq(softwareFactoryValidationEvents.companyId, companyId),
            or(
              ilike(softwareFactoryValidationEvents.source, pat),
              and(
                isNotNull(softwareFactoryValidationEvents.summary),
                ilike(softwareFactoryValidationEvents.summary, pat),
              ),
            ),
          ),
        )
        .orderBy(desc(softwareFactoryValidationEvents.createdAt))
        .limit(cap),
    ]);

    const hits: SoftwareFactorySearchHit[] = [];
    for (const r of reqRows) {
      hits.push({
        kind: "requirement",
        id: r.id,
        projectId: r.projectId,
        title: r.title,
        excerpt: (r.bodyMd ?? "").slice(0, 200),
      });
    }
    for (const r of bpRows) {
      hits.push({
        kind: "blueprint",
        id: r.id,
        projectId: r.projectId,
        title: r.title,
        excerpt: (r.bodyMd ?? "").slice(0, 200),
      });
    }
    for (const r of woRows) {
      hits.push({
        kind: "work_order",
        id: r.id,
        projectId: r.projectId,
        title: r.title,
        excerpt: (r.descriptionMd ?? "").slice(0, 200),
      });
    }
    for (const r of valRows) {
      hits.push({
        kind: "validation",
        id: r.id,
        projectId: r.projectId,
        title: r.summary ?? r.source,
        excerpt: (r.summary ?? r.source).slice(0, 200),
      });
    }
    return hits.slice(0, cap);
  }

  // --- Requirements ---

  async listRequirements(companyId: string, projectId: string) {
    await this.assertProjectInCompany(companyId, projectId);
    return this.db
      .select()
      .from(softwareFactoryRequirements)
      .where(
        and(
          eq(softwareFactoryRequirements.companyId, companyId),
          eq(softwareFactoryRequirements.projectId, projectId),
        ),
      )
      .orderBy(desc(softwareFactoryRequirements.updatedAt));
  }

  async createRequirement(companyId: string, projectId: string, dto: CreateRequirementDto) {
    await this.assertProjectInCompany(companyId, projectId);
    const [row] = await this.db
      .insert(softwareFactoryRequirements)
      .values({
        companyId,
        projectId,
        title: dto.title,
        bodyMd: dto.bodyMd ?? "",
        structuredYaml: dto.structuredYaml ?? null,
        version: dto.version ?? 1,
        supersedesId: dto.supersedesId ?? null,
      })
      .returning();
    return row;
  }

  async patchRequirement(companyId: string, id: string, dto: PatchRequirementDto) {
    const [existing] = await this.db
      .select()
      .from(softwareFactoryRequirements)
      .where(and(eq(softwareFactoryRequirements.id, id), eq(softwareFactoryRequirements.companyId, companyId)))
      .limit(1);
    if (!existing) throw new NotFoundException("Requirement not found");

    const [row] = await this.db
      .update(softwareFactoryRequirements)
      .set({
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.bodyMd !== undefined ? { bodyMd: dto.bodyMd } : {}),
        ...(dto.structuredYaml !== undefined ? { structuredYaml: dto.structuredYaml } : {}),
        ...(dto.version !== undefined ? { version: dto.version } : {}),
        ...(dto.supersedesId !== undefined ? { supersedesId: dto.supersedesId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(softwareFactoryRequirements.id, id))
      .returning();
    return row;
  }

  async deleteRequirement(companyId: string, id: string) {
    const res = await this.db
      .delete(softwareFactoryRequirements)
      .where(and(eq(softwareFactoryRequirements.id, id), eq(softwareFactoryRequirements.companyId, companyId)))
      .returning({ id: softwareFactoryRequirements.id });
    if (res.length === 0) throw new NotFoundException("Requirement not found");
  }

  // --- Blueprints ---

  async listBlueprints(companyId: string, projectId: string) {
    await this.assertProjectInCompany(companyId, projectId);
    return this.db
      .select()
      .from(softwareFactoryBlueprints)
      .where(
        and(
          eq(softwareFactoryBlueprints.companyId, companyId),
          eq(softwareFactoryBlueprints.projectId, projectId),
        ),
      )
      .orderBy(desc(softwareFactoryBlueprints.updatedAt));
  }

  async createBlueprint(companyId: string, projectId: string, dto: CreateBlueprintDto) {
    await this.assertProjectInCompany(companyId, projectId);
    const [row] = await this.db
      .insert(softwareFactoryBlueprints)
      .values({
        companyId,
        projectId,
        title: dto.title,
        bodyMd: dto.bodyMd ?? "",
        diagramMermaid: dto.diagramMermaid ?? null,
        linkedRequirementIds: dto.linkedRequirementIds ?? [],
      })
      .returning();
    return row;
  }

  async patchBlueprint(companyId: string, id: string, dto: PatchBlueprintDto) {
    const [existing] = await this.db
      .select()
      .from(softwareFactoryBlueprints)
      .where(and(eq(softwareFactoryBlueprints.id, id), eq(softwareFactoryBlueprints.companyId, companyId)))
      .limit(1);
    if (!existing) throw new NotFoundException("Blueprint not found");

    const [row] = await this.db
      .update(softwareFactoryBlueprints)
      .set({
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.bodyMd !== undefined ? { bodyMd: dto.bodyMd } : {}),
        ...(dto.diagramMermaid !== undefined ? { diagramMermaid: dto.diagramMermaid } : {}),
        ...(dto.linkedRequirementIds !== undefined ? { linkedRequirementIds: dto.linkedRequirementIds } : {}),
        updatedAt: new Date(),
      })
      .where(eq(softwareFactoryBlueprints.id, id))
      .returning();
    return row;
  }

  async deleteBlueprint(companyId: string, id: string) {
    const res = await this.db
      .delete(softwareFactoryBlueprints)
      .where(and(eq(softwareFactoryBlueprints.id, id), eq(softwareFactoryBlueprints.companyId, companyId)))
      .returning({ id: softwareFactoryBlueprints.id });
    if (res.length === 0) throw new NotFoundException("Blueprint not found");
  }

  // --- Work orders ---

  async listWorkOrders(companyId: string, projectId: string) {
    await this.assertProjectInCompany(companyId, projectId);
    return this.db
      .select()
      .from(softwareFactoryWorkOrders)
      .where(
        and(
          eq(softwareFactoryWorkOrders.companyId, companyId),
          eq(softwareFactoryWorkOrders.projectId, projectId),
        ),
      )
      .orderBy(asc(softwareFactoryWorkOrders.sortOrder), desc(softwareFactoryWorkOrders.updatedAt));
  }

  async createWorkOrder(companyId: string, projectId: string, dto: CreateWorkOrderDto) {
    await this.assertProjectInCompany(companyId, projectId);
    await this.assertLinkedIssueForWorkOrder(companyId, projectId, dto.linkedIssueId ?? null);
    const plannedStartAt = this.parseOptionalInstant(dto.plannedStartAt ?? undefined);
    const plannedEndAt = this.parseOptionalInstant(dto.plannedEndAt ?? undefined);
    const [row] = await this.db
      .insert(softwareFactoryWorkOrders)
      .values({
        companyId,
        projectId,
        title: dto.title,
        descriptionMd: dto.descriptionMd ?? "",
        status: dto.status ?? "todo",
        assigneeAgentId: dto.assigneeAgentId ?? null,
        assignedUserId: dto.assignedUserId ?? null,
        dependsOnWorkOrderIds: dto.dependsOnWorkOrderIds ?? [],
        linkedBlueprintId: dto.linkedBlueprintId ?? null,
        linkedIssueId: dto.linkedIssueId ?? null,
        plannedStartAt: plannedStartAt ?? null,
        plannedEndAt: plannedEndAt ?? null,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    return row;
  }

  async patchWorkOrder(companyId: string, id: string, dto: PatchWorkOrderDto) {
    const [existing] = await this.db
      .select()
      .from(softwareFactoryWorkOrders)
      .where(and(eq(softwareFactoryWorkOrders.id, id), eq(softwareFactoryWorkOrders.companyId, companyId)))
      .limit(1);
    if (!existing) throw new NotFoundException("Work order not found");

    if (dto.linkedIssueId !== undefined) {
      await this.assertLinkedIssueForWorkOrder(companyId, existing.projectId, dto.linkedIssueId);
    }
    const plannedStartAt = dto.plannedStartAt !== undefined ? this.parseOptionalInstant(dto.plannedStartAt) : undefined;
    const plannedEndAt = dto.plannedEndAt !== undefined ? this.parseOptionalInstant(dto.plannedEndAt) : undefined;

    const [row] = await this.db
      .update(softwareFactoryWorkOrders)
      .set({
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.descriptionMd !== undefined ? { descriptionMd: dto.descriptionMd } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.assigneeAgentId !== undefined ? { assigneeAgentId: dto.assigneeAgentId } : {}),
        ...(dto.assignedUserId !== undefined ? { assignedUserId: dto.assignedUserId } : {}),
        ...(dto.dependsOnWorkOrderIds !== undefined ? { dependsOnWorkOrderIds: dto.dependsOnWorkOrderIds } : {}),
        ...(dto.linkedBlueprintId !== undefined ? { linkedBlueprintId: dto.linkedBlueprintId } : {}),
        ...(dto.linkedIssueId !== undefined ? { linkedIssueId: dto.linkedIssueId } : {}),
        ...(plannedStartAt !== undefined ? { plannedStartAt } : {}),
        ...(plannedEndAt !== undefined ? { plannedEndAt } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(eq(softwareFactoryWorkOrders.id, id))
      .returning();
    return row;
  }

  async batchPatchWorkOrders(companyId: string, projectId: string, dto: BatchPatchWorkOrdersDto) {
    await this.assertProjectInCompany(companyId, projectId);
    const results: unknown[] = [];
    for (const p of dto.patches ?? []) {
      const [wo] = await this.db
        .select()
        .from(softwareFactoryWorkOrders)
        .where(
          and(
            eq(softwareFactoryWorkOrders.id, p.id),
            eq(softwareFactoryWorkOrders.companyId, companyId),
            eq(softwareFactoryWorkOrders.projectId, projectId),
          ),
        )
        .limit(1);
      if (!wo) {
        throw new NotFoundException(`Work order not in project: ${p.id}`);
      }
      const { id: _id, ...patch } = p;
      const updated = await this.patchWorkOrder(companyId, p.id, patch);
      results.push(updated);
    }
    return results;
  }

  /**
   * Rule-based drafts for agents / UI (no LLM). Extend with Design Engineer later.
   */
  async suggestDesignAssist(
    companyId: string,
    projectId: string,
    dto: DesignAssistSuggestionsDto,
  ): Promise<{ suggestions: DesignAssistSuggestion[] }> {
    await this.assertProjectInCompany(companyId, projectId);
    const suggestions: DesignAssistSuggestion[] = [];

    if (dto.validationEventId) {
      const [ev] = await this.db
        .select()
        .from(softwareFactoryValidationEvents)
        .where(
          and(
            eq(softwareFactoryValidationEvents.id, dto.validationEventId),
            eq(softwareFactoryValidationEvents.companyId, companyId),
            eq(softwareFactoryValidationEvents.projectId, projectId),
          ),
        )
        .limit(1);
      if (ev) {
        const summary = ev.summary?.trim() || `Triage ${ev.source}`;
        suggestions.push({
          title: `Fix: ${summary.slice(0, 120)}`,
          descriptionMd:
            `## From Validator\n\n**Source:** ${ev.source}\n\n**Summary:** ${ev.summary ?? "—"}\n\n## Payload\n\n\`\`\`json\n${JSON.stringify(ev.rawPayload ?? {}, null, 2)}\n\`\`\`\n\n## Checklist\n\n- [ ] Reproduce\n- [ ] Identify owning blueprint / requirement\n- [ ] Update tests\n`,
        });
      }
    }

    if (dto.fromOpenRequirements) {
      const reqs = await this.listRequirements(companyId, projectId);
      for (const r of reqs) {
        const body = (r.bodyMd ?? "").trim();
        if (body.length > 400) continue;
        suggestions.push({
          title: `Implement: ${r.title}`.slice(0, 200),
          descriptionMd:
            `## Traceability\n\nRequirement **v${r.version}** (${r.id}).\n\n## Draft scope\n\n${body || "_No body — refine in Refinery._"}\n\n## Done when\n\n- [ ] Meets acceptance in requirement\n- [ ] Linked in Foundry if architectural\n`,
        });
      }
    }

    return { suggestions: suggestions.slice(0, 25) };
  }

  async deleteWorkOrder(companyId: string, id: string) {
    const res = await this.db
      .delete(softwareFactoryWorkOrders)
      .where(and(eq(softwareFactoryWorkOrders.id, id), eq(softwareFactoryWorkOrders.companyId, companyId)))
      .returning({ id: softwareFactoryWorkOrders.id });
    if (res.length === 0) throw new NotFoundException("Work order not found");
  }

  // --- Validation ---

  async listValidationEvents(companyId: string, projectId: string) {
    await this.assertProjectInCompany(companyId, projectId);
    return this.db
      .select()
      .from(softwareFactoryValidationEvents)
      .where(
        and(
          eq(softwareFactoryValidationEvents.companyId, companyId),
          eq(softwareFactoryValidationEvents.projectId, projectId),
        ),
      )
      .orderBy(desc(softwareFactoryValidationEvents.createdAt));
  }

  /**
   * Creates (or reuses) a normal project plus seeded factory rows so the client uses the same UI as production.
   * Only for non-production unless `ALLOW_FACTORY_PLAYGROUND=1`.
   */
  async ensureDevPlaygroundProject(companyId: string): Promise<{
    id: string;
    urlKey: string;
    name: string;
    seededFactory: boolean;
  }> {
    const [existingRow] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.companyId, companyId), eq(projects.name, FACTORY_PLAYGROUND_PROJECT_NAME)))
      .limit(1);

    const ps = projectService(this.db);
    let projectId: string;
    if (existingRow) {
      projectId = existingRow.id;
    } else {
      const created = await ps.create(companyId, {
        name: FACTORY_PLAYGROUND_PROJECT_NAME,
        description:
          "Dev fixture: real project + seeded Design Factory data (PLC-style gates + engineering WOs) for UI demos. Safe to archive or delete.",
        status: "in_progress",
      });
      projectId = created.id;
    }

    const hydrated = await ps.getById(projectId);
    if (!hydrated) {
      throw new NotFoundException("Playground project could not be loaded");
    }

    const existingReqs = await this.listRequirements(companyId, hydrated.id);
    const hasCurrentDemo = existingReqs.some((r) => r.title.startsWith(PLAYGROUND_SEED_MARKER));
    let seededFactory = false;
    if (existingReqs.length === 0 || !hasCurrentDemo) {
      if (existingReqs.length > 0) {
        await this.clearFactoryRowsForProject(companyId, hydrated.id);
      }
      await this.seedPlaygroundFactoryRows(companyId, hydrated.id);
      seededFactory = true;
    }

    return {
      id: hydrated.id,
      urlKey: hydrated.urlKey,
      name: hydrated.name,
      seededFactory,
    };
  }

  private async clearFactoryRowsForProject(companyId: string, projectId: string): Promise<void> {
    await this.db
      .delete(softwareFactoryValidationEvents)
      .where(
        and(
          eq(softwareFactoryValidationEvents.companyId, companyId),
          eq(softwareFactoryValidationEvents.projectId, projectId),
        ),
      );
    await this.db
      .delete(softwareFactoryWorkOrders)
      .where(
        and(eq(softwareFactoryWorkOrders.companyId, companyId), eq(softwareFactoryWorkOrders.projectId, projectId)),
      );
    await this.db
      .delete(softwareFactoryBlueprints)
      .where(
        and(eq(softwareFactoryBlueprints.companyId, companyId), eq(softwareFactoryBlueprints.projectId, projectId)),
      );
    await this.db
      .delete(softwareFactoryRequirements)
      .where(
        and(eq(softwareFactoryRequirements.companyId, companyId), eq(softwareFactoryRequirements.projectId, projectId)),
      );
  }

  /** Rich demo: PLC-style gates as work orders + Refinery/Foundry/Validator samples. */
  private async seedPlaygroundFactoryRows(companyId: string, projectId: string): Promise<void> {
    const rOverview = await this.createRequirement(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — Program lifecycle (demo)`,
      bodyMd:
        "## Purpose\n\nThis project is **seeded** so you can explore **Design Factory** end-to-end: requirements, blueprints, **Planner work orders** (including **PDR / CDR / TRR**-style gates), and **Validator** events.\n\n## How gates map to work orders\n\nGates are **milestones**; here each gate is one **work order** with checklist-style `description_md`. Dependencies encode **phase order** (SRR → PDR → CDR → TRR).\n",
      structuredYaml:
        "phase: demo\nlifecycle: [SRR, PDR, CDR, TRR]\nnote: Gates modeled as WOs; artifacts live in Refinery/Foundry/canvas.",
    });
    const rSrr = await this.createRequirement(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — SRR (system requirements review)`,
      bodyMd:
        "## Exit criteria\n\n- Stakeholders agree on problem statement and MoSCoW scope.\n- High-level constraints captured (perf, security, compliance).\n- Traceability IDs assigned for downstream PDR.\n",
    });
    const rPdr = await this.createRequirement(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — PDR (preliminary design review)`,
      bodyMd:
        "## Exit criteria\n\n- Architecture alternatives evaluated (ADR summaries).\n- Major risks + mitigations listed.\n- Interfaces between subsystems identified.\n",
    });
    const rCdr = await this.createRequirement(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — CDR (critical design review)`,
      bodyMd:
        "## Exit criteria\n\n- Design matches allocated requirements.\n- Test strategy covers critical paths.\n- Production readiness gaps named explicitly.\n",
    });
    const rTrr = await this.createRequirement(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — TRR / release readiness`,
      bodyMd:
        "## Exit criteria\n\n- Rollback / feature-flag plan documented.\n- Observability: SLOs, dashboards, alerts.\n- Security review complete for exposed surface.\n",
    });
    const rApi = await this.createRequirement(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — API backward compatibility`,
      bodyMd:
        "## Policy\n\n- No breaking JSON field removals within major version.\n- Deprecations: 90-day notice in changelog + `Sunset` header where applicable.\n",
    });
    const rObs = await this.createRequirement(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — Observability & SLOs`,
      bodyMd:
        "## Must have\n\n- RED metrics for core APIs.\n- Error budget policy tied to release gates.\n",
    });

    const bpLifecycle = await this.createBlueprint(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — Lifecycle & gate flow`,
      bodyMd:
        "### Summary\n\nSingle diagram for **kickoff → SRR → PDR → CDR → TRR**. Planner work orders below mirror this chain with `depends_on` edges.\n\n### Artifacts\n\n- Refinery: exit criteria per gate.\n- Planner: one WO per gate + engineering tasks.\n- Validator: CI/review events loop back into Planner.\n",
      diagramMermaid:
        "flowchart TB\n  K[Kickoff] --> SRR[SRR]\n  SRR --> PDR[PDR]\n  PDR --> CDR[CDR]\n  CDR --> TRR[TRR / release]\n  TRR --> V[Validator feedback]\n  V --> PDR",
      linkedRequirementIds: [rOverview.id, rSrr.id, rPdr.id, rCdr.id, rTrr.id],
    });
    const bpServices = await this.createBlueprint(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — Service topology (release train)`,
      bodyMd:
        "### Components\n\n- **Edge API** — public HTTP, auth, rate limits.\n- **Core svc** — domain logic, idempotent workers.\n- **Obs pipeline** — metrics, traces, structured logs.\n\n### Notes\n\nTie **TRR** work order to observability requirements before marking release-ready.\n",
      diagramMermaid:
        "flowchart LR\n  Client[Clients] --> Edge[Edge API]\n  Edge --> Core[Core service]\n  Core --> DB[(DB)]\n  Edge --> Metrics[Metrics]\n  Core --> Metrics",
      linkedRequirementIds: [rApi.id, rObs.id, rCdr.id],
    });
    await this.createBlueprint(companyId, projectId, {
      title: `${PLAYGROUND_SEED_MARKER} — UI shell (Design Factory tab)`,
      bodyMd:
        "### Intent\n\nProject **Design Factory** tab hosts Refinery → Foundry → Planner → Validator with the same document-grade editors as production.\n",
      linkedRequirementIds: [rOverview.id],
    });

    let sort = 0;
    const woKickoff = await this.createWorkOrder(companyId, projectId, {
      title: "Gate: Program kickoff — charter & core team",
      descriptionMd:
        "## Done when\n\n- [ ] Charter one-pager approved\n- [ ] PM / tech lead / sponsor named\n- [ ] Communication rhythm set\n\n_Milestone-style work order (PLC gate as WO)._",
      status: "todo",
      sortOrder: sort++,
      linkedBlueprintId: bpLifecycle.id,
    });
    const woSrr = await this.createWorkOrder(companyId, projectId, {
      title: "Gate: SRR — system requirements review",
      descriptionMd:
        "## Done when\n\n- [ ] MoSCoW scope agreed\n- [ ] Stakeholder sign-off recorded\n- [ ] Req IDs traced in Refinery\n",
      status: "done",
      sortOrder: sort++,
      linkedBlueprintId: bpLifecycle.id,
      dependsOnWorkOrderIds: [woKickoff.id],
    });
    const woPdr = await this.createWorkOrder(companyId, projectId, {
      title: "Gate: PDR — preliminary design review",
      descriptionMd:
        "## Done when\n\n- [ ] Architecture options + ADR summary\n- [ ] Risks + mitigations\n- [ ] Interface list updated\n",
      status: "done",
      sortOrder: sort++,
      linkedBlueprintId: bpLifecycle.id,
      dependsOnWorkOrderIds: [woSrr.id],
    });
    const woCdr = await this.createWorkOrder(companyId, projectId, {
      title: "Gate: CDR — critical design review",
      descriptionMd:
        "## Done when\n\n- [ ] Design vs requirements matrix green\n- [ ] Test plan for critical paths\n- [ ] Open issues triaged with owners\n",
      status: "in_progress",
      sortOrder: sort++,
      linkedBlueprintId: bpServices.id,
      dependsOnWorkOrderIds: [woPdr.id],
    });
    const woTrr = await this.createWorkOrder(companyId, projectId, {
      title: "Gate: TRR — test / release readiness",
      descriptionMd:
        "## Done when\n\n- [ ] Rollback + feature flags verified\n- [ ] SLO dashboards live\n- [ ] Security checklist complete\n",
      status: "todo",
      sortOrder: sort++,
      linkedBlueprintId: bpServices.id,
      dependsOnWorkOrderIds: [woCdr.id],
    });
    const woFlags = await this.createWorkOrder(companyId, projectId, {
      title: "Implement feature-flag framework (release train)",
      descriptionMd:
        "## Scope\n\n- [ ] Percentage + allow-list rollout\n- [ ] Kill switch documented\n\nDepends on **CDR** starting; unblock **E2E** when stable.\n",
      status: "in_progress",
      sortOrder: sort++,
      linkedBlueprintId: bpServices.id,
      dependsOnWorkOrderIds: [woPdr.id],
    });
    await this.createWorkOrder(companyId, projectId, {
      title: "Publish gate checklist template (wiki / doc)",
      descriptionMd: "## Done when\n\n- [ ] Template linked from project overview\n- [ ] Owners know where to record decisions\n",
      status: "done",
      sortOrder: sort++,
      linkedBlueprintId: bpLifecycle.id,
    });
    const woE2e = await this.createWorkOrder(companyId, projectId, {
      title: "E2E: main pipeline + Design Factory smoke",
      descriptionMd:
        "## Blocked on\n\nFeature-flag framework stability.\n\n## Done when\n\n- [ ] Playwright (or equivalent) green on `main`\n",
      status: "blocked",
      sortOrder: sort++,
      linkedBlueprintId: bpServices.id,
      dependsOnWorkOrderIds: [woFlags.id],
    });

    await this.db.insert(softwareFactoryValidationEvents).values({
      companyId,
      projectId,
      source: "ci",
      rawPayload: {
        job: "main-e2e",
        url: "https://ci.example.local/job/123",
        failedStep: "design-factory-smoke",
      },
      summary: "E2E failed: design-factory-smoke (blocked WO — triage)",
      createdWorkOrderId: woE2e.id,
    });
    await this.db.insert(softwareFactoryValidationEvents).values({
      companyId,
      projectId,
      source: "review",
      rawPayload: { reviewer: "staff@example.com", pr: 442 },
      summary: "PDR doc: add explicit NFR section for latency (follow-up in Refinery)",
      createdWorkOrderId: null,
    });
  }

  async createValidationEvent(companyId: string, projectId: string, dto: CreateValidationEventDto) {
    await this.assertProjectInCompany(companyId, projectId);
    let createdWorkOrderId: string | null = null;
    if (dto.createWorkOrder) {
      const title =
        dto.workOrderTitle?.trim() ||
        `From validation: ${dto.source}`.slice(0, 200);
      const [wo] = await this.db
        .insert(softwareFactoryWorkOrders)
        .values({
          companyId,
          projectId,
          title,
          descriptionMd: dto.summary ?? JSON.stringify(dto.rawPayload ?? {}, null, 2),
          status: "todo",
        })
        .returning();
      createdWorkOrderId = wo.id;
    }

    const [row] = await this.db
      .insert(softwareFactoryValidationEvents)
      .values({
        companyId,
        projectId,
        source: dto.source,
        rawPayload: dto.rawPayload ?? {},
        summary: dto.summary ?? null,
        createdWorkOrderId,
      })
      .returning();
    return row;
  }
}
