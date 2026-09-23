import { buildFinalPrompt, IMAGE_STYLES } from "../../lib/image-styles.js";
import type { Project, Slide } from "../../lib/types.js";
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
  return slide.image?.generatedAssetId ? `/api/asset?key=${encodeURIComponent(slide.image.generatedAssetId)}` : undefined;
}

function renderSlide() {
  const slide = project.slides[currentIndex];
  viewportEl.innerHTML = "";
  viewportEl.appendChild(
    buildSlideCard(slide, { promptOverride: currentPromptFor(slide), promptTag: "Prompt final", generatedImageUrl: assetUrl(slide) }),
  );
  positionEl.textContent = `Slide ${currentIndex + 1} / ${project.slides.length}`;
}

async function triggerGeneration(order?: number, force = false) {
  const qs = new URLSearchParams({ id: project.id });
  if (order) qs.set("slide", String(order));
  if (force) qs.set("force", "1");
  await fetch(`/.netlify/functions/generate-images-background?${qs}`, { method: "POST" });
  renderRail();
  startPolling();
}

function renderGenerationStatus(slide: Slide) {
  const wrap = document.createElement("div");
  wrap.className = "generation-status";

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

  railEl.appendChild(wrap);
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

  styleSelect.addEventListener("change", () => {
    // The style pick drives the prompt — regenerate it, discarding a manual edit.
    promptInput.value = buildFinalPrompt(slide.image!.placeholderPrompt, styleSelect.value);
  });

  const resetBtn = document.createElement("button");
  resetBtn.className = "btn";
  resetBtn.textContent = "Revenir au prompt brut du brief";
  resetBtn.addEventListener("click", () => {
    promptInput.value = slide.image!.placeholderPrompt;
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
  if (slide.image.generatedAssetId) return "status-approved";
  if (slide.image.generationError) return "status-needs_changes";
  return "status-pending";
}

function dotTitle(slide: Slide): string {
  if (!slide.image) return `Slide ${slide.order} — sans image`;
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
  progressEl.textContent = targets.length ? `${done}/${targets.length} images traitées` : "";
}

async function refreshProject() {
  const res = await fetch(`/api/project-state?id=${project.id}`);
  if (!res.ok) return;
  ({ project } = (await res.json()) as { project: Project });
  renderSlide();
  renderRail();
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
