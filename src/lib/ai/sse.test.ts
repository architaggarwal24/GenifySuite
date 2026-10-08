import { describe, expect, it } from "vitest";
import { readSse, type SseMessage } from "./sse";

/** Builds a Response whose body arrives in chunks of `size` bytes, cutting wherever it lands. */
function chunked(text: string, size: number): Response {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.subarray(i, i + size));
      controller.close();
    },
  });
  return new Response(stream);
}

async function parse(text: string, size = 1000): Promise<SseMessage[]> {
  const out: SseMessage[] = [];
  await readSse(chunked(text, size), (m) => out.push(m));
  return out;
}

describe("SSE parser", () => {
  const stream = 'event: a\ndata: {"x":1}\n\nevent: b\ndata: héllo wörld ☕ 日本語\n\ndata: [DONE]\n\n';
  const expected: SseMessage[] = [
    { event: "a", data: '{"x":1}' },
    { event: "b", data: "héllo wörld ☕ 日本語" },
    { event: null, data: "[DONE]" },
  ];

  it("parses events, event names, and multi-byte text", async () => {
    expect(await parse(stream)).toEqual(expected);
  });

  it.each([1, 2, 3, 4, 5, 7, 11, 13, 29])("gives identical results when the network cuts it into %i-byte chunks", async (size) => {
    expect(await parse(stream, size)).toEqual(expected);
  });

  it("handles CRLF line endings", async () => {
    expect(await parse("event: a\r\ndata: one\r\n\r\ndata: two\r\n\r\n", 3)).toEqual([
      { event: "a", data: "one" },
      { event: null, data: "two" },
    ]);
  });

  it("joins multiple data lines with a newline", async () => {
    expect(await parse("data: line1\ndata: line2\ndata: line3\n\n")).toEqual([{ event: null, data: "line1\nline2\nline3" }]);
  });

  it("ignores comments and keep-alives", async () => {
    expect(await parse(": keep-alive\n\n: ping\ndata: real\n\n")).toEqual([{ event: null, data: "real" }]);
  });

  it("accepts 'data:' with no space and strips exactly one leading space", async () => {
    expect(await parse("data:nospace\n\ndata:  two spaces\n\n")).toEqual([
      { event: null, data: "nospace" },
      { event: null, data: " two spaces" },
    ]);
  });

  it("skips events that carry no data", async () => {
    expect(await parse("event: only-a-name\n\ndata: x\n\n")).toEqual([{ event: null, data: "x" }]);
  });

  it("flushes a final event that has no terminating blank line", async () => {
    expect(await parse("data: first\n\ndata: last")).toEqual([
      { event: null, data: "first" },
      { event: null, data: "last" },
    ]);
  });

  it("returns nothing for an empty stream", async () => {
    expect(await parse("")).toEqual([]);
  });

  it("rejects a response with no body", async () => {
    await expect(readSse(new Response(null), () => {})).rejects.toThrow(/empty response stream/);
  });
});
