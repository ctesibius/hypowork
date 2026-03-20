import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { boardMutationGuard } from "@paperclipai/server/middleware/board-mutation-guard";

@Injectable()
export class BoardMutationMiddleware implements NestMiddleware {
  private readonly guard: ReturnType<typeof boardMutationGuard>;

  constructor() {
    this.guard = boardMutationGuard();
  }

  use(req: Request, res: Response, next: NextFunction) {
    return this.guard(req, res, next);
  }
}
