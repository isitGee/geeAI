/**
 * Server → browser streaming.
 *
 * The browser talks to exactly one endpoint (`POST /api/chat`) and receives a
 * small Server-Sent Events stream. Every frame is a single JSON object:
 *
 *   { "type": "meta",  "provider": "gemini", "model": "gemini-2.5-flash" }
 *   { "type": "delta", "text": "..." }
 *   { "type": "error", "code": "…", "message": "…" }
 *   { "type": "done",  "finishReason": "stop" | "length" | "aborted" }
 */

export function openStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
    Connection: 'keep-alive',
    // Tells proxies (and Vercel's edge) not to buffer the stream.
    'X-Accel-Buffering': 'no',
    'Content-Encoding': 'none',
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

export function sendEvent(res, event) {
  if (res.writableEnded || res.destroyed) return false;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  return true;
}

export function closeStream(res) {
  if (res.writableEnded || res.destroyed) return;
  res.end();
}

/**
 * Normalises a fetch body into an async iterable of byte chunks.
 * Uses an explicit reader so the upstream socket is cancelled if we stop
 * reading (e.g. the browser hung up mid-stream).
 * @param {ReadableStream<Uint8Array>|AsyncIterable<Uint8Array>|null} stream
 * @returns {AsyncGenerator<Uint8Array|string>}
 */
async function* toChunks(stream) {
  if (!stream) return;

  if (typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    let finished = false;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          finished = true;
          break;
        }
        if (value) yield value;
      }
    } finally {
      if (!finished) await reader.cancel().catch(() => {});
      else reader.releaseLock?.();
    }
    return;
  }

  yield* stream;
}

/**
 * Splits an upstream SSE byte stream into complete `data:` payloads.
 * @param {ReadableStream<Uint8Array>|AsyncIterable<Uint8Array>} stream
 * @returns {AsyncGenerator<string>}
 */
export async function* readSseData(stream) {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of toChunks(stream)) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });

    // Gemini separates frames with a blank line; be tolerant of bare \r\n.
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const payload = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (payload && payload !== '[DONE]') yield payload;
      boundary = buffer.indexOf('\n\n');
    }
  }

  buffer += decoder.decode();
  const tail = buffer
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('');
  if (tail && tail !== '[DONE]') yield tail;
}
