const form = document.querySelector<HTMLFormElement>("#upload-form")!;
const fileInput = document.querySelector<HTMLInputElement>("#file")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;

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
