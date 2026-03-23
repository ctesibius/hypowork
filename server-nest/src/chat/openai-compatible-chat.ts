export type ChatCompletionMessage = { role: "system" | "user" | "assistant"; content: string };

function toAnthropicMessages(messages: ChatCompletionMessage[]): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const systemParts: string[] = [];
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return { system: systemParts.join("\n\n").trim(), messages: out };
}

async function anthropicCompatibleChatCompletion(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatCompletionMessage[];
  signal?: AbortSignal;
}): Promise<string> {
  const url = `${params.baseUrl.replace(/\/$/, "")}/v1/messages`;
  const payload = toAnthropicMessages(params.messages);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 1024,
      ...(payload.system ? { system: payload.system } : {}),
      messages: payload.messages,
    }),
    signal: params.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string | null }>;
  };
  const content = data.content?.find((b) => b.type === "text")?.text ?? "";
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("LLM returned empty content");
  }
  return content;
}

/**
 * OpenAI-compatible `POST /v1/chat/completions` (works with OpenAI, many gateways, Ollama with compat layer).
 */
export async function openaiCompatibleChatCompletion(params: {
  provider?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatCompletionMessage[];
  signal?: AbortSignal;
}): Promise<string> {
  if ((params.provider ?? "").toLowerCase() === "anthropic") {
    return anthropicCompatibleChatCompletion(params);
  }
  const url = `${params.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: 0.7,
    }),
    signal: params.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("LLM returned empty content");
  }
  return content;
}
