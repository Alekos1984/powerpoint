import { buildFinalPrompt, IMAGE_STYLES } from "../../lib/image-styles.js";
import type { Project, Slide } from "../../lib/types.js";
import { autosizeTextarea } from "./autosize.js";
import { buildSlideCard } from "./slide-card.js";

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

const titleEl = document.querySelector<HTMLHeadingElement>("#project-title")!;
const metaEl = document.querySelector<HTMLParagraphElement>("#project-meta")!;
const positionEl = document.querySelector<HTMLParagraphElement>("#slide-position")!;
const viewportEl = document.querySelector<HTMLElement>("#slide-viewport")!;
const railEl = document.querySelector<HTMLElement>("#review-rail")!;
const navEl = document.querySelector<HTMLElement>("#slide-nav")!;
const backLink = document.querySelector<HTMLAnchorElement>("#back-link")!;
const globalStyleSelect = document.querySelector<HTMLSelectElement>("#global-style-select")!;
const applyGlobalStyleBtn = document.querySelector<HTMLButtonElement>("#apply-global-style")!;
const generateAllBtn = document.querySelector<HTMLButtonElement>("#generate-all")!;
const progressEl = document.querySelector<HTMLSpanElement>("#generation-progress")!;

let project: Project;
let currentIndex = 0;
let pollHandle: number | undefined;
/** Client-side only — "a request for this slide is in flight", so the UI reacts the instant a button is clicked instead of waiting for the next poll tick. */
const generatingOrders = new Set<number>();

