import { ApiError } from './errors.js';

/**
 * Best-effort abuse protection.
 *
 * Serverless instances are short-lived and horizontally scaled, so this is a
 * per-instance sliding window, not a global quota. It stops the obvious cases
 * (a loop, a script, a misbehaving client) without adding a database.
 */

const hits = new Map();

export function checkRateLimit(key, { windowMs, maxRequests, maxTrackedIps }) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);

  if (recent.length >= maxRequests) {
    hits.set(key, recent);
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    throw new ApiError('rate_limited', { status: 429, detail: `key=${key} retryAfter=${retryAfter}s` });
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > maxTrackedIps) {
    for (const [entryKey, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(entryKey);
    }
    if (hits.size > maxTrackedIps) hits.delete(hits.keys().next().value);
  }

  return { remaining: maxRequests - recent.length };
}

/**
 * The client IP as reported by Vercel's edge. Only the first forwarded entry is
 * trusted, and the value is truncated so it can never become an unbounded
 * cache key.
 */
export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = typeof forwarded === 'string' && forwarded.length > 0
    ? forwarded.split(',')[0]
    : (req.socket?.remoteAddress || 'unknown');
  return String(raw).trim().slice(0, 64) || 'unknown';
}
