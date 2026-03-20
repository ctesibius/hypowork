import { Controller, Get, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "./actor.guard.js";

/** Mirrors Express `app.get("/api/auth/get-session", ...)`. */
@Controller("auth")
export class NestAuthCompatController {
  @Get("get-session")
  getSession(@Req() req: Request & { actor?: Actor }, @Res() res: Response) {
    if (req.actor?.type !== "board" || !req.actor.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.json({
      session: {
        id: `paperclip:${req.actor.source}:${req.actor.userId}`,
        userId: req.actor.userId,
      },
      user: {
        id: req.actor.userId,
        email: null,
        name: req.actor.source === "local_implicit" ? "Local Board" : null,
      },
    });
  }
}
