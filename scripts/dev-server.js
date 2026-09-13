#!/usr/bin/env node
/**
 * Local development server.
 *
 * Serves the static frontend and routes /api/* to the same handler modules
 * Vercel uses, so `npm run dev` behaves like a real deployment — including
 * streaming responses — without installing the Vercel CLI.
 *
 * Usage:  npm run dev        (or: PORT=4000 npm run dev)
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

const HANDLERS = {
  '/api/chat': () => import('../api/chat.js'),
  '/api/info': () => import('../api/info.js'),
};

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const target = path.resolve(ROOT, `.${decodeURIComponent(requested)}`);

  // Never serve anything outside the project directory.
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let stats;
  try {
    stats = await fsp.stat(target);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  const file = stats.isDirectory() ? path.join(target, 'index.html') : target;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const handler = HANDLERS[url.pathname.replace(/\/+$/, '')];

  if (handler) {
    try {
      const module = await handler();
      await module.default(req, res);
    } catch (error) {
      console.error('[dev] handler error:', error);
      if (!res.headersSent) res.writeHead(500);
      if (!res.writableEnded) res.end('Internal Server Error');
    }
    return;
  }

  await serveStatic(req, res, url.pathname);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error('[dev] request failed:', error);
    if (!res.headersSent) res.writeHead(500);
    if (!res.writableEnded) res.end('Internal Server Error');
  });
});

server.listen(PORT, HOST, () => {
  const config = process.env.AI_PROVIDER || 'gemini';
  const keyState = process.env.GEMINI_API_KEY ? 'configured' : 'MISSING';
  console.log(`GeeAI dev server → http://localhost:${PORT}`);
  console.log(`AI_PROVIDER=${config} · GEMINI_API_KEY=${keyState}`);
});
