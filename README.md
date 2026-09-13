# GeeAI

**Your AI. Your workspace.**

GeeAI is a real AI chat application: a focused, fast chat workspace backed by a
streaming serverless endpoint. No fake conversations, no placeholder replies, no
"coming soon" buttons — every control in the interface does something.

---

## What it is

A single-page chat app (plain HTML, CSS and JavaScript — no framework, no build
step) that talks to **one** backend endpoint, `POST /api/chat`, which calls an AI
provider and streams the answer back token by token.

```text
Browser  →  /api/chat (serverless, holds the API key)  →  AI provider (Gemini)
```

The provider key never reaches the browser. Conversations are stored on the
device, so GeeAI works without accounts, databases or sign-in.

## Features

**Chat**
- Real streaming responses — text appears as it is generated, with a
  "GeeAI is thinking…" state before the first token
- **Stop** generation at any time (the upstream request is aborted, not just hidden)
- **Regenerate** the latest answer without losing the conversation
- **Edit** any previous message and resend it from that point
- **Copy** any answer, or any code block, with a confirmation state
- Markdown rendering: headings, lists, tables, quotes, links, inline code and
  fenced code blocks with language labels — sanitized, never `innerHTML`

**Conversations**
- Conversations persist across refreshes (localStorage, no account needed)
- Automatic titles derived from your first message
  (`"Explain subnetting to me"` → **Subnetting**), renameable
- Search across titles and message content
- Delete individual conversations, or clear everything from Settings
- Strict isolation: every conversation owns its own message list — Chat B can
  never inherit Chat A's messages

**Interface**
- DeepSeek-inspired focus on the conversation: quiet surfaces, one accent, no
  gradients or glassmorphism
- Light / dark / system themes, persisted and applied before first paint (no flash)
- Off-canvas sidebar on mobile, keyboard shortcuts, visible focus states,
  `aria-live` status announcements
- Responsive from 320px to 1440px+; code blocks scroll instead of breaking layout

**Backend**
- Provider-agnostic (`AI_PROVIDER`), Google Gemini by default
- Server-side validation: payload size, message count, roles, model allowlist
- Best-effort per-IP rate limiting and upstream timeouts
- Safe, structured errors — provider details are logged server-side, never returned

## Architecture

```text
index.html            app shell (semantic markup + inline icon sprite)
style.css             design tokens + component styles (see DESIGN.md)
js/
  main.js             app controller: state, wiring, streaming lifecycle
  api.js              /api/chat streaming client (SSE)
  store.js            conversation persistence, validation, titles
  markdown.js         safe Markdown parser + DOM renderer
  messages.js         message rendering, actions, inline editor
  sidebar.js          conversation list, search, rename, delete
  theme.js            light / dark / system
  toast.js            transient notifications
  dom.js, utils.js    element helpers, ids, time formatting, clipboard
api/
  chat.js             POST /api/chat — validate → provider → SSE stream
  info.js             GET /api/info  — public provider/model metadata
  _lib/
    config.js         environment-driven configuration and limits
    validate.js       request validation
    errors.js         safe, structured error codes
    sse.js            SSE helpers + upstream frame parser
    ratelimit.js      sliding-window abuse protection
    prompt.js         GeeAI system instruction (server-side)
    providers/
      index.js        provider registry
      gemini.js       Google Gemini streaming provider
      echo.js         development self-test provider (opt-in)
scripts/
  dev-server.js       zero-dependency local server (static + /api)
```

### Request flow

1. `POST /api/chat` with `{ conversationId, messages, model }`.
2. Rate limit → body size → JSON → schema validation (roles, sizes, model allowlist).
3. Provider check: is a key configured? If not → `503 provider_not_configured`.
4. Stream: `meta` → `delta` frames → `done` (or a single `error` frame).
5. The client renders deltas on animation frames, keeping the UI responsive.

Both sides speak the same small SSE protocol:

```text
data: {"type":"meta","provider":"gemini","model":"gemini-2.5-flash","conversationId":"c_ab12"}
data: {"type":"delta","text":"Subnetting splits…"}
data: {"type":"done","finishReason":"stop"}
```

## Tech stack

HTML · CSS (custom properties, no framework) · ES modules (no bundler) ·
Node.js serverless functions on Vercel · Google Gemini API · Inter + JetBrains Mono

Zero runtime dependencies.

## Local development

```bash
npm run dev          # http://localhost:3000
```

`scripts/dev-server.js` serves the static frontend and routes `/api/*` to the
same handler modules Vercel uses, so streaming behaves identically locally.
No dependencies to install.

## Environment variables

Copy `.env.example` to `.env` (git-ignored). All variables are **server-side** —
nothing below is ever exposed to the browser.

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | no | `gemini` | Which provider `/api/chat` uses (`gemini`, `echo`) |
| `GEMINI_API_KEY` | yes, with Gemini | — | Key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` | Default model (must be in the allowlist) |
| `GEMINI_MODELS` | no | see `.env.example` | Comma-separated allowlist of requestable models |
| `GEMINI_API_BASE_URL` | no | `https://generativelanguage.googleapis.com/v1beta` | Override for proxies/local testing |
| `AI_REQUEST_TIMEOUT_MS` | no | `55000` | Upstream timeout |
| `AI_RATE_LIMIT_PER_MINUTE` | no | `30` | Per-IP request budget (per instance) |

Without a key, `/api/chat` returns `503` and the UI says
**"GeeAI is not connected to an AI provider yet."** — no pretending, no fake replies.

`AI_PROVIDER=echo` enables the development self-test provider: a scripted
streaming reply used to verify streaming, cancellation and rendering without an
API key. It is opt-in and is never an AI model.

## Deploying to Vercel

1. Import the repository in Vercel (zero configuration is required — the static
   frontend and `api/` functions are detected automatically), or run `vercel --prod`.
2. In **Settings → Environment Variables**, add `GEMINI_API_KEY` (and optionally
   `GEMINI_MODEL`).
3. Redeploy so the new variables take effect.

`vercel.json` sets security headers and function durations; `maxDuration` for
`/api/chat` is 60s to allow long streaming replies.

## Security notes

- **The API key is server-only.** It is read from `process.env` inside `api/` and
  used exclusively in the upstream request. `/api/info` exposes only the provider
  name, model list and whether a key is configured.
- **No `innerHTML` for content.** Markdown is parsed into DOM nodes; all text is
  set with `textContent`, and link URLs are restricted to `http(s)` and `mailto`.
- **Validation before the provider.** Request body size, message count, message
  size, roles, and a server-side model allowlist. Unknown models are rejected.
- **Safe errors.** Users see short, human messages; raw provider bodies, stack
  traces and paths are logged server-side only.
- **No CORS headers** are emitted, so the endpoint is not readable by other origins.
- **Rate limiting** is best-effort and per-instance (serverless has no shared
  memory). For hard quotas, put a gateway or WAF in front of the deployment.
- Conversations live in `localStorage` — private to the browser profile, never
  sent to the server except as the prompt context for a reply.

## Data model

```text
conversation = { id, title, createdAt, updatedAt, messages[] }
message      = { id, role: 'user' | 'assistant', content, timestamp, error? }
```

Stored under `geeai.conversations.v1` (plus `geeai.settings.v1` for theme and
model). Storage is validated on load and capped at 200 conversations.

## Roadmap

- [ ] Multi-provider switching from the UI (OpenAI-compatible, Anthropic)
- [ ] Optional cloud sync / accounts behind a flag
- [ ] Export and import conversations (JSON / Markdown)
- [ ] Attachments and image input
- [ ] Server-side usage dashboard

## Design system

See [`DESIGN.md`](./DESIGN.md) for tokens, component contracts, responsive rules
and the guardrails that keep the UI consistent as GeeAI grows.
