/**
 * Theme handling: light / dark / system.
 *
 * The initial theme is applied by an inline script in index.html (before first
 * paint, so the page never flashes). This module keeps it in sync afterwards.
 */

const media = window.matchMedia('(prefers-color-scheme: dark)');

function resolveTheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return media.matches ? 'dark' : 'light';
}

export function applyTheme(preference) {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  return resolved;
}

/** Calls `listener(preference)` whenever the system theme changes. */
export function watchSystemTheme(listener) {
  const handler = (event) => listener(event.matches ? 'dark' : 'light');
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
