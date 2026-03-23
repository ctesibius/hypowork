import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type {
  LearnerExperiment,
  CreateExperimentDto,
  RunIterationDto,
} from "./learner.types.js";
import { LearnerService } from "./learner.service.js";

/**
 * Learner API Controller - Phase 1.4
 *
 * Endpoints for autoresearch-style loop:
 * - Create experiments
 * - Run iterations
 * - Get summaries
 */
@Controller("companies/:companyId/learner")
export class LearnerController {
  constructor(private readonly learnerService: LearnerService) {}

  /**
   * Create a new learner experiment
   * POST /companies/:companyId/learner/experiments
   */
  @Post("experiments")
  @HttpCode(HttpStatus.CREATED)
  async createExperiment(
    @Param("companyId") companyId: string,
    @Body() body: CreateExperimentDto,
  ): Promise<LearnerExperiment> {
    return this.learnerService.createExperiment({
      ...body,
      companyId,
    });
  }

  /**
   * List experiments for a company
   * GET /companies/:companyId/learner/experiments
   */
  @Get("experiments")
  async listExperiments(
    @Param("companyId") companyId: string,
  ): Promise<LearnerExperiment[]> {
    return this.learnerService.listExperiments(companyId);
  }

  /**
   * Get an experiment
   * GET /companies/:companyId/learner/experiments/:experimentId
   */
  @Get("experiments/:experimentId")
  async getExperiment(
    @Param("companyId") companyId: string,
    @Param("experimentId") experimentId: string,
  ): Promise<LearnerExperiment | null> {
    return this.learnerService.getExperiment(companyId, experimentId);
  }

  /**
   * Run an iteration
   * POST /companies/:companyId/learner/experiments/:experimentId/iterations
   */
  @Post("experiments/:experimentId/iterations")
  @HttpCode(HttpStatus.CREATED)
  async runIteration(
    @Param("companyId") companyId: string,
    @Param("experimentId") experimentId: string,
    @Body() body: RunIterationDto,
  ) {
    return this.learnerService.runIteration(
      companyId,
      experimentId,
      body.artifactContent,
    );
  }

  /**
   * Generate experiment summary
   * GET /companies/:companyId/learner/experiments/:experimentId/summary
   */
  @Get("experiments/:experimentId/summary")
  async generateSummary(
    @Param("companyId") companyId: string,
    @Param("experimentId") experimentId: string,
  ): Promise<{ summary: string }> {
    const summary = await this.learnerService.generateSummary(companyId, experimentId);
    return { summary };
  }

  /**
   * Get next action recommendation
   * GET /companies/:companyId/learner/experiments/:experimentId/next-action
   */
  @Get("experiments/:experimentId/next-action")
  async getNextAction(
    @Param("companyId") companyId: string,
    @Param("experimentId") experimentId: string,
  ) {
    const experiment = await this.learnerService.getExperiment(companyId, experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }
    return this.learnerService.getNextAction(experiment);
  }
}
