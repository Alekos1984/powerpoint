import { getStore } from "@netlify/blobs";
import type { Project } from "./types.js";

const STORE_NAME = "projects";

export async function saveProject(project: Project): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(project.id, project);
}

export async function loadProject(id: string): Promise<Project | null> {
  const store = getStore(STORE_NAME);
  return (await store.get(id, { type: "json" })) as Project | null;
}
