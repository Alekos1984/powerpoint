import { LAYOUT_PRESETS } from "../../lib/layout-presets.js";
import type { Project, ReviewStatus, Slide } from "../../lib/types.js";

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

const titleEl = document.querySelector<HTMLHeadingElement>("#project-title")!;
const metaEl = document.querySelector<HTMLParagraphElement>("#project-meta")!;
const positionEl = document.querySelector<HTMLParagraphElement>("#slide-position")!;
const viewportEl = document.querySelector<HTMLElement>("#slide-viewport")!;
const railEl = document.querySelector<HTMLElement>("#review-rail")!;
const navEl = document.querySelector<HTMLElement>("#slide-nav")!;

let project: Project;
let currentIndex = 0;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal, safe subset: bold **text**, ### headings, "- " bullets. Nothing more — good enough for a step-1 draft. */
function renderOnScreenLine(line: string): string {
  const escaped = escapeHtml(line);
  const headingMatch = /^(#{1,3})\s+(.*)$/.exec(escaped);
  if (headingMatch) {
    const level = headingMatch[1].length + 3; // -> h4/h5/h6, stays subordinate to the slide title
    return `<h${level}>${headingMatch[2].replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</h${level}>`;
  }
  const bulletMatch = /^-\s+(.*)$/.exec(escaped);
  const content = (bulletMatch ? bulletMatch[1] : escaped).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return bulletMatch ? `<li>${content}</li>` : `<p>${content}</p>`;
}

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
  renderReviewRail();
  renderNav();
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "En attente",
  approved: "Approuvé",
  needs_changes: "Modifications demandées",
};

function renderSlide() {
  const slide = project.slides[currentIndex];
  const preset = LAYOUT_PRESETS[slide.layout];

  viewportEl.innerHTML = "";
  const article = document.createElement("article");
  article.className = `slide-card ${preset.cssClass}`;

  const placeholder = document.createElement("div");
  placeholder.className = "image-placeholder";
  placeholder.innerHTML = slide.image
    ? `<span class="placeholder-tag">image à générer (étape 3)</span><p class="placeholder-prompt">${escapeHtml(slide.image.placeholderPrompt)}</p>`
    : `<span class="placeholder-tag">texte seul</span>`;

  const text = document.createElement("div");
  text.className = "slide-text";
  text.innerHTML = `<h2>Slide ${slide.order} — ${escapeHtml(slide.title ?? "")}</h2><div class="on-screen">${slide.onScreenText.body
    .map(renderOnScreenLine)
    .join("")}</div>`;

  const spoken = document.createElement("details");
  spoken.className = "spoken-text";
  spoken.innerHTML = `<summary>Texte oral</summary><p>${escapeHtml(slide.spokenText)}</p>`;
  text.appendChild(spoken);

  if (preset.id === "image-half-right") {
    article.append(text, placeholder);
  } else {
    article.append(placeholder, text);
  }
  viewportEl.appendChild(article);

  positionEl.textContent = `Slide ${currentIndex + 1} / ${project.slides.length}`;
}

