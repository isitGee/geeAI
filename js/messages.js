/**
 * Message rendering.
 *
 * Each message is one <li>. Assistant messages render Markdown into a `.md`
 * container; user messages stay plain text (pre-wrap) so what was sent is
 * exactly what is shown. Actions are real buttons with accessible names.
 */

import { el, icon } from './dom.js';
import { renderMarkdown } from './markdown.js';
import { copyText } from './utils.js';

export function createMessageElement(message, options = {}) {
  const { canRegenerate = false, canEdit = false, onRegenerate, onEdit, onRetry, onCopyCode } = options;

  const isUser = message.role === 'user';
  const row = el('li', {
    class: `msg msg--${isUser ? 'user' : 'assistant'}${message.error ? ' msg--error' : ''}`,
    'data-id': message.id,
  });

  if (!isUser) row.appendChild(el('div', { class: 'msg__avatar', 'aria-hidden': 'true' }, icon('i-mark')));

  const body = el('div', { class: 'msg__body' });
  row.appendChild(body);

  if (message.error) {
    body.appendChild(
      el('p', { class: 'msg__error' }, [icon('i-alert'), el('span', { text: message.error.message })]),
    );
    body.appendChild(
      el('div', { class: 'msg__actions' }, [
        actionButton({ iconName: 'i-refresh', label: 'Try again', onClick: () => onRetry?.(message.id) }),
      ]),
    );
    return row;
  }

  if (isUser) {
    body.appendChild(el('div', { class: 'msg__text', text: message.content }));
    if (canEdit) {
      body.appendChild(
        el('div', { class: 'msg__actions' }, [
          actionButton({ iconName: 'i-pencil', label: 'Edit message', onClick: () => onEdit?.(message.id) }),
        ]),
      );
    }
    return row;
  }

  body.appendChild(el('div', { class: 'md' }, renderMarkdown(message.content, { onCopyCode })));

  const actions = [copyButton(message.content)];
  if (canRegenerate) {
    actions.push(actionButton({ iconName: 'i-refresh', label: 'Regenerate', onClick: () => onRegenerate?.(message.id) }));
  }
  body.appendChild(el('div', { class: 'msg__actions' }, actions));

  return row;
}

export function getMessageBody(row) {
  return row?.querySelector('.msg__body') || null;
}

/** Replaces an assistant message's content with freshly rendered Markdown. */
export function setAssistantContent(row, text, { onCopyCode } = {}) {
  const body = getMessageBody(row);
  if (!body) return;

  let container = body.querySelector('.md');
  if (!container) {
    container = el('div', { class: 'md' });
    body.replaceChildren(container);
  }

  container.replaceChildren(renderMarkdown(text, { onCopyCode }));
  container.appendChild(el('span', { class: 'caret', 'aria-hidden': 'true' }));
}

/** Shows the "thinking" placeholder before the first token arrives. */
export function showThinking(row) {
  const body = getMessageBody(row);
  if (!body) return;

  body.replaceChildren(
    el('span', { class: 'thinking', role: 'status' }, [
      el('span', { class: 'thinking__dots', 'aria-hidden': 'true' }, [
        el('span'),
        el('span'),
        el('span'),
      ]),
      el('span', { text: 'GeeAI is thinking…' }),
    ]),
  );
}

/** Turns an assistant row into an error row with a retry action. */
export function showError(row, message, onRetry) {
  row.classList.add('msg--error');
  const body = getMessageBody(row);
  if (!body) return;

  body.replaceChildren(
    el('p', { class: 'msg__error' }, [icon('i-alert'), el('span', { text: message })]),
    el('div', { class: 'msg__actions' }, [
      actionButton({ iconName: 'i-refresh', label: 'Try again', onClick: onRetry }),
    ]),
  );
}

/** Rebuilds the action row of an assistant message (used after streaming). */
export function setAssistantActions(row, content, { canRegenerate, onRegenerate }) {
  const body = getMessageBody(row);
  if (!body) return;

  const existing = body.querySelector('.msg__actions');
  if (existing) existing.remove();

  const actions = [copyButton(content)];
  if (canRegenerate) {
    actions.push(actionButton({ iconName: 'i-refresh', label: 'Regenerate', onClick: onRegenerate }));
  }
  body.appendChild(el('div', { class: 'msg__actions' }, actions));
}

/* -------------------------------------------------------------------------- */

function actionButton({ iconName, label, onClick }) {
  return el('button', { class: 'chip', type: 'button', onClick }, [icon(iconName), el('span', { text: label })]);
}

function copyButton(content) {
  const button = el('button', { class: 'chip', type: 'button' }, [icon('i-copy'), el('span', { text: 'Copy' })]);

  button.addEventListener('click', async () => {
    const copied = await copyText(content);
    flashButton(button, copied ? 'Copied' : 'Copy failed', copied ? 'i-check' : 'i-copy');
  });

  return button;
}

/** Swaps a chip's icon and label for a moment, then restores it. */
export function flashButton(button, label, iconName = null) {
  const previousLabel = button.dataset.originalLabel || button.querySelector('span')?.textContent || '';
  const previousIcon = button.dataset.originalIcon || button.querySelector('use')?.getAttribute('href') || '';

  button.dataset.originalLabel = previousLabel;
  button.dataset.originalIcon = previousIcon;

  const labelNode = button.querySelector('span');
  if (labelNode) labelNode.textContent = label;
  const useNode = button.querySelector('use');
  if (useNode && iconName) useNode.setAttribute('href', `#${iconName}`);
  button.classList.add('is-active');

  clearTimeout(button._flashTimer);
  button._flashTimer = setTimeout(() => {
    if (labelNode) labelNode.textContent = previousLabel;
    if (useNode && previousIcon) useNode.setAttribute('href', previousIcon);
    button.classList.remove('is-active');
  }, 1600);
}

/** Inline editor used to rewrite a user message. */
export function createEditForm({ initialValue, onSave, onCancel }) {
  const textarea = el('textarea', { class: 'msg__edit', rows: 3, 'aria-label': 'Edit message' });
  textarea.value = initialValue;

  const form = el('form', { class: 'msg__edit-form' }, [
    textarea,
    el('div', { class: 'msg__edit-actions' }, [
      el('button', { class: 'btn', type: 'button', onClick: onCancel }, el('span', { text: 'Cancel' })),
      el('button', { class: 'btn btn--primary', type: 'submit' }, el('span', { text: 'Save & resend' })),
    ]),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = textarea.value.trim();
    if (value) onSave(value);
  });

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  });

  return { form, textarea };
}
