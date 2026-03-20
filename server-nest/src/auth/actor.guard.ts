import {
  Inject,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

export type Actor =
  | {
      type: "board";
      userId: string;
      source: string; // e.g. "local_implicit" or "session"
      isInstanceAdmin: boolean;
      companyIds?: string[];
      runId?: string;
    }
  | {
      type: "none";
      source: "none";
      runId?: string;
    }
  | {
      type: "agent";
      agentId: string;
      companyId: string;
      keyId?: string;
      source: string; // e.g. "agent_key" or "agent_jwt"
      runId?: string;
    };

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

export const ACTOR_KEY = "actor";

@Injectable()
export class ActorGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.actor || request.actor.type === "none") {
      throw new UnauthorizedException("No actor");
    }
    return true;
  }
}
