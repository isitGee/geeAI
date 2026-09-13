import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChatRequest } from '../api/_lib/validate.js';
import { ApiError } from '../api/_lib/errors.js';

const options = {
  limits: { maxMessages: 60, maxMessageChars: 100, maxTotalChars: 1000, maxIdLength: 64 },
  allowedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  defaultModel: 'gemini-2.5-flash',
};

const valid = { messages: [{ role: 'user', content: 'Hello' }] };

test('accepts a valid request and fills in defaults', () => {
  const result = validateChatRequest(valid, options);
  assert.equal(result.model, 'gemini-2.5-flash');
  assert.equal(result.conversationId, null);
  assert.deepEqual(result.messages, [{ role: 'user', content: 'Hello' }]);
});

test('accepts a known model and rejects an unknown one', () => {
  const result = validateChatRequest({ ...valid, model: 'gemini-2.5-pro' }, options);
  assert.equal(result.model, 'gemini-2.5-pro');

  assert.throws(
    () => validateChatRequest({ ...valid, model: 'evil-model' }, options),
    (error) => error instanceof ApiError && error.code === 'unknown_model',
  );
});

test('accepts a well-formed conversationId and rejects a malformed one', () => {
  assert.equal(validateChatRequest({ ...valid, conversationId: 'c_ab12' }, options).conversationId, 'c_ab12');
  assert.throws(
    () => validateChatRequest({ ...valid, conversationId: '../../etc/passwd' }, options),
    (error) => error instanceof ApiError && error.code === 'invalid_request',
  );
});

test('rejects non-object bodies and bad message shapes', () => {
  for (const body of [null, 'nope', [], 42]) {
    assert.throws(() => validateChatRequest(body, options), (error) => error instanceof ApiError);
  }

  for (const messages of [undefined, 'text', [{ role: 'root', content: 'x' }], [{ role: 'user' }], [{ role: 'user', content: '   ' }], []]) {
    assert.throws(() => validateChatRequest({ messages }, options), (error) => error instanceof ApiError);
  }
});

test('requires the last message to come from the user', () => {
  assert.throws(
    () => validateChatRequest({ messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }] }, options),
    (error) => error instanceof ApiError && error.code === 'invalid_request',
  );
});

test('rejects oversized messages and conversations', () => {
  assert.throws(
    () => validateChatRequest({ messages: [{ role: 'user', content: 'x'.repeat(101) }] }, options),
    (error) => error instanceof ApiError && error.status === 413,
  );

  assert.throws(
    () =>
      validateChatRequest(
        { messages: Array.from({ length: 20 }, () => ({ role: 'user', content: 'x'.repeat(90) })) },
        options,
      ),
    (error) => error instanceof ApiError && error.code === 'conversation_too_long',
  );
});

test('keeps only the newest window of a long conversation', () => {
  const messages = Array.from({ length: 80 }, (_unused, index) => ({ role: 'user', content: `m${index}` }));
  const result = validateChatRequest({ messages }, options);
  assert.equal(result.messages.length, 60);
  assert.equal(result.messages[0].content, 'm20');
});

test('strips null bytes and trims content', () => {
  const content = `  hi${String.fromCharCode(0)}there  `;
  const result = validateChatRequest({ messages: [{ role: 'user', content }] }, options);
  assert.equal(result.messages[0].content, 'hithere');
});
