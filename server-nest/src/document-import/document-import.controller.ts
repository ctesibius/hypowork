/**
 * Document import controller.
 *
 * POST /companies/:companyId/import  (alias: /workspaces/:companyId/import)
 *   Multipart form: file (required), projectId (optional)
 *   Accepts `.md` / `.mdx` or `.zip`.
 *
 * **Obsidian-style vault ZIP:** Folder structure inside the archive is treated as **collection
 * placement** (virtual grouping), not server directories — each nested path becomes
 * `collectionPath` on the created document (persisted as `folder_path` in DB). Single-file `.md`
 * uploads use the optional subdirectory in `originalname` the same way.
 *
 * The route lives in Nest (not Express routes) so it can reuse DI and auth guards.
 */

import {
  Controller,
  Inject,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import type { Request, Response } from "express";
import multer from "multer";
import type { Actor } from "../auth/actor.guard.js";
import { assertWorkspaceAccess } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { MAX_ATTACHMENT_BYTES } from "@paperclipai/server/attachment-types";
import { DB } from "../db/db.module.js";
import { importMarkdownFile, importMarkdownZip, type ImportResult } from "./document-import.service.js";

/** 50 MB limit for document import uploads — larger than general attachments to support ZIP vaults with media. */
const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;

@Controller()
export class DocumentImportController {
  private readonly log = new Logger(DocumentImportController.name);

  private readonly upload;

  constructor(@Inject(DB) private readonly db: Db) {
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_IMPORT_FILE_BYTES, files: 1 },
    });
  }

  private async runUpload(req: Request, res: Response): Promise<Express.Multer.File | undefined> {
    return new Promise((resolve, reject) => {
      this.upload.single("file")(req, res, (err: unknown) => {
        if (err) reject(err);
        else resolve((req as Request & { file?: Express.Multer.File }).file);
      });
    });
  }

  @Post(["companies/:companyId/import", "workspaces/:companyId/import"])
  @UseInterceptors() // multer is run manually in handler
  async importDocuments(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertWorkspaceAccess(req, companyId);

    let file: Express.Multer.File | undefined;
    try {
      file = await this.runUpload(req, res);
    } catch (err) {
      this.log.error("Multer error", err);
      return res.status(400).json({ error: "File upload failed", detail: String(err) });
    }

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const projectId =
      typeof req.body?.projectId === "string" && req.body.projectId.trim().length > 0
        ? req.body.projectId.trim()
        : undefined;

    const filename = file.originalname;
    const isZip = filename.endsWith(".zip") || filename.endsWith(".ZIP");

    if (isZip) {
      const result: ImportResult = await importMarkdownZip(
        this.db,
        file.buffer,
        companyId,
        projectId,
      );
      return res.status(200).json(result);
    }

    if (filename.endsWith(".md") || filename.endsWith(".MD") || filename.endsWith(".mdx")) {
      const result = await importMarkdownFile(
        this.db,
        file.buffer.toString("utf-8"),
        filename,
        companyId,
        projectId,
      );
      return res.status(201).json({
        imported: [{ id: result.id, title: result.title, filename }],
        failed: [],
      });
    }

    return res.status(400).json({ error: "Unsupported file type. Use .md, .mdx, or .zip" });
  }
}
