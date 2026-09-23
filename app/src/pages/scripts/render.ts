import type { Project, ReviewStatus, Slide } from "../../lib/types.js";
import { buildSlideCard } from "./slide-card.js";

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

const titleEl = document.querySelector<HTMLHeadingElement>("#project-title")!;
const metaEl = document.querySelector<HTMLParagraphElement>("#project-meta")!;
const positionEl = document.querySelector<HTMLParagraphElement>("#slide-position")!;
const viewportEl = document.querySelector<HTMLElement>("#slide-viewport")!;
const railEl = document.querySelector<HTMLElement>("#review-rail")!;
const navEl = document.querySelector<HTMLElement>("#slide-nav")!;
const nextStepLink = document.querySelector<HTMLAnchorElement>("#next-step-link")!;

let project: Project;
let currentIndex = 0;

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
  viewportEl.innerHTML = "";
  viewportEl.appendChild(buildSlideCard(slide));
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
    updateNextStepLink();
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
    updateNextStepLink();
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
    updateNextStepLink();
  });

  navEl.append(prevBtn, strip, nextBtn, approveAllBtn);

  const activeDot = strip.querySelector(".active");
  activeDot?.scrollIntoView({ block: "nearest", inline: "center" });
}

function updateNextStepLink() {
  const allApproved = project.slides.every((s) => s.reviewStatus === "approved");
  nextStepLink.href = `/prompts.html?project=${project.id}`;
  nextStepLink.classList.toggle("btn-disabled", !allApproved);
  nextStepLink.setAttribute("aria-disabled", String(!allApproved));
  nextStepLink.title = allApproved ? "" : "Approuve toutes les slides avant de passer aux styles et prompts d'image.";
}

nextStepLink.addEventListener("click", (event) => {
  if (nextStepLink.getAttribute("aria-disabled") === "true") event.preventDefault();
});

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
  updateNextStepLink();
}

main();
