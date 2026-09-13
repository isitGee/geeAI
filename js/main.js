/**
 * GeeAI — application controller.
 *
 * Owns the state (conversations in memory + localStorage), wires the DOM and
 * drives the streaming request. Everything the UI does happens here or in one
 * of the small modules it imports:
 *
 *   store.js    persistence + conversation shape
 *   api.js      /api/chat streaming client
 *   markdown.js safe Markdown rendering
 *   messages.js message DOM
 *   sidebar.js  conversation list
 *   theme.js    light / dark / system
 */

import * as store from './store.js';
import { fetchInfo, streamChat } from './api.js';
import { applyTheme, watchSystemTheme } from './theme.js';
import { createSidebar } from './sidebar.js';
import * as views from './messages.js';
import { copyText } from './utils.js';
import { showToast } from './toast.js';

const MAX_COMPOSER_HEIGHT = 200;

const dom = {
  sidebar: document.getElementById('sidebar'),
  backdrop: document.getElementById('sidebarBackdrop'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  sidebarClose: document.getElementById('sidebarCloseBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  searchInput: document.getElementById('searchInput'),
  conversationList: document.getElementById('conversationList'),
  historyEmpty: document.getElementById('historyEmpty'),
  settingsBtn: document.getElementById('settingsBtn'),
  topbarTitle: document.getElementById('topbarTitle'),
  modelBadge: document.getElementById('modelBadge'),
  themeToggle: document.getElementById('themeToggle'),
  chatScroll: document.getElementById('chatScroll'),
  emptyState: document.getElementById('emptyState'),
  suggestions: document.getElementById('suggestions'),
  messages: document.getElementById('messages'),
  composerForm: document.getElementById('composerForm'),
  composerInput: document.getElementById('composerInput'),
  sendBtn: document.getElementById('sendBtn'),
  stopBtn: document.getElementById('stopBtn'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsCloseBtn: document.getElementById('settingsCloseBtn'),
  themeOptions: document.getElementById('themeOptions'),
  modelSelect: document.getElementById('modelSelect'),
  modelHint: document.getElementById('modelHint'),
  storageSummary: document.getElementById('storageSummary'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  srStatus: document.getElementById('srStatus'),
};

const state = {
  conversations: store.loadConversations(),
  activeId: store.loadActiveId(),
  settings: store.loadSettings(),
  query: '',
  info: null,
  stream: null,
};

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

function persistNow() {
  state.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  const ok = store.saveConversations(state.conversations);
  store.saveActiveId(state.activeId);
  if (!ok) {
    showToast('GeeAI could not save to this browser’s storage.', { variant: 'error' });
  }
}

/* -------------------------------------------------------------------------- */
/* State helpers                                                              */
/* -------------------------------------------------------------------------- */

function getActive() {
  return state.conversations.find((conversation) => conversation.id === state.activeId) || null;
}

function findConversationByMessage(messageId) {
  return state.conversations.find((conversation) =>
    conversation.messages.some((message) => message.id === messageId),
  ) || null;
}

function currentModel() {
  if (!state.info?.provider?.configured) return undefined;
  const { models = [], defaultModel } = state.info.provider;
  return models.includes(state.settings.model) ? state.settings.model : defaultModel;
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

const sidebar = createSidebar({
  listElement: dom.conversationList,
  emptyElement: dom.historyEmpty,
  searchInput: dom.searchInput,
  onSelect: selectConversation,
  onRename: renameConversation,
  onDelete: deleteConversation,
  onSearch: (query) => {
    state.query = query;
    render();
  },
  requestRender: render,
});

function render() {
  const active = getActive();
  const hasMessages = Boolean(active && active.messages.length > 0);

  dom.emptyState.hidden = hasMessages;
  dom.messages.hidden = !hasMessages;
  dom.topbarTitle.textContent = active ? active.title : 'GeeAI';

  if (hasMessages) renderMessages(active);
  else dom.messages.replaceChildren();

  sidebar.render(state.conversations, state.activeId, state.query);
  updateComposerState();
}

function renderMessages(conversation) {
  const lastIndex = conversation.messages.length - 1;

  dom.messages.replaceChildren(
    ...conversation.messages.map((message, index) =>
      views.createMessageElement(message, {
        canRegenerate: index === lastIndex && message.role === 'assistant',
        canEdit: message.role === 'user',
        onRegenerate: () => regenerate(message.id),
        onEdit: () => beginEdit(message.id),
        onRetry: () => regenerate(message.id),
        onCopyCode: handleCopyCode,
      }),
    ),
  );
}

function scrollToBottom(force = false) {
  const { scrollTop, scrollHeight, clientHeight } = dom.chatScroll;
  const nearBottom = scrollHeight - scrollTop - clientHeight < 140;
  if (force || nearBottom) dom.chatScroll.scrollTop = scrollHeight;
}

function announce(message) {
  dom.srStatus.textContent = message;
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                              */
/* -------------------------------------------------------------------------- */

function ensureConversation() {
  const existing = getActive();
  if (existing) return existing;

  const conversation = store.createConversation();
  state.conversations.unshift(conversation);
  state.activeId = conversation.id;
  return conversation;
}

function startNewChat() {
  if (state.stream) stopGeneration();

  const current = getActive();
  if (current && current.messages.length === 0) {
    closeDrawer();
    focusComposer();
    return;
  }

  const conversation = store.createConversation();
  state.conversations.unshift(conversation);
  state.activeId = conversation.id;
  state.query = '';
  dom.searchInput.value = '';

  persistNow();
  render();
  closeDrawer();
  focusComposer();
}

function selectConversation(id) {
  if (id === state.activeId) {
    closeDrawer();
    return;
  }
  if (state.stream) stopGeneration();

  state.activeId = id;
  state.query = '';
  dom.searchInput.value = '';
  persistNow();
  render();
  closeDrawer();
  scrollToBottom(true);
}

function deleteConversation(id) {
  const index = state.conversations.findIndex((conversation) => conversation.id === id);
  if (index === -1) return;

  if (state.stream?.conversationId === id) stopGeneration();

  const [removed] = state.conversations.splice(index, 1);
  if (state.activeId === id) state.activeId = state.conversations[0]?.id ?? null;

  persistNow();
  render();
  showToast(`Deleted “${removed.title}”`);
}

function renameConversation(id, title) {
  const conversation = state.conversations.find((entry) => entry.id === id);
  if (!conversation) return;

  conversation.title = title;
  conversation.titleAuto = false;
  conversation.updatedAt = Date.now();
  persistNow();
  render();
}

function clearAllConversations() {
  if (state.stream) stopGeneration();

  store.clearAll();
  state.conversations = [];
  state.activeId = null;
  state.query = '';
  dom.searchInput.value = '';
  render();
  showToast('All conversations cleared');
}

/* -------------------------------------------------------------------------- */
/* Sending & streaming                                                        */
/* -------------------------------------------------------------------------- */

function sendMessage(rawText) {
  const text = String(rawText ?? '').trim();
  if (!text || state.stream) return;

  const conversation = ensureConversation();
  const message = store.createMessage('user', text);
  conversation.messages.push(message);
  conversation.updatedAt = Date.now();

  const previousUserMessages = conversation.messages.filter((entry) => entry.role === 'user');
  if (previousUserMessages.length === 1 && conversation.titleAuto !== false) {
    conversation.title = store.deriveTitle(text);
    conversation.titleAuto = true;
  }

  persistNow();
  render();
  scrollToBottom(true);
  requestAssistant(conversation);
}

async function requestAssistant(conversation) {
  const history = conversation.messages
    .filter((message) => !message.error && message.content.trim())
    .map(({ role, content }) => ({ role, content }));

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    showToast('Add a message first.', { variant: 'error' });
    return;
  }

  const assistant = store.createMessage('assistant', '');
  conversation.messages.push(assistant);

  render();
  const row = dom.messages.querySelector(`[data-id="${assistant.id}"]`);
  if (row) views.showThinking(row);
  scrollToBottom(true);

  const controller = new AbortController();
  state.stream = { controller, conversationId: conversation.id, messageId: assistant.id };
  updateComposerState();
  announce('GeeAI is thinking');

  let pending = '';
  let frameQueued = false;
  const scheduleRender = () => {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(() => {
      frameQueued = false;
      if (!row || !row.isConnected) return;
      views.setAssistantContent(row, pending, { onCopyCode: handleCopyCode });
      scrollToBottom();
    });
  };

  try {
    const result = await streamChat({
      conversationId: conversation.id,
      messages: history,
      model: currentModel(),
      signal: controller.signal,
      onDelta: (_chunk, full) => {
        pending = full;
        scheduleRender();
      },
    });

    assistant.content = result.text || pending;
    conversation.updatedAt = Date.now();
    persistNow();
    render();
    scrollToBottom();
    announce('GeeAI finished responding');
  } catch (error) {
    if (error?.name === 'AbortError') {
      // Stopped by the user: keep whatever arrived.
      if (pending.trim()) {
        assistant.content = pending;
        conversation.updatedAt = Date.now();
        persistNow();
        render();
      } else {
        conversation.messages = conversation.messages.filter((message) => message.id !== assistant.id);
        persistNow();
        render();
      }
      announce('Generation stopped');
    } else {
      assistant.error = { code: error?.code || 'server', message: error?.message || 'Something went wrong.' };
      persistNow();
      render();
      showToast(error?.message || 'Something went wrong.', { variant: 'error' });
      announce(`GeeAI error: ${assistant.error.message}`);
    }
  } finally {
    state.stream = null;
    updateComposerState();
  }
}

function stopGeneration() {
  state.stream?.controller.abort();
}

function regenerate(messageId) {
  const conversation = findConversationByMessage(messageId);
  if (!conversation || state.stream) return;

  const index = conversation.messages.findIndex((message) => message.id === messageId);
  if (index <= 0) return;

  conversation.messages = conversation.messages.slice(0, index);
  conversation.updatedAt = Date.now();
  persistNow();
  render();
  requestAssistant(conversation);
}

function beginEdit(messageId) {
  const conversation = findConversationByMessage(messageId);
  if (!conversation || state.stream) return;

  const index = conversation.messages.findIndex((message) => message.id === messageId);
  const message = conversation.messages[index];
  if (!message || message.role !== 'user') return;

  const row = dom.messages.querySelector(`[data-id="${messageId}"] .msg__body`);
  if (!row) return;

  const { form, textarea } = views.createEditForm({
    initialValue: message.content,
    onCancel: render,
    onSave: (value) => {
      message.content = value;
      message.timestamp = Date.now();
      conversation.messages = conversation.messages.slice(0, index + 1);
      conversation.updatedAt = Date.now();

      if (index === 0 && conversation.titleAuto !== false) {
        conversation.title = store.deriveTitle(value);
        conversation.titleAuto = true;
      }

      persistNow();
      render();
      requestAssistant(conversation);
    },
  });

  row.replaceChildren(form);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

async function handleCopyCode(code, button) {
  const copied = await copyText(code);
  views.flashButton(button, copied ? 'Copied' : 'Copy failed', copied ? 'i-check' : 'i-copy');
}

/* -------------------------------------------------------------------------- */
/* Composer                                                                   */
/* -------------------------------------------------------------------------- */

function autoGrow() {
  dom.composerInput.style.height = 'auto';
  dom.composerInput.style.height = `${Math.min(dom.composerInput.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  dom.composerInput.style.overflowY = dom.composerInput.scrollHeight > MAX_COMPOSER_HEIGHT ? 'auto' : 'hidden';
}

function updateComposerState() {
  const streaming = Boolean(state.stream);
  const hasText = dom.composerInput.value.trim().length > 0;

  dom.sendBtn.hidden = streaming;
  dom.stopBtn.hidden = !streaming;
  dom.sendBtn.disabled = !hasText || streaming;
  dom.composerInput.placeholder = streaming ? 'GeeAI is responding…' : 'Message GeeAI…';
}

function focusComposer() {
  dom.composerInput.focus();
}

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

const THEME_ICONS = { light: 'i-sun', dark: 'i-moon', system: 'i-monitor' };

function updateThemeToggle() {
  const preference = state.settings.theme;
  const use = dom.themeToggle.querySelector('use');
  if (use) use.setAttribute('href', `#${THEME_ICONS[preference]}`);
  dom.themeToggle.setAttribute('aria-label', `Theme: ${preference}. Change theme.`);
  dom.themeToggle.title = `Theme: ${preference}`;
}

function setTheme(preference) {
  state.settings.theme = preference;
  store.saveSettings(state.settings);
  applyTheme(preference);
  updateThemeToggle();
  syncThemeInputs();
}

function syncThemeInputs() {
  dom.themeOptions.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.checked = input.value === state.settings.theme;
  });
}

function cycleTheme() {
  const order = ['light', 'dark', 'system'];
  const next = order[(order.indexOf(state.settings.theme) + 1) % order.length];
  setTheme(next);
}

/* -------------------------------------------------------------------------- */
/* Mobile drawer                                                              */
/* -------------------------------------------------------------------------- */

function isDrawerOpen() {
  return dom.sidebar.classList.contains('is-open');
}

function openDrawer() {
  dom.sidebar.classList.add('is-open');
  dom.backdrop.hidden = false;
  requestAnimationFrame(() => dom.backdrop.classList.add('is-visible'));
  dom.sidebarToggle.setAttribute('aria-expanded', 'true');
  dom.newChatBtn.focus();
}

function closeDrawer({ restoreFocus = true } = {}) {
  if (!isDrawerOpen()) return;

  const hadFocusInside = dom.sidebar.contains(document.activeElement);
  dom.sidebar.classList.remove('is-open');
  dom.backdrop.classList.remove('is-visible');
  dom.sidebarToggle.setAttribute('aria-expanded', 'false');

  setTimeout(() => {
    if (!isDrawerOpen()) dom.backdrop.hidden = true;
  }, 200);

  if (restoreFocus && hadFocusInside) dom.sidebarToggle.focus();
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

function updateProviderUi() {
  const provider = state.info?.provider;

  if (!provider) {
    dom.modelBadge.textContent = 'Offline';
    dom.modelBadge.title = 'Could not load provider information';
    dom.modelSelect.disabled = true;
    dom.modelSelect.replaceChildren(new Option('Unavailable', ''));
    dom.modelHint.textContent = 'GeeAI could not reach the server to load provider information.';
    return;
  }

  const model = currentModel() || provider.defaultModel;
  dom.modelBadge.textContent = provider.configured ? model : 'Not connected';
  dom.modelBadge.title = provider.configured
    ? `${provider.label} · ${model}`
    : 'No AI provider key configured on the server';

  if (dom.modelSelect.dataset.provider !== provider.name) {
    dom.modelSelect.dataset.provider = provider.name;
    dom.modelSelect.replaceChildren(...provider.models.map((name) => new Option(name, name)));
  }
  dom.modelSelect.value = model;
  dom.modelSelect.disabled = !provider.configured;

  dom.modelHint.textContent = provider.configured
    ? `${provider.label} · responses are generated server-side and streamed to this page.`
    : `${provider.label} is selected, but no API key is configured on the server. Add GEMINI_API_KEY in the project environment, then reload.`;
}

function updateStorageSummary() {
  const conversations = state.conversations.length;
  const messages = state.conversations.reduce((total, conversation) => total + conversation.messages.length, 0);
  dom.storageSummary.textContent = store.isPersistent()
    ? `${conversations} conversation${conversations === 1 ? '' : 's'} · ${messages} message${messages === 1 ? '' : 's'} stored in this browser.`
    : 'This browser is blocking local storage, so conversations will be lost on reload.';
}

function openSettings() {
  syncThemeInputs();
  updateProviderUi();
  updateStorageSummary();
  resetClearConfirm();
  closeDrawer({ restoreFocus: false });

  if (typeof dom.settingsDialog.showModal === 'function') dom.settingsDialog.showModal();
  else dom.settingsDialog.setAttribute('open', '');
  dom.settingsCloseBtn.focus();
}

let clearConfirmTimer = null;

function resetClearConfirm() {
  clearTimeout(clearConfirmTimer);
  delete dom.clearAllBtn.dataset.confirm;
  const label = dom.clearAllBtn.querySelector('span');
  if (label) label.textContent = 'Clear all conversations';
}

function handleClearAll() {
  if (state.conversations.length === 0) {
    showToast('There are no conversations to clear');
    return;
  }

  if (dom.clearAllBtn.dataset.confirm !== 'true') {
    dom.clearAllBtn.dataset.confirm = 'true';
    const label = dom.clearAllBtn.querySelector('span');
    if (label) label.textContent = 'Click again to confirm';
    clearConfirmTimer = setTimeout(resetClearConfirm, 4000);
    return;
  }

  clearAllConversations();
  resetClearConfirm();
  dom.settingsDialog.close();
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

function bindEvents() {
  dom.composerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(dom.composerInput.value);
    dom.composerInput.value = '';
    autoGrow();
    updateComposerState();
  });

  dom.composerInput.addEventListener('input', () => {
    autoGrow();
    updateComposerState();
  });

  dom.composerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!state.stream && dom.composerInput.value.trim()) dom.composerForm.requestSubmit();
    }
  });

  dom.stopBtn.addEventListener('click', stopGeneration);
  dom.newChatBtn.addEventListener('click', startNewChat);

  dom.suggestions.addEventListener('click', (event) => {
    const button = event.target.closest('.suggestion');
    if (!button) return;
    sendMessage(button.dataset.prompt);
    focusComposer();
  });

  dom.sidebarToggle.addEventListener('click', () => (isDrawerOpen() ? closeDrawer() : openDrawer()));
  dom.sidebarClose.addEventListener('click', () => closeDrawer());
  dom.backdrop.addEventListener('click', () => closeDrawer());

  dom.themeToggle.addEventListener('click', cycleTheme);
  dom.settingsBtn.addEventListener('click', openSettings);
  dom.settingsCloseBtn.addEventListener('click', () => dom.settingsDialog.close());
  dom.clearAllBtn.addEventListener('click', handleClearAll);

  dom.themeOptions.addEventListener('change', (event) => {
    if (event.target.name === 'theme') setTheme(event.target.value);
  });

  dom.modelSelect.addEventListener('change', () => {
    state.settings.model = dom.modelSelect.value;
    store.saveSettings(state.settings);
    updateProviderUi();
  });

  dom.settingsDialog.addEventListener('close', resetClearConfirm);

  // Clicking the backdrop area of a native dialog closes it.
  dom.settingsDialog.addEventListener('click', (event) => {
    if (event.target === dom.settingsDialog) dom.settingsDialog.close();
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      startNewChat();
      return;
    }

    if (event.key === 'Escape') {
      if (dom.settingsDialog.open) return; // the dialog closes itself
      if (state.stream) {
        stopGeneration();
        return;
      }
      if (isDrawerOpen()) closeDrawer();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 767 && isDrawerOpen()) closeDrawer({ restoreFocus: false });
  });

  window.addEventListener('beforeunload', persistNow);
}

