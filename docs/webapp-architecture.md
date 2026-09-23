# Web App Architecture — Gamma-style Generator

[English](./webapp-architecture.md)

---

> Status: **draft for review**. This document proposes the architecture for a new, self-service web application layered on top of this repository. It does not touch or replace the existing agent-driven skill package. Nothing here is implemented yet — this is the plan to validate before any code is written.

## 1. Goal

Build a small web product, in the spirit of Gamma, where a person:

1. Uploads a structured Markdown brief (produced beforehand with ChatGPT/Claude).
2. Gets a fast first draft — text only, laid out with image placeholders — with **no image generation yet**.
3. Reviews and edits slide-by-slide: approve, edit text, or change the layout/placeholder arrangement.
4. Once text + layout are locked, reviews AI image prompts (auto-built from the brief + a chosen visual style) and triggers generation via the OpenAI Images API.
5. Gets a consolidated preview and exports to **PPTX**, **PDF**, or keeps it as an animated **HTML** deck.
6. If exporting to PPTX or keeping HTML, adds transitions/animations as a last step.

The visual bar: it must look hand-designed (varied image/text layouts, not a templated LLM look), while staying easy to produce at scale.

## 2. Relationship to `skills/ppt-master`

Decision: **coexistence**, not migration.

- `skills/ppt-master/` stays exactly as-is: the agent-driven, Claude-Code-operated workflow (SKILL.md, workflows, Python scripts) remains available as its own product surface.
- The new web app lives in a new top-level directory, e.g. **`app/`**, with its own frontend, Netlify Functions, and configuration. It does not import Python scripts from `skills/ppt-master/scripts/` and does not depend on the SKILL.md-driven execution model.
- Shared, static assets only (icon library, brand/template art, extracted logos) may be reused by reference — copied or symlinked into `app/` assets, never by having the web app shell out to the Python pipeline.
- `AGENTS.md` / `CLAUDE.md` routing rules keep governing `skills/ppt-master`; they say nothing about `app/`, and `app/` gets its own lightweight `README.md` once scaffolded.

This keeps the two products decoupled: changes to one don't risk breaking the other, and each can evolve on its own release cadence.

## 3. Stack decision

Decision: **100% Netlify, pipeline rewritten in JS/TS.** No separate always-on backend server; no dependency on the existing Python scripts.

| Layer | Choice |
|---|---|
| Hosting | Netlify (static site + Functions) |
| Frontend | Plain HTML/CSS + TypeScript (Vite-bundled), no heavy SPA framework to start | 
| Backend | Netlify Functions (Node/TypeScript) |
| Long-running steps (image gen batches, HTML→image/PDF rendering) | Netlify **Background Functions** (async, longer execution budget than synchronous functions) |
| State/storage | **Netlify Blobs** (project JSON, uploaded MD, generated images, exported files) — no external DB |
| Text AI | OpenAI Chat/Responses API |
| Image AI | OpenAI Images API (`gpt-image-1`) |
| PPTX generation | `pptxgenjs` (pure JS, runs fine in a Netlify Function) |
| HTML→image/PDF rendering | `puppeteer-core` + `@sparticuz/chromium` (serverless-compatible Chromium build) |

### Why plain HTML/TS for the frontend

The wizard is a handful of screens with mostly server-driven state (project JSON lives in Netlify Blobs, not in complex client state). A framework can be introduced later if the editor UI grows real complexity (e.g. drag-and-drop layout editing); starting lean avoids premature build tooling.

### Flagging one real risk, transparently

The original Python pipeline (`pptx_to_svg.py` / `svg_to_pptx.py`) exists because converting a rich, freely laid-out visual design into a **natively editable** PPTX (real text boxes, real shapes, real DrawingML) is genuinely hard — that's most of what `skills/ppt-master` does. A pure-JS rewrite of that fidelity is a large undertaking on its own.

Given the "100% JS" decision, the pragmatic path for v1 is a **hybrid PPTX**, not a full DrawingML re-implementation:

- Each slide is authored/edited as HTML (already the plan for steps 1–2).
- At export time, the slide's **background** (image + decorative layout) is rasterized once via headless Chromium and placed as a full-bleed picture on the PPTX slide (`pptxgenjs` `addImage`).
- **Text stays native**: title/body text boxes are added on top as real `pptxgenjs` text objects, positioned to match the HTML layout — so text remains editable/searchable in PowerPoint, which is the part users actually need to edit after export.
- This trades "fully native shapes" for "shippable in JS on Netlify" while keeping the one thing that matters most (text editability) native.

This should be validated against a couple of your real example decks once shared (see §8) — if the look requires native shape editing beyond text (e.g. editable icons/charts), we may need to revisit this trade-off for specific layouts only.

PDF export is simpler: render the final HTML deck with headless Chromium and print-to-PDF per slide, concatenated.

HTML-with-animations export is simplest: it ships the same HTML/CSS the wizard already built, plus a small transitions/animation layer (CSS transitions + a tiny JS controller for step-by-step reveals), no conversion needed.

## 4. Repo layout (new)

