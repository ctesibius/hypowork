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
    return this.editorAiService.completeCopilot(companyId, body);
  }

  /** Plate AI menu (`useChat` / DefaultChatTransport) — streams AI SDK UI chunks. */
  @Post("plate-command")
  plateCommand(
    @Param("companyId") companyId: string,
    @Body() body: Record<string, unknown>,
  ): StreamableFile {
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
