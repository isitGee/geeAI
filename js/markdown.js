/**
 * A small, safe Markdown renderer.
 *
 * Everything is built as DOM nodes with `createTextNode` — model output is
 * never assigned to innerHTML — so untrusted text can't inject markup. Link
 * targets go through `sanitizeUrl`, which allows http(s) and mailto only.
 *
 * Supported: headings, paragraphs, bold/italic/strikethrough, inline code,
 * fenced code blocks with a language, ordered/unordered lists (nested),
 * blockquotes, tables, horizontal rules, links and autolinks.
 */

import { el, icon } from './dom.js';

const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const HRULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

const LANG_LABELS = {
  bash: 'Bash',
  c: 'C',
  cpp: 'C++',
  cs: 'C#',
  css: 'CSS',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  env: 'Env',
  go: 'Go',
  html: 'HTML',
  http: 'HTTP',
  ini: 'INI',
  java: 'Java',
  js: 'JavaScript',
  json: 'JSON',
  jsx: 'JSX',
  kt: 'Kotlin',
  md: 'Markdown',
  php: 'PHP',
  py: 'Python',
  rb: 'Ruby',
  rs: 'Rust',
  sh: 'Shell',
  sql: 'SQL',
  svg: 'SVG',
  swift: 'Swift',
  text: 'Text',
  toml: 'TOML',
  ts: 'TypeScript',
  tsx: 'TSX',
  txt: 'Text',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  zsh: 'Shell',
};

export function languageLabel(language) {
  if (!language) return 'Code';
  const key = language.toLowerCase();
  return LANG_LABELS[key] || language;
}

/** Only http(s) and mailto survive; everything else renders as plain text. */
const BASE_URL =
  (typeof window !== 'undefined' && window.location?.href) || 'https://geeai.local';

export function sanitizeUrl(raw) {
  const cleaned = String(raw).trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  if (!cleaned) return null;
  // Require an explicit scheme: a bare path would silently point at our own origin.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return null;

  try {
    const url = new URL(cleaned, BASE_URL);
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

export function parseBlocks(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const marker = fence[1];
      const language = fence[2] || '';
      const body = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(marker[0].repeat(3)) && !isClosingFence(lines[index], marker)) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1; // consume the closing fence (or run off the end)
      blocks.push({ type: 'code', language, code: body.join('\n') });
      continue;
    }

    if (HRULE.test(line)) {
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 4), text: heading[2].trim() });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body = [];
      while (index < lines.length) {
        const match = lines[index].match(QUOTE);
        if (match) {
          body.push(match[1]);
          index += 1;
        } else if (lines[index].trim() && !LIST_ITEM.test(lines[index]) && !FENCE.test(lines[index])) {
          body.push(lines[index]);
          index += 1;
        } else {
          break;
        }
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(body.join('\n')) });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const { token, next } = parseList(lines, index);
      blocks.push(token);
      index = next;
      continue;
    }

    // Table: current line is the header, next line is the divider.
    if (line.includes('|') && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1])) {
      const header = splitRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // Paragraph: runs until a blank line or the start of another block.
    const paragraph = [];
    while (index < lines.length && lines[index].trim()) {
      const candidate = lines[index];
      if (paragraph.length > 0 && startsNewBlock(candidate)) break;
      paragraph.push(candidate);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }

  return blocks;
}

function startsNewBlock(line) {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    HRULE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line)
  );
}