```
app/
  README.md                    # app-specific setup/dev notes
  netlify.toml
  package.json
  src/
    pages/                     # landing, wizard steps (static HTML or templated)
    editor/                    # slide-by-slide review UI (step 2), prompt/style UI (step 3), consolidated preview
    styles/
    lib/                       # shared TS: project schema, layout presets, style presets
  netlify/
    functions/
      parse-brief.ts           # MD -> structured project JSON (OpenAI text)
      restructure-text.ts      # optional LLM rewrite pass
      generate-images.ts       # OpenAI Images API calls (background function)
      render-preview.ts        # HTML -> image/PDF via headless Chromium (background function)
      export-pptx.ts           # pptxgenjs hybrid export
      export-pdf.ts
      project-state.ts         # CRUD over Netlify Blobs
  assets/
    logos/                     # extracted, reusable logos (pending source files)
    image-styles/              # style preset definitions (prompt suffixes, references)
```

## 5. Data model (draft)

```ts
type Project = {
  id: string;
  title: string;
  createdAt: string;
  status: "draft" | "layout_review" | "prompt_review" | "images_ready" | "exported";
  slides: Slide[];
};

type Slide = {
  id: string;
  order: number;
  spokenText: string;       // what's said aloud, from the MD brief
  onScreenText: {           // what's displayed
    title?: string;
    body?: string[];
  };
  layout: LayoutId;         // e.g. "full-bleed-image-text-overlay", "image-half-right", "text-only", ...
  image?: {
    placeholderPrompt: string;  // author-provided prompt from the MD, before qualifiers
    finalPrompt?: string;       // placeholderPrompt + style preset qualifiers, editable
    styleId?: string;           // e.g. "bd-largo-winch", "manga-solo-leveling-bw"
    generatedAssetId?: string;  // Netlify Blobs key once generated
  };
  approved: boolean;         // per-slide gate for step 2
};

type ImageStylePreset = {
  id: string;
  label: string;             // "BD franco-belge (Largo Winch)"
  promptSuffix: string;      // appended qualifiers: medium, line/color treatment, tone
  size: string;
  referenceImages?: string[]; // optional few-shot references
};
```

## 6. Pipeline stages → routes

| Step | User spec | Route / Function |
|---|---|---|
| 0 | Upload MD | `POST /parse-brief` → OpenAI splits spoken vs. on-screen text, proposes layout per slide → `Project` (status `draft`) |
| 1 | Text-only draft, placeholders, no images | Wizard step 1 renders `Project.slides` with placeholder boxes; user can trigger an LLM rewrite pass (`restructure-text`) |
| 2 | Slide-by-slide review | Wizard step 2: approve / edit text / change layout per slide, sets `approved` flags, status → `layout_review` |
| 3 | Prompt + style review | Wizard step 3 shows `finalPrompt` (auto = `placeholderPrompt` + style qualifiers), lets user edit prompt and pick `styleId` per slide or globally, status → `prompt_review` |
| 4 | Generate images | `POST /generate-images` (background function) calls OpenAI Images API per approved slide → status `images_ready` |
| 5 | Consolidated preview | Read-only HTML render of the full deck |
| 6a | Export PPTX | `POST /export-pptx` (hybrid render, §3) |
| 6b | Export PDF | `POST /export-pdf` |
| 7a | PPTX transitions/animations | Small post-export step: transition/animation metadata written into the pptxgenjs build before final export |
| 7b | Keep as HTML + animations | Wizard step adds CSS transitions/reveal timing, ships static HTML bundle |

## 7. Image style presets

A small, extensible catalog, each entry defining prompt qualifiers (medium, line/ink treatment, color palette, tone, panel-style cues) layered on top of the author's raw prompt from the brief. Examples to seed the catalog once confirmed: *"BD franco-belge, style Largo Winch"*, *"Manga couleur façon Solo Leveling, sans éléments fantastiques"*. Stored as data (`assets/image-styles/*.json`), not hardcoded logic, so adding a style is a config change.

## 8. Pending inputs (blocking full validation of this plan)

Not yet received in this conversation — needed to validate layout presets, the image-style catalog, and the logo extraction task:

- The example Markdown brief.
- A few example decks showing the desired layouts (full-bleed image + readable overlay text, partial-image layouts, etc.).
- The intro slide image containing the logos to extract into `app/assets/logos/`.

## 9. Suggested milestones

1. Scaffold `app/` (Netlify site + Functions skeleton, `Project`/`Slide` types, Netlify Blobs wiring) — no AI calls yet, fake data.
2. Step 0–1: MD upload → parse → text-only placeholder draft, real OpenAI text call.
3. Step 2: slide-by-slide review UI.
4. Step 3–4: prompt/style review + real OpenAI image generation.
5. Step 5–6: consolidated preview + PPTX/PDF export (validate the hybrid-PPTX approach from §3 against a real example deck).
6. Step 7: animations/transitions, both PPTX and HTML paths.

Each milestone should be reviewable end-to-end before starting the next one.

## 10. Open questions for you

- Any existing brand constraints (fonts, colors) that should be baked into the layout presets from day one, or do we derive them from the example decks once shared?
- Expected scale (decks/month, slides/deck) — mostly relevant for OpenAI cost/rate-limit planning, not architecture-blocking.
