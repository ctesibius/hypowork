import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type { SendMessageDto } from "./chat.types.js";
import { ChatService } from "./chat.service.js";
import type {
  ChatThread,
  ChatMessage,
  ChatResponse,
  CreateThreadDto,
} from "./chat.types.js";

/**
 * Chat API Controller - Phase 1.6
 *
 * Endpoints:
 * - Thread CRUD
 * - Message sending with RAG + citations
 * - Ask employee (agent) queries
 */
@Controller("companies/:companyId/chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * List threads
   * GET /companies/:companyId/chat/threads
   */
  @Get("threads")
  async listThreads(
    @Param("companyId") companyId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<ChatThread[]> {
    return this.chatService.listThreads(
      companyId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Create a thread
   * POST /companies/:companyId/chat/threads
   */
  @Post("threads")
  @HttpCode(HttpStatus.CREATED)
  async createThread(
    @Param("companyId") companyId: string,
    @Body() body: CreateThreadDto & { userId?: string },
  ): Promise<ChatThread> {
    const { userId, ...dto } = body;
    return this.chatService.createThread(companyId, dto, userId);
  }

  /**
   * Get a thread
   * GET /companies/:companyId/chat/threads/:threadId
   */
  @Get("threads/:threadId")
  async getThread(
    @Param("companyId") companyId: string,
    @Param("threadId") threadId: string,
  ): Promise<(ChatThread & { messages: ChatMessage[] }) | null> {
    const thread = await this.chatService.getThread(companyId, threadId);
    if (!thread) return null;
    const messages = await this.chatService.getMessages(threadId);
    return { ...thread, messages };
  }

  /**
   * Delete a thread
   * DELETE /companies/:companyId/chat/threads/:threadId
   */
  @Delete("threads/:threadId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteThread(
    @Param("companyId") companyId: string,
    @Param("threadId") threadId: string,
  ): Promise<void> {
    await this.chatService.deleteThread(companyId, threadId);
  }

  /**
   * Get messages in a thread
   * GET /companies/:companyId/chat/threads/:threadId/messages
   */
  @Get("threads/:threadId/messages")
  async getMessages(
    @Param("companyId") companyId: string,
    @Param("threadId") threadId: string,
  ): Promise<ChatMessage[]> {
    // Verify thread belongs to company
    const thread = await this.chatService.getThread(companyId, threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }
    return this.chatService.getMessages(threadId);
  }

  /**
   * Send a message
   * POST /companies/:companyId/chat/threads/:threadId/messages
   */
  @Post("threads/:threadId/messages")
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param("companyId") companyId: string,
    @Param("threadId") threadId: string,
    @Body() body: SendMessageDto,
  ): Promise<ChatResponse> {
    return this.chatService.sendMessage(companyId, threadId, body);
  }

  /**
   * Send a message with canvas node context (link-scoped RAG).
   * POST /companies/:companyId/chat/threads/:threadId/messages/with-context
   */
  @Post("threads/:threadId/messages/with-context")
  @HttpCode(HttpStatus.CREATED)
  async sendMessageWithContext(
    @Param("companyId") companyId: string,
    @Param("threadId") threadId: string,
    @Body() body: import("./chat.types.js").SendMessageWithContextDto,
  ): Promise<ChatResponse> {
    return this.chatService.sendMessageWithNodeContext(companyId, threadId, body);
  }

  /**
   * Ask an agent about their known info
   * POST /companies/:companyId/chat/ask-agent
   */
  @Post("ask-agent")
  @HttpCode(HttpStatus.CREATED)
  async askAgent(
    @Param("companyId") companyId: string,
    @Body() body: { agentId: string; question: string },
  ): Promise<ChatResponse> {
    return this.chatService.askAgent(
      companyId,
      body.agentId,
      body.question,
    );
  }
}
