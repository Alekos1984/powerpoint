import { parseBrief } from "../../src/lib/parse-brief.js";
import { saveProject } from "../../src/lib/project-store.js";

/**
 * Step 0: raw Markdown brief -> Project (text + layout only, no images, no LLM).
 * The optional LLM rewrite pass lives in a separate future function
 * (restructure-text) so this endpoint stays fast and deterministic.
 */
export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const markdown = await req.text();
  if (!markdown.trim()) {
    return Response.json({ error: "Empty brief." }, { status: 400 });
  }

  let project;
  try {
    project = parseBrief(markdown);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 422 });
  }

  await saveProject(project);

  return Response.json({ projectId: project.id, project });
};

export const config = {
  path: "/api/parse-brief",
};