function isClosingFence(line, marker) {
  const match = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
  return Boolean(match && match[1][0] === marker[0] && match[1].length >= marker.length);
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseList(lines, start) {
  const rootIndent = lines[start].match(LIST_ITEM)[1].length;
  const items = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    const match = line.match(LIST_ITEM);

    if (match) {
      const indent = match[1].length;
      if (indent < rootIndent) break;

      if (indent > rootIndent + 1) {
        // Deeper list: attach it as a child of the previous item.
        const { token, next } = parseList(lines, index);
        if (items.length > 0) {
          items[items.length - 1].children.push(token);
        } else {
          items.push({ text: '', children: [token] });
        }
        index = next;
        continue;
      }

      items.push({
        ordered: /\d/.test(match[2]),
        text: match[3],
        children: [],
      });
      index += 1;
      continue;
    }

    // Continuation line (indented) — append to the current item.
    if (items.length > 0 && (line.startsWith('  ') || line.startsWith('\t') || !line.trim())) {
      if (!line.trim()) {
        const next = lines[index + 1];
        if (next === undefined || (!next.startsWith('  ') && !LIST_ITEM.test(next))) break;
        index += 1;
        continue;
      }
      items[items.length - 1].text += ` ${line.trim()}`;
      index += 1;
      continue;
    }

    break;
  }

  const first = lines[start].match(LIST_ITEM);
  return {
    token: { type: 'list', ordered: /\d/.test(first[2]), items },
    next: index,
  };
}

const INLINE_PATTERN =
  /(`+)|(\*\*)|(__)|(\*)|(_)|(~~)|(\[)|(https?:\/\/[^\s<>()[\]]+)|(<[a-z][a-z0-9+.-]*:[^>\s]+>)/g;

export function parseInline(source) {
  const text = String(source ?? '');
  const tokens = [];
  let plain = '';
  let index = 0;

  const flush = () => {
    if (plain) {
      tokens.push({ type: 'text', value: plain });
      plain = '';
    }
  };

  while (index < text.length) {
    const char = text[index];

    if (char === '\n') {
      plain += ' ';
      index += 1;
      continue;
    }

    if (char === '`') {
      const run = text.slice(index).match(/^`+/)[0];
      const closing = text.indexOf(run, index + run.length);
      if (closing !== -1 && text[closing + run.length] !== '`') {
        flush();
        tokens.push({ type: 'code', value: text.slice(index + run.length, closing).trim() });
        index = closing + run.length;
        continue;
      }
    }

    if (char === '*' || char === '_' || text.startsWith('~~', index)) {
      const delimiter = text.startsWith('~~', index) ? '~~' : text.startsWith('**', index) ? '**' : char;
      const closing = findClosing(text, delimiter, index + delimiter.length);
      if (closing !== -1) {
        const inner = text.slice(index + delimiter.length, closing);
        if (inner.trim()) {
          flush();
          const type = delimiter === '**' || delimiter === '__' ? 'strong' : delimiter === '~~' ? 'del' : 'em';
          tokens.push({ type, children: parseInline(inner) });
          index = closing + delimiter.length;
          continue;
        }
      }
    }

    if (char === '[') {
      const labelEnd = findClosing(text, ']', index + 1);
      if (labelEnd !== -1 && text[labelEnd + 1] === '(') {
        const urlEnd = findClosing(text, ')', labelEnd + 2);
        if (urlEnd !== -1) {
          flush();
          tokens.push({
            type: 'link',
            href: text.slice(labelEnd + 2, urlEnd).trim(),
            children: parseInline(text.slice(index + 1, labelEnd)),
          });
          index = urlEnd + 1;
          continue;
        }
      }
    }

    if (char === '<') {
      const match = text.slice(index).match(/^<([a-z][a-z0-9+.-]*:[^>\s]+)>/i);
      if (match) {
        flush();
        tokens.push({ type: 'autolink', href: match[1] });
        index += match[0].length;
        continue;
      }
    }

    if (char === 'h' && /^https?:\/\//.test(text.slice(index))) {
      const match = text.slice(index).match(/^https?:\/\/[^\s<>()[\]]+/);
      if (match) {
        flush();
        tokens.push({ type: 'autolink', href: match[0] });
        index += match[0].length;
        continue;
      }
    }

    plain += char;
    index += 1;
  }

  flush();
  return tokens;
}

