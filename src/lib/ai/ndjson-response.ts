import { aiErrorInfo } from "@/lib/ai/errors";

/**
 * Wraps long-running work in a streamed newline-delimited-JSON response.
 *
 * Anything that can be rejected up front (auth, limits, validation) should be decided BEFORE
 * calling this, so it can still return a proper HTTP status. Once streaming starts the status
 * is already 200, so failures from here on are delivered as a final `{type:"error"}` event.
 */
export function ndjsonResponse(
  request: Request,
  worker: (emit: (event: object) => void, signal: AbortSignal) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const controller = new AbortController();

  // Stop paying the provider if the client goes away.
  request.signal.addEventListener("abort", () => controller.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const emit = (event: object) => {
        try {
          streamController.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // The client already disconnected; nothing left to deliver to.
        }
      };

      try {
        await worker(emit, controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) {
          emit({ type: "error", message: aiErrorInfo(err).message });
        }
      } finally {
        try {
          streamController.close();
        } catch {
          // already closed/cancelled
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", // ask nginx-style proxies not to buffer the stream
    },
  });
}