/* -------------------------------------------------------------------------- */
/* Init                                                                       */
/* -------------------------------------------------------------------------- */

function dropUnfinishedReplies() {
  for (const conversation of state.conversations) {
    while (conversation.messages.length > 0) {
      const last = conversation.messages[conversation.messages.length - 1];
      if (last.role === 'assistant' && !last.error && !last.content.trim()) conversation.messages.pop();
      else break;
    }
  }
}

async function loadInfo() {
  try {
    state.info = await fetchInfo();
  } catch (error) {
    console.warn('[geeai] provider info unavailable:', error?.message);
    state.info = null;
  }
  updateProviderUi();
}

function init() {
  applyTheme(state.settings.theme);
  updateThemeToggle();
  watchSystemTheme(() => {
    if (state.settings.theme === 'system') {
      applyTheme('system');
      updateThemeToggle();
    }
  });

  dropUnfinishedReplies();

  const storedExists = state.conversations.some((conversation) => conversation.id === state.activeId);
  if (!storedExists) state.activeId = state.conversations[0]?.id ?? null;

  bindEvents();
  render();
  if (getActive()?.messages.length) scrollToBottom(true);
  autoGrow();
  updateComposerState();
  updateStorageSummary();

  if (!store.isPersistent()) {
    showToast('This browser is blocking storage — conversations will not be saved.', { variant: 'error', duration: 5000 });
  }

  loadInfo();

  // Don't force the mobile keyboard open on load.
  if (window.matchMedia('(min-width: 768px)').matches) focusComposer();
}

init();
