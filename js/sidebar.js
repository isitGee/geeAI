/**
 * Conversation sidebar: history list, search, rename, delete.
 *
 * The list is re-rendered from state on every change — it is short (a few
 * hundred items at most) and this keeps the DOM an honest reflection of what
 * is actually stored.
 */

import { el, iconButton } from './dom.js';
import { formatRelativeTime } from './utils.js';

export function createSidebar({
  listElement,
  emptyElement,
  searchInput,
  onSelect,
  onRename,
  onDelete,
  onSearch,
  requestRender,
}) {
  let renamingId = null;

  searchInput.addEventListener('input', () => onSearch(searchInput.value));

  function render(conversations, activeId, query = '') {
    const needle = query.trim().toLowerCase();
    const visible = needle
      ? conversations.filter(
          (conversation) =>
            conversation.title.toLowerCase().includes(needle) ||
            conversation.messages.some((message) => message.content.toLowerCase().includes(needle)),
        )
      : conversations;

    listElement.replaceChildren(
      ...visible.map((conversation) => renderItem(conversation, conversation.id === activeId)),
    );

    emptyElement.hidden = visible.length > 0;
    emptyElement.textContent = needle
      ? `No conversations match “${query.trim()}”.`
      : 'No conversations yet. Start one below.';
  }

  function renderItem(conversation, isActive) {
    const item = el('li', { class: `conv${isActive ? ' is-active' : ''}`, dataset: { id: conversation.id } });

    if (renamingId === conversation.id) {
      item.appendChild(renameInput(conversation));
      return item;
    }

    const link = el(
      'button',
      {
        class: 'conv__link',
        type: 'button',
        title: conversation.title,
        'aria-current': isActive ? 'true' : null,
        onClick: () => onSelect(conversation.id),
      },
      el('span', { text: conversation.title }),
    );

    const actions = el('div', { class: 'conv__actions' }, [
      iconButton({
        iconName: 'i-pencil',
        label: `Rename “${conversation.title}”`,
        onClick: () => startRename(conversation),
      }),
      iconButton({
        iconName: 'i-trash',
        label: `Delete “${conversation.title}”`,
        onClick: () => onDelete(conversation.id),
      }),
    ]);

    item.append(link, actions);
    item.appendChild(
      el('span', { class: 'sr-only', text: `Updated ${formatRelativeTime(conversation.updatedAt)}` }),
    );

    return item;
  }

  function startRename(conversation) {
    renamingId = conversation.id;
    requestRender();
    const input = listElement.querySelector('.conv__rename');
    if (input) {
      input.focus();
      input.select();
    }
  }

  function renameInput(conversation) {
    const input = el('input', {
      class: 'conv__rename',
      type: 'text',
      'aria-label': 'Conversation title',
      maxlength: '80',
    });
    input.value = conversation.title;

    let settled = false;
    const finish = (title) => {
      if (settled) return;
      settled = true;
      renamingId = null;
      onRename(conversation.id, title);
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(input.value.trim() || conversation.title);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(conversation.title);
      }
    });
    input.addEventListener('blur', () => finish(input.value.trim() || conversation.title));

    return input;
  }

  return { render };
}
