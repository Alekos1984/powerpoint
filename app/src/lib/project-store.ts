import { getStore } from "@netlify/blobs";
import type { Project, ProjectSummary } from "./types.js";

const STORE_NAME = "projects";

export async function saveProject(project: Project): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(project.id, project);
}

export async function loadProject(id: string): Promise<Project | null> {
  const store = getStore(STORE_NAME);
  return (await store.get(id, { type: "json" })) as Project | null;
}

/** Lets the landing page offer "resume this project" instead of re-uploading the brief from scratch. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const store = getStore(STORE_NAME);
  const { blobs } = await store.list();

  const projects = await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json" }) as Promise<Project | null>));

  return projects
    .filter((p): p is Project => p !== null)
    .map((p) => ({
      id: p.id,
      title: p.title,
      createdAt: p.createdAt,
      status: p.status,
      slideCount: p.slides.length,
      approvedCount: p.slides.filter((s) => s.reviewStatus === "approved").length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
