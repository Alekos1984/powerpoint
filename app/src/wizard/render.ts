import { LAYOUT_PRESETS } from "../lib/layout-presets.js";
import type { Project, Slide } from "../lib/types.js";

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

const titleEl = document.querySelector<HTMLHeadingElement>("#project-title")!;
const metaEl = document.querySelector<HTMLParagraphElement>("#project-meta")!;
const slidesEl = document.querySelector<HTMLDivElement>("#slides")!;

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

function renderSlide(slide: Slide, project: Project): HTMLElement {
  const preset = LAYOUT_PRESETS[slide.layout];
  const article = document.createElement("article");
  article.className = `slide-card ${preset.cssClass}`;

  const placeholder = document.createElement("div");
  placeholder.className = "image-placeholder";
  placeholder.innerHTML = slide.image
    ? `<span class="placeholder-tag">image à générer (étape 3)</span><p class="placeholder-prompt">${escapeHtml(slide.image.placeholderPrompt)}</p>`
    : `<span class="placeholder-tag">texte seul</span>`;

  const text = document.createElement("div");
  text.className = "slide-text";
  text.innerHTML = `<h3>Slide ${slide.order} — ${escapeHtml(slide.title ?? "")}</h3><div class="on-screen">${slide.onScreenText.body
    .map(renderOnScreenLine)
    .join("")}</div>`;

  const spoken = document.createElement("details");
  spoken.className = "spoken-text";
  spoken.innerHTML = `<summary>Texte oral</summary><p>${escapeHtml(slide.spokenText)}</p>`;
  text.appendChild(spoken);

  const approve = document.createElement("label");
  approve.className = "approve-toggle";
  approve.innerHTML = `<input type="checkbox" ${slide.approved ? "checked" : ""} /> Approuvé (texte + disposition)`;
  const checkbox = approve.querySelector("input")!;
  checkbox.addEventListener("change", async () => {
    slide.approved = checkbox.checked;
    await fetch(`/api/project-state?id=${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
  });
  text.appendChild(approve);

  if (preset.id === "image-half-right") {
    article.append(text, placeholder);
  } else {
    article.append(placeholder, text);
  }
  return article;
}

async function main() {
  if (!projectId) {
    titleEl.textContent = "Aucun projet";
    metaEl.textContent = "Reviens à l'accueil pour importer un brief.";
    return;
  }

  const res = await fetch(`/api/project-state?id=${projectId}`);
  if (!res.ok) {
    titleEl.textContent = "Projet introuvable";
    return;
  }
  const { project } = (await res.json()) as { project: Project };

  titleEl.textContent = project.title;
  const metaParts = [
    project.meta.language ? `Langue : ${project.meta.language}` : null,
    project.meta.tone ? `Ton : ${project.meta.tone}` : null,
    project.meta.targetDurationMinutes ? `${project.meta.targetDurationMinutes} min max` : null,
    `${project.slides.length} slides`,
  ].filter(Boolean);
  metaEl.textContent = metaParts.join(" · ");

  for (const slide of project.slides) {
    slidesEl.appendChild(renderSlide(slide, project));
  }
}

main();
