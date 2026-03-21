import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { CompanyDocumentPatchThrottleService } from "./company-document-patch-throttle.service.js";

@Injectable()
export class CompanyDocumentPatchThrottleGuard implements CanActivate {
  constructor(
    @Inject(CompanyDocumentPatchThrottleService)
    private readonly throttle: CompanyDocumentPatchThrottleService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const actor = req.actor;
    if (!actor || actor.type === "none") {
      throw new UnauthorizedException("No actor");
    }

    const companyId = req.params["companyId"] as string | undefined;
    const documentId = req.params["documentId"] as string | undefined;
    if (!companyId || !documentId) {
      return true;
    }

    if (!this.throttle.tryConsume(actor, companyId, documentId)) {
      throw new HttpException(
        "Too many document save requests; try again shortly.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
