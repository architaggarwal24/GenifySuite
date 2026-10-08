import { describe, expect, it } from "vitest";
import { lineColumnAt, processJson } from "./json-tool";

describe("json tool", () => {
  it("formats with the chosen indent", () => {
    expect(processJson('{"a":1,"b":[1,2]}', 2).formatted).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
    expect(processJson('{"a":1}', 4).formatted).toBe('{\n    "a": 1\n}');
  });

  it("indents with real tabs when asked for 'tab'", () => {
    const result = processJson('{"a":{"b":1}}', "tab");
    expect(result.formatted).toBe('{\n\t"a": {\n\t\t"b": 1\n\t}\n}');
  });

  it("minifies", () => {
    expect(processJson('{\n  "a": 1,\n  "b": [ 1, 2 ]\n}', 2).minified).toBe('{"a":1,"b":[1,2]}');
  });

  it("reports empty input", () => {
    expect(processJson("   ", 2)).toMatchObject({ valid: false });
  });

  it("reports invalid JSON with a message", () => {
    const result = processJson('{"a": 1,}', 2);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("accepts any JSON value, not just objects", () => {
    for (const ok of ["[]", "123", '"text"', "null", "true"]) expect(processJson(ok, 2).valid).toBe(true);
  });

  it("converts offsets to 1-based line and column", () => {
    const text = '{\n  "a": 1,\n}';
    expect(lineColumnAt(text, 0)).toEqual({ line: 1, column: 1 });
    expect(lineColumnAt(text, 2)).toEqual({ line: 2, column: 1 });
    expect(lineColumnAt(text, 12)).toEqual({ line: 3, column: 1 }); // the closing brace
    expect(lineColumnAt("abc", 2)).toEqual({ line: 1, column: 3 });
  });
});
