import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, asc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { plcTemplates } from "@paperclipai/db";
import { isUuidLike } from "@paperclipai/shared";
import { DB } from "../db/db.module.js";
import type { CreatePlcTemplateDto, PatchPlcTemplateDto, PlcStagesGraph } from "./plc.types.js";

function validateStagesGraph(stages: unknown): stages is PlcStagesGraph {
  if (!stages || typeof stages !== "object" || stages === null) return false;
  const s = stages as Record<string, unknown>;
  if (!Array.isArray(s.nodes)) return false;
  if (!Array.isArray(s.edges)) return false;
  const nodeIds = new Set<string>();
  for (const node of s.nodes) {
    if (!node || typeof node !== "object") return false;
    const n = node as Record<string, unknown>;
    if (typeof n.id !== "string" || !n.id) return false;
    if (nodeIds.has(n.id)) return false; // duplicate node id
    nodeIds.add(n.id);
    if (typeof n.label !== "string" || !n.label) return false;
    if (!["gate", "phase", "checkpoint"].includes(n.kind as string)) return false;
  }
  for (const edge of s.edges) {
    if (!edge || typeof edge !== "object") return false;
    const e = edge as Record<string, unknown>;
    if (typeof e.from !== "string" || !nodeIds.has(e.from)) return false;
    if (typeof e.to !== "string" || !nodeIds.has(e.to)) return false;
  }
  return true;
}

function assertUuid(value: string, label: string) {
  if (!isUuidLike(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}

@Injectable()
export class PlcService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(companyId: string) {
    assertUuid(companyId, "companyId");
    return this.db
      .select()
      .from(plcTemplates)
      .where(eq(plcTemplates.companyId, companyId))
      .orderBy(asc(plcTemplates.name));
  }

  async get(companyId: string, id: string) {
    assertUuid(companyId, "companyId");
    assertUuid(id, "id");
    const [row] = await this.db
      .select()
      .from(plcTemplates)
      .where(and(eq(plcTemplates.id, id), eq(plcTemplates.companyId, companyId)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("PLC template not found");
    }
    return row;
  }

  async create(companyId: string, dto: CreatePlcTemplateDto) {
    assertUuid(companyId, "companyId");
    if (dto.stages !== undefined && !validateStagesGraph(dto.stages)) {
      throw new BadRequestException("Invalid stages graph structure");
    }
    const [row] = await this.db
      .insert(plcTemplates)
      .values({
        companyId,
        name: dto.name,
        description: dto.description ?? null,
        stages: dto.stages ?? { nodes: [], edges: [] },
      })
      .returning();
    return row;
  }

  async patch(companyId: string, id: string, dto: PatchPlcTemplateDto) {
    assertUuid(companyId, "companyId");
    assertUuid(id, "id");
    await this.get(companyId, id); // throws NotFoundException
    if (dto.stages !== undefined && !validateStagesGraph(dto.stages)) {
      throw new BadRequestException("Invalid stages graph structure");
    }
    const [row] = await this.db
      .update(plcTemplates)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.stages !== undefined ? { stages: dto.stages } : {}),
      })
      .where(and(eq(plcTemplates.id, id), eq(plcTemplates.companyId, companyId)))
      .returning();
    return row;
  }

  async delete(companyId: string, id: string) {
    assertUuid(companyId, "companyId");
    assertUuid(id, "id");
    await this.get(companyId, id);
    await this.db
      .delete(plcTemplates)
      .where(and(eq(plcTemplates.id, id), eq(plcTemplates.companyId, companyId)));
    return { ok: true as const };
  }
}
