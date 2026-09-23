# app/ — web generator (milestone 1)

Self-service web app described in [`docs/webapp-architecture.md`](../docs/webapp-architecture.md). Lives alongside — and does not depend on — `skills/ppt-master/`.

## What's implemented (milestone 1)

- Deterministic Markdown parser (`src/lib/parse-brief.ts`): brief → `Project`/`Slide`, no LLM call. Matches the schema confirmed against `fixtures/example-brief.md` (`# Slide N — Title` / `## Texto en pantalla` / `## Texto oral` / `## Visual impactante`, plus the deck preamble and trailing timing/principles sections).
- Netlify Functions: `parse-brief` (upload → parse → store), `project-state` (read/update a stored project).
- Storage: Netlify Blobs (`projects` store) — no external DB.
- Frontend: upload page (`index.html`) → step-1 draft page (`wizard.html`) rendering each slide's on-screen text, spoken text (collapsed), and an image placeholder box showing the prompt that will later be sent to OpenAI — laid out per the slide's `LayoutId` (full-bleed / half-left / half-right / text-only).

Not implemented yet (later milestones): the OpenAI text rewrite pass, step 2's actual edit UI (only an approve checkbox exists so far), style/prompt review, image generation, exports.

## Local development

```bash
npm install
npm run test:parse   # sanity-checks the parser against fixtures/example-brief.md
netlify dev           # serves the Vite frontend + Netlify Functions together, incl. local Blobs
```

`netlify dev` (from `npx netlify-cli` or a global install) is what wires `/api/*` to the functions and proxies the Vite dev server — running `npm run dev` alone will not serve the functions. When creating the actual Netlify site, set its **base directory** to `app/` so it picks up `app/netlify.toml`.

No environment variables are required yet — OpenAI keys land in milestone 2.

## Layout presets

`src/lib/layout-presets.ts` covers the 4 `LayoutId` values the parser can currently produce. `assets/layout-presets/title-wave-split.json` is reference data reverse-engineered from a real intro slide (see `docs/webapp-architecture.md` §8.2) for a future dedicated title-slide preset — not wired into rendering yet.