function findClosing(text, delimiter, from) {
  let index = from;
  while (index < text.length) {
    if (text.startsWith(delimiter, index)) {
      // A delimiter run followed by more of the same character is literal.
      if (text[index + delimiter.length] === delimiter[0]) {
        index += delimiter.length;
        continue;
      }
      return index;
    }
    index += 1;
  }
  return -1;
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

export function renderMarkdown(source, { onCopyCode } = {}) {
  const fragment = document.createDocumentFragment();
  for (const block of parseBlocks(source)) {
    fragment.appendChild(renderBlock(block, { onCopyCode }));
  }
  return fragment;
}

function renderBlock(block, context) {
  switch (block.type) {
    case 'code':
      return renderCodeBlock(block, context);
    case 'heading': {
      const element = document.createElement(`h${block.level}`);
      appendInline(element, parseInline(block.text), context);
      return element;
    }
    case 'quote': {
      const element = document.createElement('blockquote');
      for (const child of block.blocks) element.appendChild(renderBlock(child, context));
      return element;
    }
    case 'list':
      return renderList(block, context);
    case 'table':
      return renderTable(block, context);
    case 'hr':
      return document.createElement('hr');
    case 'paragraph':
    default: {
      const element = document.createElement('p');
      appendInline(element, parseInline(block.text ?? ''), context);
      return element;
    }
  }
}

function renderList(block, context) {
  const element = document.createElement(block.ordered ? 'ol' : 'ul');
  for (const item of block.items) {
    const li = document.createElement('li');
    if (item.text) appendInline(li, parseInline(item.text), context);
    for (const child of item.children) li.appendChild(renderBlock(child, context));
    element.appendChild(li);
  }
  return element;
}

function renderTable(block, context) {
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const cell of block.header) {
    const th = document.createElement('th');
    appendInline(th, parseInline(cell), context);
    headRow.appendChild(th);
  }
  head.appendChild(headRow);
  table.appendChild(head);

  const body = document.createElement('tbody');
  for (const row of block.rows) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement('td');
      appendInline(td, parseInline(cell), context);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  table.appendChild(body);
  return table;
}

function appendInline(element, tokens, context) {
  for (const token of tokens) {
    element.appendChild(renderInline(token, context));
  }
}

function renderInline(token, context) {
  switch (token.type) {
    case 'text':
      return document.createTextNode(token.value);
    case 'code': {
      const code = document.createElement('code');
      code.textContent = token.value;
      return code;
    }
    case 'strong':
    case 'em':
    case 'del': {
      const tag = token.type === 'strong' ? 'strong' : token.type === 'em' ? 'em' : 'del';
      const element = document.createElement(tag);
      appendInline(element, token.children, context);
      return element;
    }
    case 'link':
    case 'autolink': {
      const href = sanitizeUrl(token.href);
      const label = token.type === 'link' ? token.children : [{ type: 'text', value: token.href }];

      if (!href) {
        const span = document.createElement('span');
        appendInline(span, label, context);
        return span;
      }

      const link = document.createElement('a');
      link.href = href;
      link.rel = 'noopener noreferrer nofollow';
      link.target = '_blank';
      appendInline(link, label, context);
      return link;
    }
    default:
      return document.createTextNode('');
  }
}

function renderCodeBlock(block, context) {
  const figure = document.createElement('figure');
  figure.className = 'code';

  const bar = document.createElement('figcaption');
  bar.className = 'code__bar';

  const language = document.createElement('span');
  language.className = 'code__lang';
  language.textContent = languageLabel(block.language);
  bar.appendChild(language);

  const label = languageLabel(block.language);
  const copyButton = el(
    'button',
    {
      class: 'chip code__copy',
      type: 'button',
      'aria-label': `Copy ${label} code`,
      onClick: () => context.onCopyCode?.(block.code, copyButton),
    },
    [icon('i-copy'), el('span', { text: 'Copy' })],
  );
  bar.appendChild(copyButton);

  const pre = document.createElement('pre');
  pre.className = 'code__pre';
  const code = document.createElement('code');
  code.textContent = block.code;
  pre.appendChild(code);

  figure.append(bar, pre);
  return figure;
}