function renderReviewRail() {
  const slide = project.slides[currentIndex];
  railEl.innerHTML = "";

  const heading = document.createElement("p");
  heading.className = "review-rail-heading";
  heading.textContent = `Slide ${slide.order} / ${project.slides.length}`;
  railEl.appendChild(heading);

  const statusBadge = document.createElement("span");
  statusBadge.className = `status-badge status-${slide.reviewStatus}`;
  statusBadge.textContent = STATUS_LABEL[slide.reviewStatus];
  railEl.appendChild(statusBadge);

  const actions = document.createElement("div");
  actions.className = "review-actions";

  const approveBtn = document.createElement("button");
  approveBtn.className = "btn btn-approve";
  approveBtn.textContent = "✓ Approuver";
  approveBtn.addEventListener("click", async () => {
    slide.reviewStatus = "approved";
    slide.feedback = undefined;
    await persist();
    renderReviewRail();
    renderNav();
  });

  const rejectBtn = document.createElement("button");
  rejectBtn.className = "btn btn-reject";
  rejectBtn.textContent = "✗ Demander des modifications";
  rejectBtn.addEventListener("click", () => {
    feedbackPanel.hidden = !feedbackPanel.hidden;
    if (!feedbackPanel.hidden) feedbackInput.focus();
  });

  actions.append(approveBtn, rejectBtn);
  railEl.appendChild(actions);

  const feedbackPanel = document.createElement("div");
  feedbackPanel.className = "feedback-panel";
  feedbackPanel.hidden = slide.reviewStatus !== "needs_changes";

  const feedbackInput = document.createElement("textarea");
  feedbackInput.className = "feedback-input";
  feedbackInput.placeholder = "Explique ce qui ne va pas (texte, disposition…) — un LLM s'en servira pour retravailler la slide.";
  feedbackInput.value = slide.feedback ?? "";

  const saveFeedbackBtn = document.createElement("button");
  saveFeedbackBtn.className = "btn btn-save-feedback";
  saveFeedbackBtn.textContent = "Enregistrer les remarques";
  saveFeedbackBtn.addEventListener("click", async () => {
    slide.reviewStatus = "needs_changes";
    slide.feedback = feedbackInput.value.trim();
    await persist();
    renderReviewRail();
    renderNav();
  });

  feedbackPanel.append(feedbackInput, saveFeedbackBtn);
  railEl.appendChild(feedbackPanel);

  if (slide.reviewStatus === "needs_changes" && slide.feedback) {
    const note = document.createElement("p");
    note.className = "feedback-note";
    note.textContent = `Remarque enregistrée : ${slide.feedback}`;
    railEl.appendChild(note);
  }
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
    dot.className = `nav-dot status-${slide.reviewStatus} ${index === currentIndex ? "active" : ""}`;
    dot.textContent = String(slide.order);
    dot.title = `Slide ${slide.order} — ${STATUS_LABEL[slide.reviewStatus]}`;
    dot.addEventListener("click", () => goTo(index));
    strip.appendChild(dot);
  });

  const nextBtn = document.createElement("button");
  nextBtn.className = "nav-arrow";
  nextBtn.textContent = "›";
  nextBtn.disabled = currentIndex === project.slides.length - 1;
  nextBtn.addEventListener("click", () => goTo(currentIndex + 1));

  const approveAllBtn = document.createElement("button");
  approveAllBtn.className = "btn btn-approve nav-approve-all";
  approveAllBtn.textContent = "✓ Approuver tout";
  approveAllBtn.addEventListener("click", async () => {
    const hasFeedback = project.slides.some((s) => s.reviewStatus === "needs_changes" && s.feedback);
    if (hasFeedback && !confirm("Des slides ont des remarques en attente. Les approuver toutes effacera ces remarques. Continuer ?")) {
      return;
    }
    for (const s of project.slides) {
      s.reviewStatus = "approved";
      s.feedback = undefined;
    }
    await persist();
    renderReviewRail();
    renderNav();
  });

  navEl.append(prevBtn, strip, nextBtn, approveAllBtn);

  const activeDot = strip.querySelector(".active");
  activeDot?.scrollIntoView({ block: "nearest", inline: "center" });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") goTo(currentIndex - 1);
  if (event.key === "ArrowRight") goTo(currentIndex + 1);
});

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

  titleEl.textContent = project.title;
  const metaParts = [
    project.meta.language ? `Langue : ${project.meta.language}` : null,
    project.meta.tone ? `Ton : ${project.meta.tone}` : null,
    project.meta.targetDurationMinutes ? `${project.meta.targetDurationMinutes} min max` : null,
  ].filter(Boolean);
  metaEl.textContent = metaParts.join(" · ");

  const requestedOrder = Number(params.get("slide"));
  const requestedIndex = project.slides.findIndex((s: Slide) => s.order === requestedOrder);
  currentIndex = requestedIndex >= 0 ? requestedIndex : 0;

  renderSlide();
  renderReviewRail();
  renderNav();
}

main();
