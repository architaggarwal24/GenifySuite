import { AiProviderError } from "@/lib/ai/types";

export interface SseMessage {
  event: string | null;
  data: string;
}

function parseBlock(block: string): SseMessage | null {
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue; // blank line or comment/keep-alive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }

  return dataLines.length ? { event, data: dataLines.join("\n") } : null;
}

/**
 * Reads a Server-Sent Events response and calls `onMessage` once per complete event.
 * Network chunks can split an event (or even a UTF-8 character) anywhere, so we buffer
 * until we see the blank line that terminates an event.
 */
export async function readSse(response: Response, onMessage: (message: SseMessage) => void): Promise<void> {
  if (!response.body) throw new AiProviderError("The provider returned an empty response stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const drain = () => {
    for (;;) {
      const boundary = /\r?\n\r?\n/.exec(buffer);
      if (!boundary) return;
      const block = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      const message = parseBlock(block);
      if (message) onMessage(message);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    drain();
  }

  buffer += decoder.decode();
  drain();
  if (buffer.trim()) {
    const message = parseBlock(buffer);
    if (message) onMessage(message);
  }
}
