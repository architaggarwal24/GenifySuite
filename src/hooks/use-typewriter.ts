import { useEffect, useRef, useState } from "react";

/**
 * Reveals `fullText` progressively rather than all at once. This is a
 * client-side animation over an already-complete response, not real
 * network token streaming (the agent's tool-calling loop makes true
 * streaming impractical to do safely across multiple provider formats -
 * see the agent route for details). Reveals in small word-ish chunks
 * rather than character-by-character, which reads more naturally and is
 * far cheaper on re-renders for long replies.
 *
 * Returns [visibleText, isDone].
 */
export function useTypewriter(fullText: string, active: boolean): [string, boolean] {
  const [visibleLength, setVisibleLength] = useState(active ? 0 : fullText.length);
  const frame = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setVisibleLength(fullText.length);
      return;
    }

    setVisibleLength(0);
    let i = 0;
    // Chunk size scales with length so a long reply doesn't take forever
    // to finish revealing, but short ones still feel deliberate.
    const chunkSize = Math.max(1, Math.round(fullText.length / 120));

    function tick() {
      i = Math.min(fullText.length, i + chunkSize);
      setVisibleLength(i);
      if (i < fullText.length) {
        frame.current = setTimeout(tick, 12);
      }
    }
    frame.current = setTimeout(tick, 12);

    return () => {
      if (frame.current) clearTimeout(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, active]);

  const visibleText = fullText.slice(0, visibleLength);
  return [visibleText, visibleLength >= fullText.length];
}
