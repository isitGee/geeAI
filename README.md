# GeeAI

**Your AI. Your workspace.**

A personal AI chat application — a ChatGPT-style interface with its own visual identity, backed by a real AI model through a lightweight serverless backend.

**Live:** [geeai-isitgee.vercel.app](https://geeai-isitgee.vercel.app)

---

## What it is

GeeAI is a small, from-scratch AI chat app: a static frontend (plain HTML, CSS, and JavaScript — no framework) talking to a single Node.js serverless function, which calls the Anthropic API. No database, no auth, no build step.

It supports:

- A full chat UI — message thread, typing indicator, auto-growing composer, new chat / conversation history sidebar
- A live AI backend (Google Gemini 2.5 Flash — free, no credit card), with a graceful fallback message if no API key is configured yet
- A responsive layout, including an off-canvas sidebar on mobile
- A design system based on Vercel's own visual language: black-and-white precision, Geist typography, a single blue accent reserved for focus states and links

See [`about.html`](./about.html) for a fuller write-up of the architecture and design decisions, or open it directly at `/about.html` once deployed.

## Project structure

```text
GeeAI/
├── index.html          the app shell
├── style.css            design tokens + layout
├── script.js            chat logic, DOM handling, backend calls
├── api/
│   └── chat.js           serverless function → Google Gemini API
├── assets/
├── about.html            project write-up
├── .env.example          required environment variable
└── package.json
```

## Running it locally

The frontend needs no build step — open `index.html` directly, or serve it with any static server:

```bash
npx serve .
```

The `/api/chat` endpoint only runs in a Vercel-compatible environment. To test it locally with the [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm install -g vercel
vercel dev
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes, for real replies | Get a **free** key (no credit card) at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it, `/api/chat` still responds, but with a message explaining it isn't configured yet. |

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

## Deploying

This repo deploys to [Vercel](https://vercel.com) with zero configuration — it auto-detects the static frontend and the `api/` serverless function.

1. Push this repo to GitHub and import it in Vercel, **or** run `vercel --prod` from the CLI
2. In the Vercel project's **Settings → Environment Variables**, add `GEMINI_API_KEY`
3. Redeploy so the new environment variable takes effect

## Roadmap

- [ ] Persist conversation history across reloads
- [ ] Stream responses instead of waiting for the full reply
- [ ] Real accounts, so the sidebar's "Recent" list reflects actual past conversations

## Tech stack

Plain HTML/CSS/JS · Node.js serverless function · Google Gemini API (Gemini 2.5 Flash) · Vercel · Geist / Geist Mono
