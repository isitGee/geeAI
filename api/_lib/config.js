/**
 * Server-side configuration.
 *
 * Everything here comes from environment variables. Nothing in this file (or
 * anywhere under `api/`) may ever be sent to the browser — only the small,
 * deliberately public subset exposed by `api/info.js`.
 */

const DEFAULT_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

function envList(name, fallback) {
  const values = String(process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : fallback;
}

function envNumber(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

/**
 * Read configuration at request time (not at module load) so tests and local
 * tooling can change env vars between calls.
 */
export function loadConfig() {
  return {
    provider: String(process.env.AI_PROVIDER || 'gemini').trim().toLowerCase(),
    requestTimeoutMs: envNumber('AI_REQUEST_TIMEOUT_MS', 55_000, { min: 5_000, max: 300_000 }),
    limits: {
      maxMessages: 60,
      maxMessageChars: 12_000,
      maxTotalChars: 48_000,
      maxBodyBytes: 512 * 1024,
      maxIdLength: 64,
    },
    rateLimit: {
      windowMs: 60_000,
      maxRequests: envNumber('AI_RATE_LIMIT_PER_MINUTE', 30, { min: 1, max: 500 }),
      maxTrackedIps: 5_000,
    },
    gemini: {
      apiKey: String(process.env.GEMINI_API_KEY || '').trim(),
      baseUrl: String(process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, ''),
      defaultModel: String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
      models: envList('GEMINI_MODELS', DEFAULT_GEMINI_MODELS),
    },
  };
}
