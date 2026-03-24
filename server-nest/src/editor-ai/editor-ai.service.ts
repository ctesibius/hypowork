import { randomUUID } from "node:crypto";

import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import { instanceSettingsService } from "@paperclipai/server/services/instance-settings";
import { secretService } from "@paperclipai/server/services/secrets";
import { DB } from "../db/db.module.js";
import { MemoryService } from "../memory/memory.service.js";
import { VaultService } from "../vault/vault.service.js";
import { buildDocumentNeighborhoodRagLinks } from "../chat/document-neighborhood-rag.util.js";
import {
  openaiCompatibleChatCompletion,
  type ChatCompletionMessage,
} from "../chat/openai-compatible-chat.js";
import type { CopilotCompleteDto } from "./editor-ai.types.js";

@Injectable()
export class EditorAiService {
  private readonly logger = new Logger(EditorAiService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MemoryService) private readonly memoryService: MemoryService,
    @Inject(VaultService) private readonly vaultService: VaultService,
  ) {}

  async completeCopilot(companyId: string, dto: CopilotCompleteDto): Promise<string> {
    const prompt = dto.prompt?.trim();
    if (!prompt) {
      throw new BadRequestException("prompt is required");
    }
    return this.runEditorLlmCompletion(companyId, prompt, dto.documentId, dto.system, "copilot");
  }

  /**
   * Stream for Plate `useChat` / DefaultChatTransport (AI SDK UI message chunks, SSE-style lines).
   */
  streamPlateCommand(companyId: string, rawBody: Record<string, unknown>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const documentId = typeof rawBody.documentId === "string" ? rawBody.documentId : undefined;
    const prompt = this.extractLastUserTextFromUiMessages(rawBody.messages).trim();

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const pushSse = (obj: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        const pushDone = () => controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        try {
          if (!prompt) {
            pushSse({ type: "error", errorText: "No user message text found." });
            pushDone();
            controller.close();
            return;
          }

          const text = await this.runEditorLlmCompletion(
            companyId,
            prompt,
            documentId,
            undefined,
            "plate-menu",
          );
          const messageId = `msg_${randomUUID().replace(/-/g, "")}`;

          pushSse({ type: "start" });
          pushSse({ type: "start-step" });
          pushSse({
            type: "text-start",
            id: messageId,
            providerMetadata: { openai: { itemId: messageId } },
          });

          const chunkSize = 48;
          for (let i = 0; i < text.length; i += chunkSize) {
            pushSse({
              type: "text-delta",
              id: messageId,
              delta: text.slice(i, i + chunkSize),
            });
          }

          pushSse({ type: "text-end", id: messageId });
          pushSse({ type: "finish-step" });
          pushSse({ type: "finish" });
          pushDone();
          controller.close();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Editor AI failed.";
          this.logger.warn(`streamPlateCommand: ${msg}`);
          pushSse({ type: "error", errorText: msg });
          pushDone();
          controller.close();
        }
      },
    });
  }

  private extractLastUserTextFromUiMessages(messages: unknown): string {
    if (!Array.isArray(messages) || messages.length === 0) {
      return "";
    }
    const last = messages[messages.length - 1] as {
      parts?: Array<{ type?: string; text?: string }>;
      content?: unknown;
    };
    if (Array.isArray(last?.parts)) {
      return last.parts
        .filter((p) => p?.type === "text")
        .map((p) => (typeof p.text === "string" ? p.text : ""))
        .join("");
    }
    if (typeof last?.content === "string") {
      return last.content;
    }
    return "";
  }

  private async runEditorLlmCompletion(
    companyId: string,
    userPrompt: string,
    documentId: string | undefined,
    clientSystem: string | undefined,
    variant: "copilot" | "plate-menu",
  ): Promise<string> {
    const cfg = await instanceSettingsService(this.db, secretService(this.db)).getChatLlmRuntimeConfig(
      companyId,
    );
    if (!cfg.enabled || !cfg.apiKey || !cfg.model) {
      throw new BadRequestException(
        "Instance chat LLM is not configured. Configure Instance settings > Chat LLM first.",
      );
    }

    const ragContext = await this.buildRagContext(companyId, userPrompt, documentId);
    const systemPrompt = this.buildSystemPrompt(clientSystem, ragContext, variant);
    const messages: ChatCompletionMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const completion = await openaiCompatibleChatCompletion({
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      messages,
    });
    return completion.trim();
  }

  private async buildRagContext(companyId: string, prompt: string, documentId?: string) {
    const [memoryResults, vaultResults, documentLinks] = await Promise.all([
      this.memoryService.searchMemories({
        companyId,
        query: prompt,
        limit: 6,
      }),
      this.vaultService.searchWithMemory(companyId, prompt, undefined, 4),
      documentId
        ? buildDocumentNeighborhoodRagLinks(this.db, companyId, documentId, 20).catch((err: unknown) => {
            this.logger.warn(`Document neighborhood RAG failed: ${(err as Error).message}`);
            return [];
          })
        : Promise.resolve([]),
    ]);

    return {
      memories: memoryResults.results.map((r) => r.memory),
      vaultEntries: vaultResults.vaultEntries.map((e) => `[${e.title}] ${e.content}`),
      documentLinks: documentLinks.map((d) => `${d.title}: ${d.excerpt}`),
    };
  }

  private buildSystemPrompt(
    clientSystem: string | undefined,
    context: {
      memories: string[];
      vaultEntries: string[];
      documentLinks: string[];
    },
    variant: "copilot" | "plate-menu" = "copilot",
  ): string {
    const parts: string[] = [];
    if (clientSystem?.trim()) {
      parts.push(clientSystem.trim());
    } else if (variant === "plate-menu") {
      parts.push(
        [
          "You are an AI assistant inside a rich-text document editor.",
          "Follow the user's instruction (write, rewrite, edit, or explain).",
          "When producing document content, use clean Markdown unless they ask otherwise.",
          "Respond in English unless the user explicitly requests another language.",
        ].join(" "),
      );
    } else {
      parts.push(
        [
          "You are an advanced AI writing assistant.",
          "Continue the user's current block naturally.",
          "Respond in English unless the user explicitly requests another language.",
          "Keep suggestions concise and in the same block style as the prompt.",
        ].join(" "),
      );
    }

    const ctx: string[] = [];
    if (context.memories.length > 0) {
      ctx.push(`## Relevant Memories\n- ${context.memories.join("\n- ")}`);
    }
    if (context.vaultEntries.length > 0) {
      ctx.push(`## Relevant Vault Entries\n- ${context.vaultEntries.join("\n- ")}`);
    }
    if (context.documentLinks.length > 0) {
      ctx.push(`## Related Documents\n- ${context.documentLinks.join("\n- ")}`);
    }
    if (ctx.length > 0) {
      parts.push(`Context from company knowledge base:\n${ctx.join("\n\n")}`);
    }
    return parts.join("\n\n");
  }
}
