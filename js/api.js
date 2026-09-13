/**
 * Client for /api/chat.
 *
 * The browser never talks to an AI provider directly and never sees an API
 * key: it posts a conversation to our own endpoint and reads back a stream of
 * Server-Sent Events.
 */

const FALLBACK_MESSAGES = {
  network: "Couldn't reach GeeAI. Check your connection and try again.",
  server: 'Something went wrong. Please try again.',
  aborted: 'Generation stopped.',
  empty: 'GeeAI returned an empty response. Try rephrasing your message.',
};

export class ChatError extends Error {
  constructor(code, message, { partial = '' } = {}) {
    super(message || FALLBACK_MESSAGES[code] || FALLBACK_MESSAGES.server);
    this.name = 'ChatError';
    this.code = code;
    this.partial = partial;
  }
}

/** Public, non-secret information about this deployment. */
export async function fetchInfo() {
  let response;
  try {
    response = await fetch('/api/info', { headers: { Accept: 'application/json' } });
  } catch {
    throw new ChatError('network');
  }
  if (!response.ok) throw new ChatError('server');

  const data = await response.json().catch(() => null);
  if (!data?.provider) throw new ChatError('server');
  return data;
}

/**
 * Streams a reply from /api/chat.
 *
 * @param {object} options
 * @param {string} [options.conversationId]
 * @param {{role: string, content: string}[]} options.messages
 * @param {string} [options.model]
 * @param {AbortSignal} [options.signal]
 * @param {(chunk: string, full: string) => void} [options.onDelta]
 * @returns {Promise<{text: string, model: string|null}>}
 */
export async function streamChat({ conversationId, messages, model, signal, onDelta }) {
  let response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ conversationId, messages, model }),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ChatError('network');
  }

  const contentType = response.headers.get('content-type') || '';

  // Errors raised before streaming starts arrive as JSON.
  if (!contentType.includes('text/event-stream')) {
    const payload = await response.json().catch(() => null);
    const code = payload?.error?.code || 'server';
    throw new ChatError(code, payload?.error?.message);
  }

  if (!response.body) throw new ChatError('server');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let modelUsed = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;

        let event;
        try {
          event = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue; // ignore keep-alives and malformed frames
        }

        if (event.type === 'meta') {
          modelUsed = event.model || null;
        } else if (event.type === 'delta') {
          text += event.text;
          onDelta?.(event.text, text);
        } else if (event.type === 'error') {
          throw new ChatError(event.code, event.message, { partial: text });
        } else if (event.type === 'done') {
          return { text, model: modelUsed };
        }

        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  // Provider closed the stream without a done frame.
  if (!text) throw new ChatError('empty');
  return { text, model: modelUsed };
}