async function persist() {
  await fetch(`/api/project-state?id=${project.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
}

function goTo(index: number) {
  currentIndex = Math.max(0, Math.min(project.slides.length - 1, index));
  const url = new URL(window.location.href);
  url.searchParams.set("slide", String(project.slides[currentIndex].order));
  window.history.replaceState({}, "", url);
  renderSlide();
  renderRail();
  renderNav();
}

function currentPromptFor(slide: Slide): string {
  if (!slide.image) return "";
  return slide.image.finalPrompt ?? buildFinalPrompt(slide.image.placeholderPrompt, slide.image.styleId);
}

function assetUrl(slide: Slide): string | undefined {
  if (!slide.image?.generatedAssetId) return undefined;
  // The blob key is stable across a regeneration (same slide, same key) — without a
  // cache-busting param the browser's "immutable" cached copy of the *old* image wins
  // and a regenerated image silently never shows up.
  const version = slide.image.generatedAt ? `&v=${encodeURIComponent(slide.image.generatedAt)}` : "";
  return `/api/asset?key=${encodeURIComponent(slide.image.generatedAssetId)}${version}`;
}

function historyThumbUrl(entry: { assetId: string; generatedAt: string }): string {
  return `/api/asset?key=${encodeURIComponent(entry.assetId)}&v=${encodeURIComponent(entry.generatedAt)}`;
}

function buildHistoryStrip(slide: Slide): HTMLElement | null {
  const history = slide.image?.history;
  if (!history || history.length < 2) return null; // nothing to pick between with 0-1 attempts

  const strip = document.createElement("div");
  strip.className = "history-strip";
  for (const entry of [...history].reverse()) {
    // newest first
    const thumb = document.createElement("button");
    thumb.className = `history-thumb ${entry.assetId === slide.image!.generatedAssetId ? "active" : ""}`;
    thumb.title = new Date(entry.generatedAt).toLocaleString();
    const img = document.createElement("img");
    img.src = historyThumbUrl(entry);
    img.alt = "";
    thumb.appendChild(img);
    thumb.addEventListener("click", async () => {
      slide.image!.generatedAssetId = entry.assetId;
      slide.image!.generatedAt = entry.generatedAt;
      await persist();
      renderSlide();
    });
    strip.appendChild(thumb);
  }
  return strip;
}

function renderSlide() {
  const slide = project.slides[currentIndex];
  viewportEl.innerHTML = "";
  viewportEl.appendChild(
    buildSlideCard(slide, {
      promptOverride: currentPromptFor(slide),
      promptTag: "Prompt final",
      generatedImageUrl: assetUrl(slide),
      generationError: slide.image?.generationError,
    }),
  );
  const historyStrip = buildHistoryStrip(slide);
  if (historyStrip) viewportEl.appendChild(historyStrip);
  positionEl.textContent = `Slide ${currentIndex + 1} / ${project.slides.length}`;
}

async function triggerGeneration(order?: number, force = false) {
  const targets = order ? [order] : generatableSlides().map((s) => s.order);
  for (const o of targets) generatingOrders.add(o);
  renderRail();
  renderNav();
  updateProgressLabel();

  const qs = new URLSearchParams({ id: project.id });
  if (order) qs.set("slide", String(order));
  if (force) qs.set("force", "1");

  try {
    const res = await fetch(`/.netlify/functions/generate-images-background?${qs}`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // The request to even *start* the background function failed — don't leave the UI stuck on "en cours".
    for (const o of targets) generatingOrders.delete(o);
    renderRail();
    renderNav();
    updateProgressLabel();
    alert(`Impossible de lancer la génération : ${(err as Error).message}`);
    return;
  }

  startPolling();
}

/**
 * Updates only the generation status/actions block for the current slide — never
 * touches the style select or prompt textarea. This is what the poll loop calls, so an
 * in-progress edit (or scroll position) in those fields survives a background generation
 * run instead of being wiped out every 3 seconds by a full rail rebuild.
 */
function renderGenerationStatus(slide: Slide) {
  if (!slide.image) return;

  let container = railEl.querySelector<HTMLDivElement>("#generation-status-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "generation-status-container";
    railEl.appendChild(container);
  }
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "generation-status";

  if (generatingOrders.has(slide.order)) {
    const pending = document.createElement("span");
    pending.className = "status-badge status-generating";
    pending.textContent = "⏳ Génération en cours…";
    wrap.appendChild(pending);
    container.appendChild(wrap);
    return;
  }

  if (slide.image?.generatedAssetId) {
    const ok = document.createElement("span");
    ok.className = "status-badge status-approved";
    ok.textContent = "Image générée";
    wrap.appendChild(ok);

    const regenBtn = document.createElement("button");
    regenBtn.className = "btn";
    regenBtn.textContent = "↻ Régénérer";
    regenBtn.addEventListener("click", () => triggerGeneration(slide.order, true));
    wrap.appendChild(regenBtn);
  } else if (slide.image?.generationError) {
    const err = document.createElement("p");
    err.className = "feedback-note";
    err.textContent = `Échec : ${slide.image.generationError}`;
    wrap.appendChild(err);

    if (/organization|organisation|403/i.test(slide.image.generationError)) {
      const hint = document.createElement("p");
      hint.className = "feedback-note";
      hint.textContent =
        "→ gpt-image-1 exige une organisation OpenAI vérifiée. Vérifie-la sur platform.openai.com/settings/organization/general, attends quelques minutes, puis réessaie.";
      wrap.appendChild(hint);
    }

    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn-reject";
    retryBtn.textContent = "Réessayer";
    retryBtn.addEventListener("click", () => triggerGeneration(slide.order, true));
    wrap.appendChild(retryBtn);
  } else {
    const genBtn = document.createElement("button");
    genBtn.className = "btn btn-approve";
    genBtn.textContent = "🎨 Générer cette image";
    genBtn.addEventListener("click", () => triggerGeneration(slide.order, false));
    wrap.appendChild(genBtn);
  }

  container.appendChild(wrap);
}

function renderRail() {
  const slide = project.slides[currentIndex];
  railEl.innerHTML = "";

  const heading = document.createElement("p");
  heading.className = "review-rail-heading";
  heading.textContent = `Slide ${slide.order} / ${project.slides.length}`;
  railEl.appendChild(heading);

  if (!slide.image) {
    const note = document.createElement("p");
    note.className = "feedback-note";
    note.textContent = "Pas d'image sur cette slide (texte seul) — rien à configurer ici.";
    railEl.appendChild(note);
    return;
  }

  const styleLabel = document.createElement("label");
  styleLabel.className = "field-label";
  styleLabel.textContent = "Style";
  railEl.appendChild(styleLabel);

  const styleSelect = document.createElement("select");
  styleSelect.className = "style-select";
  for (const style of IMAGE_STYLES) {
    const option = document.createElement("option");
    option.value = style.id;
    option.textContent = style.label;
    styleSelect.appendChild(option);
  }
  styleSelect.value = slide.image.styleId ?? IMAGE_STYLES[0]!.id;
  railEl.appendChild(styleSelect);

  const promptLabel = document.createElement("label");
  promptLabel.className = "field-label";
  promptLabel.textContent = "Prompt final (envoyé à la génération d'image)";
  railEl.appendChild(promptLabel);

  const promptInput = document.createElement("textarea");
  promptInput.className = "feedback-input prompt-input";
  promptInput.value = currentPromptFor(slide);
  railEl.appendChild(promptInput);
  autosizeTextarea(promptInput);

  styleSelect.addEventListener("change", () => {
    // The style pick drives the prompt — regenerate it, discarding a manual edit.
    promptInput.value = buildFinalPrompt(slide.image!.placeholderPrompt, styleSelect.value);
    promptInput.dispatchEvent(new Event("input"));
  });

  const resetBtn = document.createElement("button");
  resetBtn.className = "btn";
  resetBtn.textContent = "Revenir au prompt brut du brief";
  resetBtn.addEventListener("click", () => {
    promptInput.value = slide.image!.placeholderPrompt;
    promptInput.dispatchEvent(new Event("input"));
  });
  railEl.appendChild(resetBtn);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-save-feedback";
  saveBtn.textContent = "Enregistrer";
  saveBtn.addEventListener("click", async () => {
    slide.image!.styleId = styleSelect.value;
    slide.image!.finalPrompt = promptInput.value.trim();
    await persist();
    renderSlide();
    renderNav();
  });
  railEl.appendChild(saveBtn);

  renderGenerationStatus(slide);
}

function dotStatus(slide: Slide): string {
  if (!slide.image) return "no-image";
  if (generatingOrders.has(slide.order)) return "status-generating";
  if (slide.image.generatedAssetId) return "status-approved";
  if (slide.image.generationError) return "status-needs_changes";
  return "status-pending";
}

function dotTitle(slide: Slide): string {
  if (!slide.image) return `Slide ${slide.order} — sans image`;
  if (generatingOrders.has(slide.order)) return `Slide ${slide.order} — génération en cours`;
  if (slide.image.generatedAssetId) return `Slide ${slide.order} — image générée`;
  if (slide.image.generationError) return `Slide ${slide.order} — échec de génération`;
  return `Slide ${slide.order} — prompt prêt`;
}

function renderNav() {
  navEl.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.className = "nav-arrow";
  prevBtn.textContent = "‹";
  prevBtn.disabled = currentIndex === 0;
  prevBtn.addEventListener("click", () => goTo(currentIndex - 1));

  const strip = document.createElement("div");
  strip.className = "nav-strip";
  project.slides.forEach((slide, index) => {
    const dot = document.createElement("button");
    dot.className = `nav-dot ${dotStatus(slide)} ${index === currentIndex ? "active" : ""}`;
    dot.textContent = String(slide.order);
    dot.title = dotTitle(slide);
    dot.addEventListener("click", () => goTo(index));
    strip.appendChild(dot);
  });

  const nextBtn = document.createElement("button");
  nextBtn.className = "nav-arrow";
  nextBtn.textContent = "›";
  nextBtn.disabled = currentIndex === project.slides.length - 1;
  nextBtn.addEventListener("click", () => goTo(currentIndex + 1));

  navEl.append(prevBtn, strip, nextBtn);

  const activeDot = strip.querySelector(".active");
  activeDot?.scrollIntoView({ block: "nearest", inline: "center" });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") goTo(currentIndex - 1);
  if (event.key === "ArrowRight") goTo(currentIndex + 1);
});

function generatableSlides(): Slide[] {
  return project.slides.filter((s) => s.image && s.reviewStatus === "approved");
}

function isFullyGenerated(): boolean {
  return generatableSlides().every((s) => s.image!.generatedAssetId || s.image!.generationError);
}

function updateProgressLabel() {
  const targets = generatableSlides();
  const done = targets.filter((s) => s.image!.generatedAssetId || s.image!.generationError).length;
  const inProgressNote = generatingOrders.size ? ` (${generatingOrders.size} en cours…)` : "";
  progressEl.textContent = targets.length ? `${done}/${targets.length} images traitées${inProgressNote}` : "";
  generateAllBtn.disabled = generatingOrders.size > 0;
}

async function refreshProject() {
  const res = await fetch(`/api/project-state?id=${project.id}`);
  if (!res.ok) return;
  const { project: fresh } = (await res.json()) as { project: Project };

  // Merge in place — never reassign `project` or replace a slide object. The save
  // button, style select and prompt textarea for the currently-rendered slide hold
  // direct references to these objects; replacing them would silently detach those
  // controls from what actually gets persisted, so "Enregistrer" would serialize the
  // freshly-*re-fetched* (unedited) state instead of the user's change.
  project.status = fresh.status;
  for (const freshSlide of fresh.slides) {
    const liveSlide = project.slides.find((s) => s.id === freshSlide.id);
    if (!liveSlide?.image || !freshSlide.image) continue;
    // Only sync the fields the background function can change — never finalPrompt/
    // styleId, which are the user's to edit and must survive untouched here.
    liveSlide.image.generatedAssetId = freshSlide.image.generatedAssetId;
    liveSlide.image.generatedAt = freshSlide.image.generatedAt;
    liveSlide.image.history = freshSlide.image.history;
    liveSlide.image.generationError = freshSlide.image.generationError;
  }

  for (const slide of project.slides) {
    if (slide.image?.generatedAssetId || slide.image?.generationError) generatingOrders.delete(slide.order);
  }
  // Deliberately not renderRail(): that fully rebuilds the style/prompt fields, which would
  // wipe an edit the user is mid-typing (and reset their scroll position) every 3 seconds
  // while a batch generation runs. Only the slide preview, this one status block, the nav
  // dots and the progress label need to reflect newly-arrived results.
  renderSlide();
  renderGenerationStatus(project.slides[currentIndex]);
  renderNav();
  updateProgressLabel();
}

function startPolling() {
  updateProgressLabel();
  if (pollHandle) return;
  pollHandle = window.setInterval(async () => {
    await refreshProject();
    if (isFullyGenerated() && pollHandle) {
      window.clearInterval(pollHandle);
      pollHandle = undefined;
    }
  }, 3000);
}

applyGlobalStyleBtn.addEventListener("click", async () => {
  const styleId = globalStyleSelect.value;
  const slidesWithImage = project.slides.filter((s): s is Slide & { image: NonNullable<Slide["image"]> } => Boolean(s.image));

  const hasManualEdits = slidesWithImage.some((s) => {
    const auto = buildFinalPrompt(s.image.placeholderPrompt, s.image.styleId);
    return s.image.finalPrompt !== undefined && s.image.finalPrompt !== auto;
  });
  if (
    hasManualEdits &&
    !confirm("Certaines slides ont un prompt modifié à la main. Appliquer le style global à toutes les remplacera. Continuer ?")
  ) {
    return;
  }

  for (const slide of slidesWithImage) {
    slide.image.styleId = styleId;
    slide.image.finalPrompt = buildFinalPrompt(slide.image.placeholderPrompt, styleId);
  }
  await persist();
  renderSlide();
  renderRail();
  renderNav();
});

generateAllBtn.addEventListener("click", () => triggerGeneration());

async function main() {
  if (!projectId) {
    titleEl.textContent = "Aucun projet";
    metaEl.textContent = "Reviens à l'accueil pour importer ou reprendre un brief.";
    return;
  }

  const res = await fetch(`/api/project-state?id=${projectId}`);
  if (!res.ok) {
    titleEl.textContent = "Projet introuvable";
    return;
  }
  ({ project } = (await res.json()) as { project: Project });

  backLink.href = `/wizard.html?project=${project.id}`;

  for (const style of IMAGE_STYLES) {
    const option = document.createElement("option");
    option.value = style.id;
    option.textContent = style.label;
    globalStyleSelect.appendChild(option);
  }

  titleEl.textContent = project.title;
  const metaParts = [
    project.meta.language ? `Langue : ${project.meta.language}` : null,
    project.meta.tone ? `Ton : ${project.meta.tone}` : null,
  ].filter(Boolean);
  metaEl.textContent = metaParts.join(" · ");

  if (project.status === "draft" || project.status === "layout_review") {
    project.status = "prompt_review";
    await persist();
  }

  const requestedOrder = Number(params.get("slide"));
  const requestedIndex = project.slides.findIndex((s: Slide) => s.order === requestedOrder);
  currentIndex = requestedIndex >= 0 ? requestedIndex : 0;

  renderSlide();
  renderRail();
  renderNav();
  updateProgressLabel();

  if (!isFullyGenerated() && generatableSlides().some((s) => s.image!.generatedAssetId || s.image!.generationError)) {
    // A generation run was left in progress (e.g. the page was reloaded mid-batch) — keep polling.
    startPolling();
  }
}

main();
