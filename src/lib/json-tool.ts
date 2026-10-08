export interface JsonParseResult {
  valid: boolean;
  formatted?: string;
  minified?: string;
  error?: string;
  errorLine?: number;
  errorColumn?: number;
}

export function processJson(input: string, indent: number | "tab"): JsonParseResult {
  if (input.trim().length === 0) {
    return { valid: false, error: "Enter some JSON to format." };
  }

  try {
    const parsed = JSON.parse(input);
    return {
      valid: true,
      formatted: JSON.stringify(parsed, null, indent === "tab" ? "\t" : indent),
      minified: JSON.stringify(parsed),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON.";
    const position = extractPosition(message, input);
    return {
      valid: false,
      error: message,
      errorLine: position?.line,
      errorColumn: position?.column,
    };
  }
}

/** Converts a character offset into a 1-based line and column. */
export function lineColumnAt(input: string, index: number): { line: number; column: number } {
  const before = input.slice(0, index);
  return { line: before.split("\n").length, column: index - before.lastIndexOf("\n") };
}

function extractPosition(message: string, input: string): { line: number; column: number } | null {
  const match = /position (\d+)/.exec(message);
  return match ? lineColumnAt(input, parseInt(match[1], 10)) : null;
}
