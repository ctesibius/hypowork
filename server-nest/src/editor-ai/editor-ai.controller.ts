import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  StreamableFile,
} from "@nestjs/common";
import { Readable } from "node:stream";
import { EditorAiService } from "./editor-ai.service.js";
import type { CopilotCompleteDto, CopilotCompleteResponse } from "./editor-ai.types.js";

@Controller("companies/:companyId/ai")
export class EditorAiController {
  constructor(@Inject(EditorAiService) private readonly editorAiService: EditorAiService) {}

  @Post("copilot")
  @HttpCode(HttpStatus.OK)
  async completeCopilot(
    @Param("companyId") companyId: string,
    @Body() body: CopilotCompleteDto,
  ): Promise<CopilotCompleteResponse> {
    // #region agent log
    fetch("http://127.0.0.1:7267/ingest/5414ad03-148a-4367-b6cb-a798cd64057b", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "57354f" },
      body: JSON.stringify({
        sessionId: "57354f",
        runId: "initial",
        hypothesisId: "H4",
        location: "server-nest/src/editor-ai/editor-ai.controller.ts:completeCopilot",
        message: "Editor AI copilot endpoint invoked",
        data: {
          companyId,
          hasDocumentId: Boolean(body?.documentId),
          promptLength: body?.prompt?.length ?? 0,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const text = await this.editorAiService.completeCopilot(companyId, body);
    return { text };
  }

  /** Plate AI menu (`useChat` / DefaultChatTransport) — streams AI SDK UI chunks. */
  @Post("plate-command")
  plateCommand(
    @Param("companyId") companyId: string,
    @Body() body: Record<string, unknown>,
  ): StreamableFile {
    // #region agent log
    fetch("http://127.0.0.1:7267/ingest/5414ad03-148a-4367-b6cb-a798cd64057b", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "57354f" },
      body: JSON.stringify({
        sessionId: "57354f",
        runId: "post-fix",
        hypothesisId: "H4",
        location: "server-nest/src/editor-ai/editor-ai.controller.ts:plateCommand",
        message: "Editor AI plate-command invoked",
        data: {
          companyId,
          hasDocumentId: typeof body?.documentId === "string",
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const webStream = this.editorAiService.streamPlateCommand(companyId, body);
    const nodeReadable = Readable.from(
      (async function* () {
        const reader = webStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            if (value) {
              yield Buffer.from(value);
            }
          }
        } finally {
          reader.releaseLock();
        }
      })(),
    );
    return new StreamableFile(nodeReadable, {
      type: "text/plain; charset=utf-8",
    });
  }
}
