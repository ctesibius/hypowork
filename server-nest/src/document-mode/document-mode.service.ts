import { Injectable, Logger } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import {
  DocumentMode,
  DocumentModeSwitchRequest,
  DocumentModeResult,
} from "./document-mode.types.js";

/** Static copy for view-switch API — avoids controller DI edge cases (see document-mode controller). */
export function getDocumentModeMigrationWarnings(): string[] {
  return [
    "Prose is placed on the canvas as a Note (sticky) card when you switch.",
    "Edits on the canvas are stored as graph JSON on the document until you switch views again.",
    "Switching back to prose takes text from Note and Sketch nodes (other card types are not turned into prose).",
  ];
}

/**
 * DocumentModeService - Prose ↔ Canvas view switch (Phase 1.7g)
 *
 * Hypopedia/AFFiNE-style:
 * - One document id, same route, same body — switching is a VIEW CHANGE, not migration
 * - Document body stays unchanged; canvas view renders it as a Note card
 * - User-added elements (shapes, connectors, annotations) are private to the canvas view
 * - "Make Standalone" extracts selected canvas elements → new document
 */
@Injectable()
export class DocumentModeService {
  private readonly logger = new Logger(DocumentModeService.name);

  constructor() {}

  /**
   * Switch document between prose and canvas views.
   *
   * NO content migration — document.body is never modified.
   * The document renders as a Note card in canvas view; private canvas
   * elements are stored separately in canvas_elements.
   *
   * Returns a result indicating the target mode was accepted.
   * The caller (DocumentsController) sets `kind` on the document if needed
   * to persist the active surface, then the frontend renders the appropriate view.
   */
  async switchMode(
    companyId: string,
    request: DocumentModeSwitchRequest,
  ): Promise<DocumentModeResult> {
    const { documentId, targetMode } = request;

    this.logger.log(
      `View switch for document ${documentId} → ${targetMode} (no body migration)`,
    );

    return {
      documentId,
      mode: targetMode,
      migrated: false,
    };
  }

  /**
   * Get warnings for a view switch — canvas view shows document as a Note card.
   * No content is lost in either direction since nothing is migrated.
   */
  getMigrationWarnings(): string[] {
    return getDocumentModeMigrationWarnings();
  }

  /**
   * View switch never loses content — body is never touched.
   */
  wouldLoseContent(): boolean {
    return false;
  }
}
