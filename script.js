/* ==========================================================================
   GeeAI — Application Script
   Plain JavaScript, no frameworks. Organized into clear sections so this
   file stays easy to extend once a real backend / AI API is wired up.
   ========================================================================== */

(() => {
  'use strict';

  // ------------------------------------------------------------------------
  // DOM Elements
  // ------------------------------------------------------------------------

  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const historyList = document.getElementById('historyList');

  const chatMain = document.getElementById('chatMain');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const suggestionsWrap = document.getElementById('suggestions');
  const messagesEl = document.getElementById('messages');

  const composerForm = document.getElementById('composerForm');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');

  // ------------------------------------------------------------------------
  // Chat State
  // ------------------------------------------------------------------------

  // Holds the full conversation so it can later be sent to a real backend
  // (e.g. POST /api/chat with { conversation }) instead of the simulated
  // response used at this stage.
  let conversation = [];

  const MAX_TEXTAREA_HEIGHT = 200; // px, mirrors the CSS max-height

  // ------------------------------------------------------------------------
  // Message Functions
  // ------------------------------------------------------------------------

  /**
   * Adds a user message to the UI and to conversation state.
   * @param {string} text
   */
  function addUserMessage(text) {
    conversation.push({ role: 'user', content: text, timestamp: Date.now() });
    renderMessage('user', text);
  }

  /**
   * Adds an AI message to the UI and to conversation state.
   * @param {string} text
   */
  function addAIMessage(text) {
    conversation.push({ role: 'ai', content: text, timestamp: Date.now() });
    renderMessage('ai', text);
  }

  /**
   * Renders a single message bubble into the thread.
   * Text is escaped before insertion — never trust message content,
   * since AI-generated or backend content will eventually land here too.
   * @param {'user'|'ai'} role
   * @param {string} text
   */
  function renderMessage(role, text) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    if (role === 'ai') {
      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = 'G';
      row.appendChild(avatar);
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = escapeHTML(text); // safe: text is escaped above

    content.appendChild(bubble);
    row.appendChild(content);
    messagesEl.appendChild(row);

    scrollToBottom();
  }

  /**
   * Shows an animated "typing" indicator in place of an AI message,
   * used while a response (simulated now, real later) is pending.
   * @returns {HTMLElement} the indicator row, so it can be removed later
   */
  function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row ai';
    row.id = 'typingIndicatorRow';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = 'G';

    const content = document.createElement('div');
    content.className = 'message-content';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-label', 'GeeAI is typing');
    indicator.innerHTML = '<span></span><span></span><span></span>';

    content.appendChild(indicator);
    row.appendChild(avatar);
    row.appendChild(content);
    messagesEl.appendChild(row);

    scrollToBottom();
    return row;
  }

  /** Removes the typing indicator from the DOM, if present. */
  function removeTypingIndicator() {
    const row = document.getElementById('typingIndicatorRow');
    if (row) row.remove();
  }

  /** Clears all messages and resets the conversation back to the welcome state. */
  function clearChat() {
    conversation = [];
    messagesEl.innerHTML = '';
    messagesEl.hidden = true;
    welcomeScreen.hidden = false;
    resetComposer();
  }

  // ------------------------------------------------------------------------
  // AI Response (temporary simulation — swap for a real API call later)
  // ------------------------------------------------------------------------

  /**
   * Placeholder for the future backend call. Today it resolves with a
   * simulated response after a short delay. Later this can become:
   *
   *   const res = await fetch('/api/chat', {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify({ message, conversation }),
   *   });
   *   const data = await res.json();
   *   return data.reply;
   *
   * Keeping this as a single async function means the rest of the UI
   * doesn't need to change when the real API is connected.
   * @param {string} message
   * @returns {Promise<string>}
   */
  async function sendMessageToAI(message) {
    const SIMULATED_DELAY_MS = 900;

    await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));

    return "I'm GeeAI 👋\n\nI'm not connected to an AI model yet, but that's coming next.";
  }

  // ------------------------------------------------------------------------
  // UI Functions
  // ------------------------------------------------------------------------

  /** Hides the welcome screen and reveals the message thread, once. */
  function showMessageThread() {
    if (!welcomeScreen.hidden) {
      welcomeScreen.hidden = true;
    }
    if (messagesEl.hidden) {
      messagesEl.hidden = false;
    }
  }

  /** Scrolls the chat area to the most recent message. */
  function scrollToBottom() {
    chatMain.scrollTop = chatMain.scrollHeight;
  }

  /** Grows the composer textarea as the user types, up to a max height. */
  function autoExpandTextarea() {
    messageInput.style.height = 'auto';
    const nextHeight = Math.min(messageInput.scrollHeight, MAX_TEXTAREA_HEIGHT);
    messageInput.style.height = `${nextHeight}px`;
  }

  /** Enables/disables the send button based on whether there's real content to send. */
  function updateSendButtonState() {
    sendBtn.disabled = messageInput.value.trim().length === 0;
  }

  /** Resets the composer back to its empty, single-line state. */
  function resetComposer() {
    messageInput.value = '';
    messageInput.style.height = 'auto';
    updateSendButtonState();
  }

  /**
   * Runs the full send flow: shows the user's message, simulates a reply
   * with a typing indicator, then renders the AI's response.
   * @param {string} rawText
   */
  async function handleSendMessage(rawText) {
    const text = rawText.trim();
    if (!text) return;

    showMessageThread();
    addUserMessage(text);
    resetComposer();

    showTypingIndicator();

    try {
      const reply = await sendMessageToAI(text);
      removeTypingIndicator();
      addAIMessage(reply);
    } catch (error) {
      removeTypingIndicator();
      addAIMessage("Something went wrong reaching GeeAI. Please try again in a moment.");
      console.error('sendMessageToAI failed:', error);
    }
  }

  // ------------------------------------------------------------------------
  // Event Listeners
  // ------------------------------------------------------------------------

  composerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSendMessage(messageInput.value);
  });

  messageInput.addEventListener('input', () => {
    autoExpandTextarea();
    updateSendButtonState();
  });

  // Enter sends the message; Shift+Enter inserts a new line.
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!sendBtn.disabled) {
        handleSendMessage(messageInput.value);
      }
    }
  });

  newChatBtn.addEventListener('click', () => {
    clearChat();
    closeSidebar();
    messageInput.focus();
  });

  suggestionsWrap.addEventListener('click', (event) => {
    const card = event.target.closest('.suggestion-card');
    if (!card) return;

    const prompt = card.dataset.prompt || card.textContent.trim();
    handleSendMessage(prompt);
  });

  historyList.addEventListener('click', (event) => {
    const item = event.target.closest('.history-item');
    if (!item) return;

    historyList.querySelectorAll('.history-item').forEach((el) => el.classList.remove('active'));
    item.classList.add('active');
    closeSidebar();
    // Placeholder only: loading a real past conversation happens once
    // this list is backed by stored/backend conversation history.
  });

  // ------------------------------------------------------------------------
  // Mobile Sidebar
  // ------------------------------------------------------------------------

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.hidden = false;
    // allow the "hidden" removal to paint before transitioning opacity in
    requestAnimationFrame(() => sidebarOverlay.classList.add('visible'));
    hamburgerBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    sidebarOverlay.addEventListener('transitionend', () => {
      if (!sidebar.classList.contains('open')) {
        sidebarOverlay.hidden = true;
      }
    }, { once: true });
  }

  function toggleSidebar() {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  hamburgerBtn.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Close the mobile drawer if the viewport grows back to desktop size.
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760 && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });

  // Escape key closes the mobile sidebar.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });

  // ------------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------------

  /**
   * Escapes HTML-significant characters so user or AI-provided text can
   * never be interpreted as markup when inserted into the DOM.
   * @param {string} str
   * @returns {string}
   */
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ------------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------------

  updateSendButtonState();
})();
