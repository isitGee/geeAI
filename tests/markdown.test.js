import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBlocks, parseInline, sanitizeUrl, languageLabel } from '../js/markdown.js';

const types = (blocks) => blocks.map((block) => block.type);

test('parses headings with the level clamped to h4', () => {
  const [h1, h5] = parseBlocks('# Title\n\n##### Deep');
  assert.equal(h1.type, 'heading');
  assert.equal(h1.level, 1);
  assert.equal(h5.level, 4);
});

test('parses fenced code blocks and keeps the language', () => {
  const [block] = parseBlocks('```js\nconst a = 1;\n```');
  assert.equal(block.type, 'code');
  assert.equal(block.language, 'js');
  assert.equal(block.code, 'const a = 1;');
});

test('an unterminated fence still yields a code block', () => {
  const [block] = parseBlocks('```python\nprint("hi")\n');
  assert.equal(block.type, 'code');
  assert.equal(block.language, 'python');
  assert.match(block.code, /print/);
});

test('parses nested lists', () => {
  const [list] = parseBlocks('- one\n  - nested\n- two');
  assert.equal(list.type, 'list');
  assert.equal(list.ordered, false);
  assert.equal(list.items.length, 2);
  assert.equal(list.items[0].children[0].type, 'list');
  assert.equal(list.items[0].children[0].items[0].text, 'nested');
});

test('parses ordered lists and blockquotes', () => {
  const [list] = parseBlocks('1. first\n2. second');
  assert.equal(list.ordered, true);

  const [quote] = parseBlocks('> quoted line\n> another');
  assert.equal(quote.type, 'quote');
  assert.equal(quote.blocks.length, 1);
});

test('parses tables', () => {
  const [table] = parseBlocks('| a | b |\n| --- | --- |\n| 1 | 2 |');
  assert.equal(table.type, 'table');
  assert.deepEqual(table.header, ['a', 'b']);
  assert.deepEqual(table.rows, [['1', '2']]);
});

test('parses inline emphasis, code and links', () => {
  const tokens = parseInline('Use **bold**, *italic*, `code`, ~~gone~~ and [docs](https://example.com).');
  const kinds = tokens.map((token) => token.type);
  assert.ok(kinds.includes('strong'));
  assert.ok(kinds.includes('em'));
  assert.ok(kinds.includes('code'));
  assert.ok(kinds.includes('del'));

  const link = tokens.find((token) => token.type === 'link');
  assert.equal(link.href, 'https://example.com');
});

test('leaves unmatched emphasis as plain text', () => {
  const tokens = parseInline('5 * 6');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].type, 'text');
});

test('only http(s) and mailto links survive sanitization', () => {
  assert.equal(sanitizeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(sanitizeUrl('mailto:hi@example.com'), 'mailto:hi@example.com');
  assert.equal(sanitizeUrl('/relative/path'), null, 'relative paths are not meaningful in chat output');
  assert.equal(sanitizeUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeUrl('data:text/html,<script>'), null);
  assert.equal(sanitizeUrl('vbscript:msgbox'), null);
  assert.equal(sanitizeUrl(''), null);
});

test('maps common language aliases to readable labels', () => {
  assert.equal(languageLabel('js'), 'JavaScript');
  assert.equal(languageLabel('py'), 'Python');
  assert.equal(languageLabel(''), 'Code');
  assert.equal(languageLabel('brainfuck'), 'brainfuck');
});
