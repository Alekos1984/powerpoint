import type { ProjectSummary } from "../../lib/types.js";

const form = document.querySelector<HTMLFormElement>("#upload-form")!;
const fileInput = document.querySelector<HTMLInputElement>("#file")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;

async function loadRecentProjects() {
  const section = document.querySelector<HTMLElement>("#recent-projects");
  const list = document.querySelector<HTMLUListElement>("#recent-projects-list");
  if (!section || !list) return;

  try {
    const res = await fetch("/api/list-projects");
    if (!res.ok) return;
    const { projects } = (await res.json()) as { projects: ProjectSummary[] };
    if (projects.length === 0) return;

    for (const project of projects) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `/wizard.html?project=${project.id}`;
      link.textContent = `${project.title} — ${project.approvedCount}/${project.slideCount} approuvées`;
      item.appendChild(link);
      list.appendChild(item);
    }
    section.hidden = false;
  } catch {
    // Best-effort convenience list — the upload flow works fine without it.
  }
}

loadRecentProjects();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files?.[0];
  if (!file) return;

  statusEl.textContent = "Analyse du brief…";

  const markdown = await file.text();

  const res = await fetch("/api/parse-brief", {
    method: "POST",
    headers: { "Content-Type": "text/markdown" },
    body: markdown,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    statusEl.textContent = `Erreur : ${body.error ?? res.statusText}`;
    return;
  }

  const { projectId } = await res.json();
  window.location.href = `/wizard.html?project=${projectId}`;
});
