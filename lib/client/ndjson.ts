/**
 * NDJSON stream reader — splits a fetch ReadableStream into parsed JSON
 * lines. `\r\n`-safe; unparsable lines are skipped (a proxy or a dropped
 * connection can truncate a line — the caller's `done` handling recovers).
 */

export async function* iterateNdjson(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '').trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          yield JSON.parse(line) as unknown;
        } catch {
          /* skip malformed line */
        }
      }
    }
    const tail = buf.trim();
    if (tail) {
      try {
        yield JSON.parse(tail) as unknown;
      } catch {
        /* skip */
      }
    }
  } finally {
    reader.releaseLock();
  }
}
