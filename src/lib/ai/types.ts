export type AiProviderId = "anthropic" | "openai" | "ollama" | "nim" | "custom";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Set on assistant messages that requested tool calls. */
  toolCalls?: ToolCall[];
  /** Set on role "tool" messages: which call this is the result of. */
  toolCallId?: string;
  /** Set on role "tool" messages: which tool produced it (adapters that need the name, e.g. OpenAI-style). */
  toolName?: string;
}

// Minimal JSON Schema subset, enough to describe our tool parameters.
export interface JsonSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  model: string;
  maxTokens?: number;
  system?: string;
}

export type StopReason = "end" | "tool_call" | "length" | "error";

export interface ChatResult {
  content: string;
  toolCalls?: ToolCall[];
  stopReason: StopReason;
}

export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string;
}

export interface ChatOptions {
  /**
   * When provided, the adapter streams: it calls this with each text fragment as it arrives
   * and still resolves with the fully assembled ChatResult (including any tool calls) at the end.
   */
  onText?: (delta: string) => void;
  /** Aborts the in-flight provider request (e.g. the user hit Stop or closed the tab). */
  signal?: AbortSignal;
}

export interface AIProviderAdapter {
  chat(request: ChatRequest, credentials: ProviderCredentials, options?: ChatOptions): Promise<ChatResult>;
}

export class AiProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "AiProviderError";
  }
}
