/**
 * Local persistence.
 *
 * Conversations live in the browser's localStorage: no account, no server
 * round-trip, works offline, and nothing leaves the device. If localStorage is
 * unavailable (private mode, blocked storage) the store falls back to memory
 * and the UI keeps working for the current session.
 *
 * Shape:
 *   conversation = { id, title, createdAt, updatedAt, messages[] }
 *   message      = { id, role: 'user'|'assistant', content, timestamp, error? }
 */

import { createId } from './utils.js';

const KEYS = {
  conversations: 'geeai.conversations.v1',
  settings: 'geeai.settings.v1',
  active: 'geeai.active.v1',
};

const MAX_CONVERSATIONS = 200;
const MAX_MESSAGES_PER_CONVERSATION = 200;
const DEFAULT_TITLE = 'New chat';

let memoryFallback = { conversations: null, settings: null, active: null };
let storageAvailable = null;

export function isPersistent() {
  if (storageAvailable === null) {
    try {
      const probe = '__geeai_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  }
  return storageAvailable;
}

function read(key) {
  if (!isPersistent()) return memoryFallback[key];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('[geeai] could not read stored data:', error);
    return null;
  }
}

function write(key, value) {
  if (!isPersistent()) {
    memoryFallback[key] = value;
    return true;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('[geeai] could not persist data:', error);
    memoryFallback[key] = value;
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                              */
/* -------------------------------------------------------------------------- */

export function createConversation() {
  const now = Date.now();
  return { id: createId('c'), title: DEFAULT_TITLE, createdAt: now, updatedAt: now, messages: [] };
}

export function createMessage(role, content, extra = {}) {
  return { id: createId('m'), role, content, timestamp: Date.now(), ...extra };
}

export function loadConversations() {
  const stored = read(KEYS.conversations);
  if (!Array.isArray(stored)) return [];

  return stored
    .map(sanitizeConversation)
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS);
}

export function saveConversations(conversations) {
  const trimmed = conversations
    .slice(0, MAX_CONVERSATIONS)
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
    }));
  return write(KEYS.conversations, trimmed);
}

export function loadActiveId() {
  const id = read(KEYS.active);
  return typeof id === 'string' ? id : null;
}

export function saveActiveId(id) {
  write(KEYS.active, id);
}

function sanitizeConversation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !Array.isArray(raw.messages)) return null;

  const messages = raw.messages
    .filter((message) => message && typeof message === 'object')
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .filter((message) => typeof message.content === 'string')
    .slice(-MAX_MESSAGES_PER_CONVERSATION)
    .map((message) => ({
      id: typeof message.id === 'string' ? message.id : createId('m'),
      role: message.role,
      content: message.content,
      timestamp: Number.isFinite(message.timestamp) ? message.timestamp : Date.now(),
      error: message.error && typeof message.error === 'object' ? message.error : undefined,
    }));

  return {
    id: raw.id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : DEFAULT_TITLE,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
    messages,
  };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_SETTINGS = { theme: 'system', model: null };

export function loadSettings() {
  const stored = read(KEYS.settings);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    theme: ['light', 'dark', 'system'].includes(stored.theme) ? stored.theme : 'system',
    model: typeof stored.model === 'string' ? stored.model : null,
  };
}

export function saveSettings(settings) {
  return write(KEYS.settings, settings);
}

export function clearAll() {
  memoryFallback = { conversations: null, settings: null, active: null };
  if (!isPersistent()) return;
  try {
    Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn('[geeai] could not clear stored data:', error);
  }
}

/* -------------------------------------------------------------------------- */
/* Titles                                                                     */
/* -------------------------------------------------------------------------- */

const LEADING_VERB =
  /^(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:explain|describe|show|tell|give|help|write|make|create|build|list|summarize|summarise|compare|debug|fix|find|check|teach|walk\s+me\s+through)?\s*/i;
const LEADING_IMPERATIVE =
  /^(?:please\s+)?(?:explain|describe|summarize|summarise|help\s+me\s+(?:to\s+)?|help\s+me|write|create|build|make|generate|give\s+me|show\s+me|tell\s+me|teach\s+me|walk\s+me\s+through|list|compare|debug|fix|find|analyse|analyze|plan|draft|suggest|calculate|convert|translate|review|optimize|optimise|implement|design)\s+/i;
const TRAILING_FILLER = /(?:\s+(?:to\s+me|for\s+me|please|in\s+detail|step\s+by\s+step|as\s+well|thanks|thank\s+you))+$/i;

/**
 * Derives a readable conversation title from the first user message.
 * "Explain subnetting to me" → "Subnetting"
 */
export function deriveTitle(text, fallback = DEFAULT_TITLE) {
  if (typeof text !== 'string') return fallback;

  const firstLine = text.trim().split('\n').find((line) => line.trim().length > 0) || '';
  let title = firstLine
    .replace(/^\s*[-*+>#\s]+/, '')
    .replace(/[*_`~[\](){}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  title = title.replace(LEADING_VERB, '').replace(LEADING_IMPERATIVE, '').trim();
  title = title.replace(TRAILING_FILLER, '').trim();
  title = title.replace(/^[\s:,-]+|[\s:,-]+$/g, '').trim();

  if (!title) return fallback;

  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (title.length > 60) {
    title = `${title.slice(0, 57).replace(/\s+\S*$/, '')}…`;
  }
  return title;
}
