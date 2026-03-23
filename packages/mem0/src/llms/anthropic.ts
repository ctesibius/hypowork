import Anthropic from "@anthropic-ai/sdk";
import { LLM, LLMResponse } from "./base.js";
import { LLMConfig, Message } from "../types.js";

export class AnthropicLLM implements LLM {
  private client: Anthropic;
  private model: string;

  constructor(config: LLMConfig) {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Anthropic API key is required");
    }
    this.client = new Anthropic({ apiKey });
    this.model = config.model || "claude-sonnet-4-20250514";
  }

  async generateResponse(
    messages: Message[],
    responseFormat?: { type: string },
  ): Promise<string> {
    const systemMessage = messages.find((msg) => msg.role === "system");
    const otherMessages = messages.filter((msg) => msg.role !== "system");

    const response = await this.client.messages.create({
      model: this.model,
      messages: otherMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content:
          typeof msg.content === "string"
            ? msg.content
            : msg.content.image_url.url,
      })),
      system:
        typeof systemMessage?.content === "string"
          ? systemMessage.content
          : undefined,
      max_tokens: 4096,
    });

    const firstBlock = response.content[0];
    if (firstBlock.type === "text") {
      return firstBlock.text;
    } else {
      throw new Error("Unexpected response type from Anthropic API");
    }
  }

  async generateChat(messages: Message[]): Promise<LLMResponse> {
    const response = await this.generateResponse(messages);
    return {
      content: response,
      role: "assistant",
    };
  }
}
