import { Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import multer from "multer";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { assetService as expressAssetService } from "@paperclipai/server/services/assets";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { createStorageServiceFromConfig } from "@paperclipai/server/storage";
import { loadConfig } from "@paperclipai/server/config";
import { createAssetImageMetadataSchema } from "@paperclipai/shared";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "@paperclipai/server/attachment-types";
import { DB } from "../db/db.module.js";

const SVG_CONTENT_TYPE = "image/svg+xml";
const ALLOWED_COMPANY_LOGO_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  SVG_CONTENT_TYPE,
]);

function sanitizeSvgBuffer(input: Buffer): Buffer | null {
  const raw = input.toString("utf8").trim();
  if (!raw) return null;

  const baseDom = new JSDOM("");
  const domPurify = createDOMPurify(
    baseDom.window as unknown as Parameters<typeof createDOMPurify>[0],
  );
  domPurify.addHook("uponSanitizeAttribute", (_node: unknown, data: any) => {
    const attrName = data.attrName.toLowerCase();
    const attrValue = (data.attrValue ?? "").trim();

    if (attrName.startsWith("on")) {
      data.keepAttr = false;
      return;
    }

    if ((attrName === "href" || attrName === "xlink:href") && attrValue && !attrValue.startsWith("#")) {
      data.keepAttr = false;
    }
  });

  let parsedDom: JSDOM | null = null;
  try {
    const sanitized = domPurify.sanitize(raw, {
      USE_PROFILES: { svg: true, svgFilters: true, html: false },
      FORBID_TAGS: ["script", "foreignObject"],
      FORBID_CONTENTS: ["script", "foreignObject"],
      RETURN_TRUSTED_TYPE: false,
    });

    parsedDom = new JSDOM(sanitized, { contentType: SVG_CONTENT_TYPE });
    const document = parsedDom.window.document;
    const root = document.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") return null;

    for (const el of Array.from(root.querySelectorAll("script, foreignObject"))) {
      el.remove();
    }
    for (const el of Array.from(root.querySelectorAll("*")) as Element[]) {
      for (const attr of Array.from(el.attributes)) {
        const attrName = attr.name.toLowerCase();
        const attrValue = attr.value.trim();
        if (attrName.startsWith("on")) {
          el.removeAttribute(attr.name);
          continue;
        }
        if ((attrName === "href" || attrName === "xlink:href") && attrValue && !attrValue.startsWith("#")) {
          el.removeAttribute(attr.name);
        }
      }
    }

    const output = root.outerHTML.trim();
    if (!output || !/^<svg[\s>]/i.test(output)) return null;
    return Buffer.from(output, "utf8");
  } catch {
    return null;
  } finally {
    parsedDom?.window.close();
    baseDom.window.close();
  }
}

