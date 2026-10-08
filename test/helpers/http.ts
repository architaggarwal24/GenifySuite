import http from "node:http";
import type { AddressInfo } from "node:net";

export interface CapturedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: any;
}

export interface TestServer {
  url: string;
  requests: CapturedRequest[];
  close(): Promise<void>;
}

/** Starts a throwaway local HTTP server on a random port; records every request it receives. */
export async function startServer(
  handler: (req: CapturedRequest, res: http.ServerResponse) => void | Promise<void>
): Promise<TestServer> {
  const requests: CapturedRequest[] = [];

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", async () => {
      let body: any = raw;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        // leave as the raw string
      }
      const captured: CapturedRequest = { method: req.method ?? "GET", url: req.url ?? "/", headers: req.headers, body };
      requests.push(captured);
      try {
        await handler(captured, res);
      } catch (err) {
        res.statusCode = 500;
        res.end(String(err));
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

/**
 * Sends `raw` as a Server-Sent Events response in tiny chunks split at arbitrary BYTE offsets, so an
 * event (or even a multi-byte character) regularly gets cut in half - what a real TCP stream does and
 * what a naive line-based parser gets wrong.
 */
export async function writeMangled(res: http.ServerResponse, raw: string, chunkSize = 7): Promise<void> {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const bytes = Buffer.from(raw, "utf8");
  for (let i = 0; i < bytes.length; i += chunkSize) {
    res.write(bytes.subarray(i, i + chunkSize));
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  res.end();
}

export const openAiSse = (events: object[]) =>
  events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";

export const anthropicSse = (events: [string, object][]) =>
  events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");

export function jsonResponse(res: http.ServerResponse, body: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/** A plain (non-streaming) OpenAI-compatible completion body. */
export const openAiCompletion = (content: string, extra: Record<string, unknown> = {}) => ({
  choices: [{ message: { content, ...extra }, finish_reason: extra.tool_calls ? "tool_calls" : "stop" }],
});
