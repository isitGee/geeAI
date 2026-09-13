import { ApiError } from './errors.js';

/**
 * Request validation.
 *
 * The client is untrusted: every field is checked for type, size and shape
 * before it reaches the provider. Model ids are checked against the allowlist
 * configured on the server, never taken from the client as-is.
 */

const ROLES = new Set(['user', 'assistant']);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function fail(code, detail) {
  throw new ApiError(code, { status: 400, detail });
}

/**
 * @param {unknown} body parsed JSON request body
 * @param {{ limits: object, allowedModels: string[], defaultModel: string }} options
 * @returns {{ conversationId: string|null, model: string, messages: {role:string, content:string}[] }}
 */
export function validateChatRequest(body, { limits, allowedModels, defaultModel }) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('invalid_request', { status: 400, detail: 'body is not an object' });
  }

  let conversationId = null;
  if (body.conversationId !== undefined && body.conversationId !== null && body.conversationId !== '') {
    if (typeof body.conversationId !== 'string' || !ID_PATTERN.test(body.conversationId)) {
      fail('invalid_request', 'conversationId failed pattern check');
    }
    conversationId = body.conversationId.slice(0, limits.maxIdLength);
  }

  let model = defaultModel;
  if (body.model !== undefined && body.model !== null && body.model !== '') {
    if (typeof body.model !== 'string' || !allowedModels.includes(body.model)) {
      fail('unknown_model', `model "${String(body.model).slice(0, 64)}" is not allowlisted`);
    }
    model = body.model;
  }

  if (!Array.isArray(body.messages)) {
    fail('invalid_request', 'messages is not an array');
  }

  // Only the newest window of a long conversation is forwarded, so an old
  // thread degrades gracefully instead of blowing up the provider request.
  const rawMessages = body.messages.slice(-limits.maxMessages);
  if (rawMessages.length === 0) {
    fail('invalid_request', 'messages is empty');
  }

  let totalChars = 0;
  const messages = rawMessages.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      fail('invalid_request', `messages[${index}] is not an object`);
    }
    if (typeof entry.role !== 'string' || !ROLES.has(entry.role)) {
      fail('invalid_request', `messages[${index}].role is not user|assistant`);
    }
    if (typeof entry.content !== 'string') {
      fail('invalid_request', `messages[${index}].content is not a string`);
    }

    const content = entry.content.replace(/\u0000/g, '').trim();
    if (!content) {
      fail('invalid_request', `messages[${index}].content is empty`);
    }
    if (content.length > limits.maxMessageChars) {
      throw new ApiError('payload_too_large', {
        status: 413,
        detail: `messages[${index}] is ${content.length} chars`,
      });
    }

    totalChars += content.length;
    if (totalChars > limits.maxTotalChars) {
      throw new ApiError('conversation_too_long', {
        status: 413,
        detail: `conversation is ${totalChars} chars`,
      });
    }

    return { role: entry.role, content };
  });

  const last = messages[messages.length - 1];
  if (last.role !== 'user') {
    fail('invalid_request', 'last message must be from the user');
  }

  return { conversationId, model, messages };
}
