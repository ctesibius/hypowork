import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess } from "../auth/authz.js";
import { SoftwareFactoryService } from "./software-factory.service.js";
import type {
  BatchPatchWorkOrdersDto,
  CreateBlueprintDto,
  CreateRequirementDto,
  CreateValidationEventDto,
  CreateWorkOrderDto,
  DesignAssistSuggestionsDto,
  PatchBlueprintDto,
  PatchRequirementDto,
  PatchWorkOrderDto,
} from "./software-factory.types.js";

@Controller("companies/:companyId/software-factory")
export class SoftwareFactoryController {
  constructor(
    /** Explicit token: `tsx` dev does not always emit `design:paramtypes`, so default ctor injection can be `undefined`. */
    @Inject(SoftwareFactoryService) private readonly softwareFactoryService: SoftwareFactoryService,
  ) {}

  @Get("search")
  async search(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query("q") q: string | undefined,
    @Query("mode") mode: string | undefined,
    @Query("limit") limitRaw?: string,
  ) {
    assertCompanyAccess(req, companyId);
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 40;
    return this.softwareFactoryService.globalSearch(
      companyId,
      q ?? "",
      Number.isFinite(limit) ? limit : 40,
      mode,
    );
  }

  /** Idempotent: real project + optional factory seed for local UI testing (not production unless ALLOW_FACTORY_PLAYGROUND=1). */
  @Post("dev/ensure-playground-project")
  async ensureDevPlayground(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);
    const allowed =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_FACTORY_PLAYGROUND === "1";
    if (!allowed) {
      throw new ForbiddenException("Factory playground is only available in development");
    }
    return this.softwareFactoryService.ensureDevPlaygroundProject(companyId);
  }

  // --- Requirements ---

  @Get("projects/:projectId/requirements")
  async listRequirements(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.listRequirements(companyId, projectId);
  }

  @Get("requirements/:id")
  async getRequirement(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.getRequirement(companyId, id);
  }

  @Post("projects/:projectId/requirements")
  async createRequirement(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
    @Body() body: CreateRequirementDto,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.createRequirement(companyId, projectId, body);
  }

  @Patch("requirements/:id")
  async patchRequirement(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
    @Body() body: PatchRequirementDto,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.patchRequirement(companyId, id, body);
  }

  @Delete("requirements/:id")
  async deleteRequirement(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
  ) {
    assertCompanyAccess(req, companyId);
    await this.softwareFactoryService.deleteRequirement(companyId, id);
    return { ok: true as const };
  }

  // --- Blueprints ---

  @Get("projects/:projectId/blueprints")
  async listBlueprints(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.listBlueprints(companyId, projectId);
  }

  @Get("blueprints/:id")
  async getBlueprint(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.getBlueprint(companyId, id);
  }

  @Post("projects/:projectId/blueprints")
  async createBlueprint(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
    @Body() body: CreateBlueprintDto,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.createBlueprint(companyId, projectId, body);
  }

  @Patch("blueprints/:id")
  async patchBlueprint(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
    @Body() body: PatchBlueprintDto,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.patchBlueprint(companyId, id, body);
  }

  @Delete("blueprints/:id")
  async deleteBlueprint(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
  ) {
    assertCompanyAccess(req, companyId);
    await this.softwareFactoryService.deleteBlueprint(companyId, id);
    return { ok: true as const };
  }

  // --- Work orders ---

  @Get("projects/:projectId/work-orders")
  async listWorkOrders(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.listWorkOrders(companyId, projectId);
  }

  @Get("work-orders/:id")
  async getWorkOrder(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.getWorkOrder(companyId, id);
  }

  @Post("projects/:projectId/work-orders")
  async createWorkOrder(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
    @Body() body: CreateWorkOrderDto,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.createWorkOrder(companyId, projectId, body);
  }

  @Patch("work-orders/:id")
  async patchWorkOrder(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
    @Body() body: PatchWorkOrderDto,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.patchWorkOrder(companyId, id, body);
  }

  @Post("projects/:projectId/work-orders/batch-patch")
  async batchPatchWorkOrders(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
    @Body() body: BatchPatchWorkOrdersDto,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.batchPatchWorkOrders(companyId, projectId, body);
  }

  @Post("projects/:projectId/design-assist/suggestions")
  async designAssistSuggestions(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
    @Body() body: DesignAssistSuggestionsDto,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.suggestDesignAssist(companyId, projectId, body ?? {});
  }

  @Delete("work-orders/:id")
  async deleteWorkOrder(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("id") id: string,
  ) {
    assertCompanyAccess(req, companyId);
    await this.softwareFactoryService.deleteWorkOrder(companyId, id);
    return { ok: true as const };
  }

  // --- Validation ---

  @Get("projects/:projectId/validation-events")
  async listValidationEvents(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.listValidationEvents(companyId, projectId);
  }

  @Post("projects/:projectId/validation-events")
  async createValidationEvent(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("projectId") projectId: string,
    @Body() body: CreateValidationEventDto,
  ) {
    assertCompanyAccess(req, companyId);
    return this.softwareFactoryService.createValidationEvent(companyId, projectId, body);
  }
}
