import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertWorkspaceAccess } from "../auth/authz.js";
import { PlcService } from "./plc.service.js";
import type { CreatePlcTemplateDto, PatchPlcTemplateDto } from "./plc.types.js";

@Controller("companies/:companyId/plc-templates")
export class PlcController {
  constructor(
    @Inject(PlcService) private readonly plcService: PlcService,
  ) {}

  @Get()
  async list(@Req() req: Request & { actor?: Actor }, @Param("companyId") companyId: string) {
    assertWorkspaceAccess(req, companyId);
    return this.plcService.list(companyId);
  }

  @Get(":id")
  async get(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
  ) {
    assertWorkspaceAccess(req, companyId);
    return this.plcService.get(companyId, id);
  }

  @Post()
  async create(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Body() body: CreatePlcTemplateDto,
  ) {
    assertWorkspaceAccess(req, companyId);
    return this.plcService.create(companyId, body);
  }

  @Patch(":id")
  async patch(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
    @Body() body: PatchPlcTemplateDto,
  ) {
    assertWorkspaceAccess(req, companyId);
    return this.plcService.patch(companyId, id, body);
  }

  @Delete(":id")
  async delete(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
  ) {
    assertWorkspaceAccess(req, companyId);
    await this.plcService.delete(companyId, id);
    return { ok: true as const };
  }
}
