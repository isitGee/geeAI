import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTitle, createConversation, createMessage } from '../js/store.js';

test('derives a readable title from the first message', () => {
  assert.equal(deriveTitle('Explain subnetting to me'), 'Subnetting');
  assert.equal(deriveTitle('Help me code'), 'Code');
  assert.equal(deriveTitle('Can you please explain DNS for me'), 'DNS');
  assert.equal(deriveTitle('Write a function that reverses a linked list'), 'A function that reverses a linked list');
});

test('falls back to the default title for empty input', () => {
  assert.equal(deriveTitle(''), 'New chat');
  assert.equal(deriveTitle('   \n  '), 'New chat');
  assert.equal(deriveTitle(undefined), 'New chat');
});

test('caps the title length', () => {
  const title = deriveTitle(`Explain ${'quantum '.repeat(20)}computing`);
  assert.ok(title.length <= 61, `title is ${title.length} chars`);
  assert.match(title, /…$/);
});

test('strips markdown noise from titles', () => {
  assert.equal(deriveTitle('**Explain** `CIDR` to me'), 'CIDR');
});

test('creates conversations and messages with the documented shape', () => {
  const conversation = createConversation();
  assert.equal(conversation.title, 'New chat');
  assert.deepEqual(conversation.messages, []);
  assert.ok(conversation.createdAt <= Date.now());

  const message = createMessage('user', 'hello');
  assert.equal(message.role, 'user');
  assert.equal(message.content, 'hello');
  assert.ok(message.id.startsWith('m_'));
  assert.ok(Number.isFinite(message.timestamp));
});
