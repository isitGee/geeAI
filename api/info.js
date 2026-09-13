import { loadConfig } from './_lib/config.js';
import { providerInfo } from './_lib/providers/index.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

/**
 * Public, non-secret deployment metadata for the UI: which provider and models
 * this deployment can use, and whether a key is configured.
 */
export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: { code: 'method_not_allowed', message: 'Use GET for this endpoint.' } }));
    return;
  }

  const appConfig = loadConfig();
  const info = providerInfo(appConfig);

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ provider: info, storage: 'local' }));
}
