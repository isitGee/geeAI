import { ApiError } from '../errors.js';
import { readSseData } from '../sse.js';

/**
 * Google Gemini provider.
 *
 * Streams text from `streamGenerateContent?alt=sse`. The API key never leaves
 * this module: it is read from the server environment and only ever placed in
 * the upstream request URL.
 */

const MAX_OUTPUT_TOKENS = 8_192;

function toGeminiContents(messages) {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
}

function mapProviderError(status, rawBody) {
  const detail = String(rawBody || '').slice(0, 500);
  console.error('[geeai] gemini request failed', status, detail);

  if (status === 400) {
    // A 400 with an API_KEY_* reason still means "the key is the problem".
    if (/API_KEY_INVALID|API key not valid/i.test(detail)) {
      return new ApiError('provider_unauthorized', { status: 502, detail });
    }
    return new ApiError('provider_error', { status: 502, detail });
  }
  if (status === 401 || status === 403) return new ApiError('provider_unauthorized', { status: 502, detail });
  if (status === 404) return new ApiError('unknown_model', { status: 502, detail });
  if (status === 429) return new ApiError('provider_rate_limited', { status: 429, detail });
  if (status >= 500) return new ApiError('provider_unavailable', { status: 502, detail });
  return new ApiError('provider_error', { status: 502, detail });
}

async function readErrorBody(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export const geminiProvider = {
  name: 'gemini',
  label: 'Google Gemini',

  defaultModel: (config) => config.gemini.defaultModel,
  models: (config) => config.gemini.models,
  isConfigured: (config) => Boolean(config.gemini.apiKey),

  /**
   * @param {{config: object, model: string, messages: object[], systemPrompt: string, signal: AbortSignal}} options
   * @returns {AsyncGenerator<string>} text deltas
   */
  async *stream({ config, model, messages, systemPrompt, signal }) {
    const { apiKey, baseUrl } = config.gemini;
    if (!apiKey) {
      throw new ApiError('provider_not_configured', { status: 503 });
    }

    const url = `${baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: toGeminiContents(messages),
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      console.error('[geeai] gemini unreachable:', error?.message);
      throw new ApiError('provider_unavailable', { status: 502, detail: error?.message });
    }

    if (!response.ok || !response.body) {
      throw mapProviderError(response.status, await readErrorBody(response));
    }

    for await (const data of readSseData(response.body)) {
      let chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue; // ignore keep-alives and malformed frames
      }

      if (chunk.error) {
        throw mapProviderError(response.status, JSON.stringify(chunk.error));
      }

      let blocked = false;
      for (const candidate of chunk.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (typeof part.text === 'string' && part.text.length > 0) yield part.text;
        }
        if (['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(candidate.finishReason)) {
          blocked = true;
        }
      }

      if (blocked) {
        throw new ApiError('response_blocked', {
          status: 200,
          detail: chunk.promptFeedback?.blockReason || 'content filtered',
        });
      }
    }
  },
};
