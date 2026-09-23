import { loadProject, saveProject } from "../../src/lib/project-store.js";
import type { Project } from "../../src/lib/types.js";

/**
 * CRUD over a stored Project. Milestone 1 only needs GET (render step 1) and
 * PUT (step 2 edits: approve a slide, change its text/layout) — no AI calls.
 */
export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing 'id' query parameter." }, { status: 400 });
  }

  if (req.method === "GET") {
    const project = await loadProject(id);
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    return Response.json({ project });
  }

  if (req.method === "PUT") {
    const existing = await loadProject(id);
    if (!existing) return Response.json({ error: "Project not found." }, { status: 404 });

    const updated = (await req.json()) as Project;
    if (updated.id !== id) {
      return Response.json({ error: "Body 'id' does not match query 'id'." }, { status: 400 });
    }
    await saveProject(updated);
    return Response.json({ project: updated });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config = {
  path: "/api/project-state",
};
