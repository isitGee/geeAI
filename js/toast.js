/** Small transient notifications. No alerts, no modals. */

const DEFAULT_DURATION = 2600;

export function showToast(message, { variant = 'default', duration = DEFAULT_DURATION } = {}) {
  const region = document.getElementById('toastRegion');
  if (!region) return;

  const toast = document.createElement('div');
  toast.className = `toast${variant === 'error' ? ' toast--error' : ''}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  region.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 220);
  }, duration);
}
