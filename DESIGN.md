# DESIGN.md — GeeAI Design System

> GeeAI is an AI **application**, not a landing page.
> The interface exists to make long, technical conversations readable and fast.
> When a design decision is unclear: **consistency beats decoration.**

This document is the visual source of truth. Every UI change should start here:
read it, find the affected component, reuse the existing tokens, and update this
file if you introduce a genuinely new rule.

Design methodology inspired by [awesome-design-md](https://github.com/VoltAgent/awesome-design-md):
tokens instead of magic values, component contracts instead of vibes, and
explicit guardrails instead of taste arguments.

---

## 1. Visual Theme & Atmosphere

**Quiet confidence.** GeeAI should feel like software built by a product team:
calm, precise, a little technical, never decorated for its own sake.

| Principle | Meaning in practice |
|---|---|
| Conversation first | The message column is the hero. Chrome recedes. |
| Restraint | One accent colour, used deliberately. No gradients, no glow, no glass. |
| Technical warmth | Monospace for code and identifiers, humanist sans for prose. |
| Calm surfaces | Hierarchy comes from borders, spacing and type — not shadows. |
| Speed | Animations are 120–180 ms and communicate state, nothing more. |

**Explicitly not this:** floating Material cards, bouncing UI, parallax, animated
backgrounds, emoji as icons, giant marketing type inside the chat, Web3 blur.

---

## 2. Color Palette & Roles

Colours are semantic **roles**, never raw hex values in components.
Defined once in `style.css` under `:root` (light) and `[data-theme='dark']`.

### Token map

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--color-canvas` | `#F7F8FA` | `#0B0D10` | App canvas, sidebar background |
| `--color-surface` | `#FFFFFF` | `#111418` | Conversation area, composer, inputs |
| `--color-surface-elevated` | `#FFFFFF` | `#171B21` | Dialogs, user bubble (dark), hover fills |
| `--color-surface-hover` | `#F1F3F5` | `#191E25` | Hover states, table headers |
| `--color-surface-active` | `#E8EBEF` | `#20262F` | Pressed / disabled send |
| `--color-user-bubble` | `#F0F2F5` | `#171B21` | User message container |
| `--color-code-surface` | `#F6F7F9` | `#0E1216` | Code block body, inline code |
| `--color-text` | `#17181A` | `#F3F4F6` | Primary text |
| `--color-text-secondary` | `#4B5563` | `#A1A7B0` | Subtitles, secondary labels |
| `--color-text-muted` | `#6B7280` | `#808894` | Hints, timestamps, placeholders |
| `--color-border` | `#E5E7EB` | `#252A32` | Default borders, code blocks |
| `--color-border-subtle` | `#EEF0F2` | `#1B2027` | Dividers, sidebar/topbar edges |
| `--color-border-strong` | `#D5D9DE` | `#333A44` | Composer outline, inputs |
| `--color-primary` | `#2563EB` | `#4F8CFF` | Primary action, active item, links |
| `--color-primary-hover` | `#1D4ED8` | `#6A9DFF` | Primary hover |
| `--color-primary-soft` | `rgba(37,99,235,.09)` | `rgba(79,140,255,.14)` | Active conversation background |
| `--color-danger` | `#DC2626` | `#F87171` | Destructive action, error text |
| `--color-success` | `#16A34A` | `#4ADE80` | Copy confirmation |

### Rules

* Primary blue means **action, selection, or link** — nothing else. The interface
  is never "blue themed".
* Status colours (`danger`, `success`) appear only on real state, never as decoration.
* Both themes are first-class. A new component ships with both.

---

## 3. Typography Rules

```text
--font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

| Role | Token | Size / weight |
|---|---|---|
| Empty-state headline | `--fs-display` | 30px / 600 |
| Dialog title, section heading | `--fs-subtitle` | 18px / 600 |
| Body (messages, composer) | `--fs-body` | 15px / 400, line-height 1.75 |
| Secondary body | `--fs-body-lg` | 16px / 400 |
| UI labels, buttons | — | 14px / 500 |
| Sidebar items, hints | `--fs-small` | 13px / 400 |
| Captions, timestamps, model badge | `--fs-caption` | 12px / 400–500 |
| Code | `--fs-code` | 13.5px / mono, line-height 1.65 |

* Weight establishes hierarchy gradually: 400 → 500 → 600. Nothing is 800.
* Only one display-size headline in the product (the empty state).
* Monospace is reserved for code, model ids and keyboard keys.

---

## 4. Component Contracts

### Primary Button
* Height 36px, padding `0 16px`, radius `--radius-md` (8px).
* Background `--color-primary`, text `--color-text-inverted`.
* Hover `--color-primary-hover`; disabled: 55% opacity + `not-allowed`.
* Focus: 2px `--color-primary` outline, 2px offset.

### Secondary Button
* Transparent background, `--color-border` border, `--color-text` label.
* Hover: `--color-surface-hover`.

### Danger Button
* Transparent background, `--color-border` border, `--color-danger` label.
* Hover: `--color-danger-soft` fill, `--color-danger-hover` label.
* Destructive actions require a two-step confirm (the label changes to
  "Click again to confirm" and reverts after 4s).

### Icon Button
* 32×32 (26×26 inside conversation rows), radius `--radius-sm` (6px).
* Colour `--color-text-muted` → `--color-text` on hover with `--color-surface-hover`.
* Always carries `aria-label`; decorative `<svg>` is `aria-hidden`.

### Chat Composer
* Container: `--color-surface`, 1px `--color-border-strong`, radius `--radius-xl`
  (16px; 12px on mobile), max width 768px, centred.
* Focus-within: border `--color-primary` + 3px `--color-primary-ring`.
* Textarea: auto-grows from one line to `--composer-max-height` (200px), then
  scrolls. Enter sends, Shift+Enter adds a line.
* Send button 34×34, radius `--radius-md`, primary fill; disabled when empty.
* While generating, Send is replaced by **Stop** (dark fill, square glyph).
* Hint text below is 12px `--color-text-muted`, centred.
* Bottom padding respects `env(safe-area-inset-bottom)`.

### Model Switcher (topbar)
* A native `<select>` styled as a pill: height 26px (28px on mobile), radius
  `--radius-pill`, 1px `--color-border`, `--color-surface` background,
  `--font-mono` at `--fs-caption`, `--color-text-secondary` label.
* Trailing chevron (13px) is absolutely positioned and `pointer-events: none`.
* Hover: `--color-border-strong` + `--color-text`. Disabled: `--color-text-muted`
  (used when no provider key is configured, or provider info failed to load).
* Options come from `/api/info`; the selected value is persisted and used for
  the next request. Server-side allowlist is authoritative.
* Mobile: remains visible, capped at 46% of the topbar width; the conversation
  title truncates around it.

### Model Switcher (topbar)
* A native `<select>` styled as a pill: height 26px (28px on mobile), radius
  `--radius-pill`, 1px `--color-border`, `--color-surface` background,
  `--font-mono` at `--fs-caption`, `--color-text-secondary` label.
* Trailing chevron (13px) is absolutely positioned and `pointer-events: none`.
* Hover: `--color-border-strong` + `--color-text`. Disabled: `--color-text-muted`
  — used when no provider key is configured, or provider info failed to load.
* Options come from `/api/info`; the selection is persisted and used for the
  next request. The server re-validates it against its own allowlist.
* Mobile: stays visible, capped at 46% of the topbar width; the conversation
  title truncates around it.

### Sidebar
* Width 268px (244px under 1024px); background `--color-canvas`;
  1px `--color-border-subtle` right border.
* Sections: brand + New chat + search → scrollable history → footer (Settings + note).
* On mobile: fixed off-canvas drawer, translateX transition 180ms, backdrop
  `--color-overlay`, closes on Escape, backdrop click, selection, or resize.

### Conversation Item
* 34–36px row, radius `--radius-md`, 13px `--color-text-secondary`, single line
  with ellipsis.
* Hover: `--color-surface-hover` + `--color-text`.
* Active: `--color-primary-soft` background, `--color-primary` text, weight 500.
* Rename (pencil) and Delete (trash) icon buttons appear on hover/focus and are
  always visible on touch devices (`@media (hover: none)`).

### User Message
* Right aligned, max-width 85% (100% on mobile).
* Background `--color-user-bubble`, 1px `--color-border-subtle`, radius `--radius-lg`.
* Plain text, `white-space: pre-wrap`, `overflow-wrap: anywhere`.
* Action: **Edit** (pencil) — opens an inline textarea with Save & resend / Cancel.

### Assistant Message
* 28px avatar column (mark chip) + content column. No bubble, no card.
* Markdown rendered at `--fs-body` / 1.75 with generous vertical rhythm.
* Actions (visible on hover, focus, and always on touch): **Copy**, **Regenerate**.
* Streaming: blinking 2px `--color-primary` caret appended to the live text.
* Waiting for the first token: three animated dots + "GeeAI is thinking…".

### Code Block
```text
┌───────────────────────────────────────┐
│ Bash                             Copy │  ← --color-text-muted, chip button
├───────────────────────────────────────┤
│ ipcalc 192.168.10.0/24                │  ← mono 13.5px, scrolls horizontally
└───────────────────────────────────────┘
```
* Container: 1px `--color-border`, radius `--radius-lg`, `--color-code-surface`.
* Header bar separated by `--color-border-subtle`.
* `pre` scrolls horizontally; `overflow-x: auto` prevents page-level overflow.
* Copy flashes "Copied" with a check icon for 1.6s — no alerts.

### Modal (native `<dialog>`)
* Width `min(440px, 100vw - 24px)`, panel radius `--radius-xl`, `--color-surface-elevated`,
  1px border, `--shadow-lg`.
* `::backdrop` uses `--color-overlay`.
* Close: X button, Escape, or clicking the backdrop area.
* Focus moves to the close button on open.

### Dropdown / Select
* Height 36px, radius `--radius-md`, `--color-border-strong` border, `--color-surface`.
* Disabled state uses `--color-text-muted` + `not-allowed`.

### Toast
* Pill, `--color-surface-elevated`, `--color-border`, `--shadow-md`, bottom-centre.
* 12px text, auto-dismiss ~2.6s, `role="status"`, never used for errors that are
  already inline.

### Loading State
* Typing: three 6px dots, opacity/translate loop, 1.2s.
* Streaming: caret. Send button → Stop button.
* Reduced motion: all animations collapse to ~0ms.

### Empty State
* Centred, max-width ~44ch subtitle, 52px mark chip.
* Four prompt starters (real prompts, not fake conversations) in a 2-column grid
  (1 column on mobile). Clicking sends immediately.

### Error State
* Assistant row with `--color-danger-soft` background, alert icon, plain-language
  message, and **Try again**.
* Never renders stack traces, provider bodies or paths.

---

## 5. Layout Principles

* Shell: `flex` row → sidebar + main column; main is `flex` column →
  topbar / scroll area / composer.
* Content column: `max-width: 768px`, centred, padding `24px 20px 40px`
  (`16px 16px 32px` on mobile).
* Spacing scale (4px): `4, 8, 12, 16, 20, 24, 32, 40, 48, 64` — exposed as
  `--space-1 … --space-16`. No 13px/17px/23px gaps.
* Vertical rhythm between messages: 24px (20px on mobile).
* Radii: 4 / 6 / 8 / 12 / 16 / 999. Pick the nearest; don't invent new ones.
* The page never scrolls horizontally — only `code` blocks and the message list do.

---

## 6. Depth & Elevation

| Level | Treatment | Used by |
|---|---|---|
| 0 | Flat canvas | App background, conversation area |
| 1 | 1px `--color-border-subtle` | Dividers, user bubble edge |
| 2 | Surface + border + `--shadow-sm` | Composer focus, empty-state mark |
| 3 | Elevated surface + `--shadow-lg` | Dialogs, mobile drawer |

No stacked shadows, no coloured glows, no blur layers.

---

## 7. Do's and Don'ts

**Do**
- Use tokens for every colour, space, radius and duration.
- Keep the conversation centred and readable.
- Design for long answers and wide code blocks.
- Give every interactive element hover, active, focus, disabled and loading states.
- Test desktop, tablet, mobile, light and dark before calling a change done.
- Update this file when you add a new reusable pattern.

**Don't**
- Don't copy ChatGPT, Claude or DeepSeek pixel-for-pixel.
- Don't hardcode hex values in components.
- Don't use emoji as icons.
- Don't turn every element into a card.
- Don't add gradients, glassmorphism, glows or background animation.
- Don't use giant shadows or oversized radii.
- Don't invent a new component when an existing one can be extended.
- Don't ship a visual state that isn't implemented.

---

## 8. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| **< 768px** | Sidebar becomes off-canvas drawer with backdrop. Topbar shows the menu and the model switcher (capped at 46% width). Content padding 16px. Suggestions single column. User bubble full width. Composer radius 12px, safe-area padding. |
| **768–1023px** | Sidebar fixed at 244px. Content column up to 860px. Message spacing reduced slightly. Everything else as desktop. |
| **≥ 1024px** | Full 268px sidebar, 768px centred conversation column, generous whitespace, keyboard-first. |
| **≥ 1440px** | Layout identical to desktop — the conversation column never stretches beyond 768px. |

Touch targets stay ≥ 32px; primary actions ≥ 34px.

---

## 9. Agent Prompt Guide

When changing the UI:

1. Read this file.
2. Identify the affected component (or add one here first).
3. Reuse existing tokens — never add a magic value.
4. Change **one component at a time**.
5. Verify: desktop, mobile, light, dark, hover, active, disabled, focus, loading, error.
6. If you introduced a reusable rule, document it in section 4.
7. Never introduce a duplicate token for an existing role.

Quick reference — the five questions every UI change must answer:

* Which token does each colour come from?
* What does it look like on a 320px screen?
* What does it look like in dark mode?
* What is the keyboard/focus story?
* What happens while data is loading or the request fails?
