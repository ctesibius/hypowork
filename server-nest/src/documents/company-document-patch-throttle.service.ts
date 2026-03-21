import { Injectable } from "@nestjs/common";
import type { Actor } from "../auth/actor.guard.js";

/** Sliding window limit for PATCH .../documents/:id (autosave bursts). */
const WINDOW_MS = 60_000;
const MAX_PATCHES_PER_WINDOW = 100;

function throttleKey(actor: Actor, companyId: string, documentId: string): string | null {
  if (actor.type === "none") return null;
  if (actor.type === "agent") {
    return `a:${actor.agentId}:${companyId}:${documentId}`;
  }
  return `b:${actor.userId}:${companyId}:${documentId}`;
}

@Injectable()
export class CompanyDocumentPatchThrottleService {
  private readonly hits = new Map<string, number[]>();

  /** Returns true if under limit; false if rate limit exceeded. */
  tryConsume(actor: Actor, companyId: string, documentId: string): boolean {
    const key = throttleKey(actor, companyId, documentId);
    if (!key) return false;

    const now = Date.now();
    const prev = this.hits.get(key) ?? [];
    const recent = prev.filter((t) => now - t < WINDOW_MS);

    if (recent.length >= MAX_PATCHES_PER_WINDOW) {
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
