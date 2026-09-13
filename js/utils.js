/** Small shared helpers. No dependencies, no DOM assumptions. */

/** A short, unique, URL-safe id. */
export function createId(prefix = 'id') {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return `${prefix}_${random}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact relative time for the conversation list. */
export function formatRelativeTime(timestamp) {
  if (!Number.isFinite(timestamp)) return '';

  const diff = Date.now() - timestamp;
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes}m ago`;
  }
  if (diff < DAY && isSameDay(timestamp, Date.now())) {
    return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (isSameDay(timestamp, Date.now() - DAY)) return 'Yesterday';
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function isSameDay(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** Copies text, falling back to a hidden textarea on insecure origins. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
