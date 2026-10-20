/**
 * Input budget for the AI agent endpoint. Every request resends the whole conversation to the model
 * (several times, once per tool round), so unbounded input is unbounded cost - especially on the
 * operator's shared key.
 */
export const AGENT_LIMITS = {
  maxMessages: 40,
  maxMessageChars: 8_000,
  maxTotalChars: 48_000,
} as const;

interface MessageLike {
  content: string;
  toolCalls?: unknown;
}

export function agentInputChars(messages: MessageLike[]): number {
  return messages.reduce((sum, m) => sum + m.content.length + (m.toolCalls === undefined ? 0 : JSON.stringify(m.toolCalls).length), 0);
}

/** Returns a user-facing error string, or null when the conversation is within budget. */
export function checkAgentInput(messages: MessageLike[]): string | null {
  if (messages.length > AGENT_LIMITS.maxMessages) {
    return `Too many messages in one conversation (max ${AGENT_LIMITS.maxMessages}). Start a new chat.`;
  }
  if (messages.some((m) => m.content.length > AGENT_LIMITS.maxMessageChars)) {
    return `A message is too long (max ${AGENT_LIMITS.maxMessageChars.toLocaleString("en-US")} characters).`;
  }
  if (agentInputChars(messages) > AGENT_LIMITS.maxTotalChars) {
    return "This conversation is too long. Start a new chat.";
  }
  return null;
}
