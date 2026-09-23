import { LAYOUT_PRESETS } from "../../lib/layout-presets.js";
import type { Slide } from "../../lib/types.js";

export function escapeHtml(text: string): string {
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

/** Shared slide preview used by both the text/layout review (wizard) and the prompt/style review steps. */
export function buildSlideCard(
  slide: Slide,
  opts?: { promptOverride?: string; promptTag?: string; generatedImageUrl?: string },
): HTMLElement {
  const preset = LAYOUT_PRESETS[slide.layout];
  const article = document.createElement("article");
  article.className = `slide-card ${preset.cssClass}`;

  const placeholder = document.createElement("div");
  if (opts?.generatedImageUrl) {
    placeholder.className = "image-generated";
    const img = document.createElement("img");
    img.src = opts.generatedImageUrl;
    img.alt = slide.image?.placeholderPrompt ?? "";
    placeholder.appendChild(img);
  } else {
    placeholder.className = "image-placeholder";
    const promptText = opts?.promptOverride ?? slide.image?.placeholderPrompt;
    placeholder.innerHTML = slide.image
      ? `<span class="placeholder-tag">${escapeHtml(opts?.promptTag ?? "image à générer (étape 3)")}</span><p class="placeholder-prompt">${escapeHtml(promptText ?? "")}</p>`
      : `<span class="placeholder-tag">texte seul</span>`;
  }

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
  return article;
}