@Controller()
export class AssetsController {
  private readonly svc;
  private readonly storage;
  private readonly assetUpload;
  private readonly companyLogoUpload;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressAssetService(db);
    const config = loadConfig();
    this.storage = createStorageServiceFromConfig(config);
    this.assetUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
    });
    this.companyLogoUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
    });
  }

  private async runSingleFileUpload(
    upload: ReturnType<typeof multer>,
    req: Request,
    res: Response,
  ) {
    await new Promise<void>((resolve, reject) => {
      upload.single("file")(req, res, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  @Post("companies/:companyId/assets/images")
  async uploadAssetImage(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);

    try {
      await this.runSingleFileUpload(this.assetUpload, req, res);
    } catch (err: unknown) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(422).json({ error: `File exceeds ${MAX_ATTACHMENT_BYTES} bytes` });
        }
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    const file = (req as Request & { file?: { mimetype: string; buffer: Buffer; originalname: string } }).file;
    if (!file) {
      return res.status(400).json({ error: "Missing file field 'file'" });
    }

    const parsedMeta = createAssetImageMetadataSchema.safeParse(req.body ?? {});
    if (!parsedMeta.success) {
      return res.status(400).json({ error: "Invalid image metadata", details: parsedMeta.error.issues });
    }

    const namespaceSuffix = parsedMeta.data.namespace ?? "general";
    const contentType = (file.mimetype || "").toLowerCase();
    if (contentType !== SVG_CONTENT_TYPE && !isAllowedContentType(contentType)) {
      return res.status(422).json({ error: `Unsupported file type: ${contentType || "unknown"}` });
    }
    let fileBody = file.buffer;
    if (contentType === SVG_CONTENT_TYPE) {
      const sanitized = sanitizeSvgBuffer(file.buffer);
      if (!sanitized || sanitized.length <= 0) {
        return res.status(422).json({ error: "SVG could not be sanitized" });
      }
      fileBody = sanitized;
    }
    if (fileBody.length <= 0) {
      return res.status(422).json({ error: "Image is empty" });
    }

    const actor = getActorInfo(req);
    const stored = await this.storage.putFile({
      companyId,
      namespace: `assets/${namespaceSuffix}`,
      originalFilename: file.originalname || null,
      contentType,
      body: fileBody,
    });

    const asset = await this.svc.create(companyId, {
      provider: stored.provider,
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      originalFilename: stored.originalFilename,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "asset.created",
      entityType: "asset",
      entityId: asset.id,
      details: {
        originalFilename: asset.originalFilename,
        contentType: asset.contentType,
        byteSize: asset.byteSize,
      },
    });

    return res.status(201).json({
      assetId: asset.id,
      companyId: asset.companyId,
      provider: asset.provider,
      objectKey: asset.objectKey,
      contentType: asset.contentType,
      byteSize: asset.byteSize,
      sha256: asset.sha256,
      originalFilename: asset.originalFilename,
      createdByAgentId: asset.createdByAgentId,
      createdByUserId: asset.createdByUserId,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      contentPath: `/api/assets/${asset.id}/content`,
    });
  }

  @Post("companies/:companyId/logo")
  async uploadCompanyLogo(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);

    try {
      await this.runSingleFileUpload(this.companyLogoUpload, req, res);
    } catch (err: unknown) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(422).json({ error: `Image exceeds ${MAX_ATTACHMENT_BYTES} bytes` });
        }
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    const file = (req as Request & { file?: { mimetype: string; buffer: Buffer; originalname: string } }).file;
    if (!file) {
      return res.status(400).json({ error: "Missing file field 'file'" });
    }

    const contentType = (file.mimetype || "").toLowerCase();
    if (!ALLOWED_COMPANY_LOGO_CONTENT_TYPES.has(contentType)) {
      return res.status(422).json({ error: `Unsupported image type: ${contentType || "unknown"}` });
    }
    let fileBody = file.buffer;
    if (contentType === SVG_CONTENT_TYPE) {
      const sanitized = sanitizeSvgBuffer(file.buffer);
      if (!sanitized || sanitized.length <= 0) {
        return res.status(422).json({ error: "SVG could not be sanitized" });
      }
      fileBody = sanitized;
    }
    if (fileBody.length <= 0) {
      return res.status(422).json({ error: "Image is empty" });
    }

    const actor = getActorInfo(req);
    const stored = await this.storage.putFile({
      companyId,
      namespace: "assets/companies",
      originalFilename: file.originalname || null,
      contentType,
      body: fileBody,
    });

    const asset = await this.svc.create(companyId, {
      provider: stored.provider,
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      originalFilename: stored.originalFilename,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "asset.created",
      entityType: "asset",
      entityId: asset.id,
      details: {
        originalFilename: asset.originalFilename,
        contentType: asset.contentType,
        byteSize: asset.byteSize,
        namespace: "assets/companies",
      },
    });

    return res.status(201).json({
      assetId: asset.id,
      companyId: asset.companyId,
      provider: asset.provider,
      objectKey: asset.objectKey,
      contentType: asset.contentType,
      byteSize: asset.byteSize,
      sha256: asset.sha256,
      originalFilename: asset.originalFilename,
      createdByAgentId: asset.createdByAgentId,
      createdByUserId: asset.createdByUserId,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      contentPath: `/api/assets/${asset.id}/content`,
    });
  }

  @Get("assets/:assetId/content")
  async getAssetContent(
    @Req() req: Request & { actor?: Actor },
    @Param("assetId") assetId: string,
    @Res() res: Response,
  ) {
    const asset = await this.svc.getById(assetId);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }
    assertCompanyAccess(req, asset.companyId);

    const object = await this.storage.getObject(asset.companyId, asset.objectKey);
    const responseContentType = asset.contentType || object.contentType || "application/octet-stream";
    res.setHeader("Content-Type", responseContentType);
    res.setHeader("Content-Length", String(asset.byteSize || object.contentLength || 0));
    res.setHeader("Cache-Control", "private, max-age=60");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (responseContentType === SVG_CONTENT_TYPE) {
      res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
    }

    const filename = asset.originalFilename ?? "asset";
    res.setHeader("Content-Disposition", `inline; filename="${filename.replaceAll('"', "")}"`);

    object.stream.on("error", () => {
      if (!res.headersSent) res.status(500).end();
    });
    object.stream.pipe(res);
  }
}
