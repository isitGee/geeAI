import { ApiError } from './_lib/errors.js';
import { loadConfig } from './_lib/config.js';
import { validateChatRequest } from './_lib/validate.js';
import { checkRateLimit, clientIp } from './_lib/ratelimit.js';
import { openStream, sendEvent, closeStream } from './_lib/sse.js';
import { getProvider, providerInfo } from './_lib/providers/index.js';
import { SYSTEM_PROMPT } from './_lib/prompt.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, status, payload) {
  if (res.headersSent || res.writableEnded) return;
  applySecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

/** Reads and parses the request body, refusing anything oversized. */
async function readJsonBody(req, maxBytes) {
  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError('payload_too_large', { status: 413, detail: `content-length=${declaredLength}` });
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    received += chunk.length;
    if (received > maxBytes) {
      req.destroy();
      throw new ApiError('payload_too_large', { status: 413, detail: `body > ${maxBytes} bytes` });
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) throw new ApiError('invalid_json', { status: 400, detail: 'empty body' });

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ApiError('invalid_json', { status: 400, detail: error.message });
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'Use POST for this endpoint.' } });
    return;
  }

  const appConfig = loadConfig();

  try {
    checkRateLimit(clientIp(req), appConfig.rateLimit);

    const provider = getProvider(appConfig);
    const info = providerInfo(appConfig);
    const body = await readJsonBody(req, appConfig.limits.maxBodyBytes);
    const { conversationId, model, messages } = validateChatRequest(body, {
      limits: appConfig.limits,
      allowedModels: info.models,
      defaultModel: info.defaultModel,
    });

    if (!info.configured) {
      throw new ApiError('provider_not_configured', { status: 503 });
    }

    openStream(res);
    sendEvent(res, { type: 'meta', provider: info.name, model, conversationId });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), appConfig.requestTimeoutMs);
    let clientGone = false;
    req.on('close', () => {
      if (!res.writableEnded) {
        clientGone = true;
        controller.abort(Object.assign(new Error('client aborted'), { name: 'AbortError' }));
      }
    });

    let sentText = false;
    try {
      for await (const delta of provider.stream({
        config: appConfig,
        model,
        messages,
        systemPrompt: SYSTEM_PROMPT,
        signal: controller.signal,
      })) {
        if (clientGone) break;
        if (typeof delta !== 'string' || delta === '') continue;
        sentText = true;
        if (!sendEvent(res, { type: 'delta', text: delta })) break;
      }

      if (!clientGone) {
        if (sentText) {
          sendEvent(res, { type: 'done', finishReason: 'stop' });
        } else {
          const empty = new ApiError('empty_response');
          sendEvent(res, { type: 'error', code: empty.code, message: empty.message });
        }
      }
    } catch (error) {
      if (!clientGone) {
        const safe = toStreamError(error);
        console.error('[geeai] stream failed:', error?.code || error?.name, error?.detail || error?.message);
        sendEvent(res, { type: 'error', code: safe.code, message: safe.message });
      }
    } finally {
      clearTimeout(timeout);
      closeStream(res);
    }
  } catch (error) {
    const safe = toStreamError(error);
    console.error('[geeai] request failed:', safe.code, error?.detail || error?.message);
    sendJson(res, safe.status, { error: { code: safe.code, message: safe.message } });
  }
}

function toStreamError(error) {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message, status: error.status };
  }
  if (error?.name === 'TimeoutError') {
    return new ApiError('provider_timeout', { status: 504, detail: error.message });
  }
  if (error?.name === 'AbortError') {
    return new ApiError('empty_response', { status: 499, detail: 'aborted' });
  }
  return new ApiError('internal_error', { status: 500, detail: error?.message });
}
