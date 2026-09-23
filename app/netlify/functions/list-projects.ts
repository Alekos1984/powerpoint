import { listProjects } from "../../src/lib/project-store.js";

/** Backs the landing page's "resume a project" list — the data was always saved in Netlify Blobs, this just makes it findable again. */
export default async (): Promise<Response> => {
  const projects = await listProjects();
  return Response.json({ projects });
};

export const config = {
  path: "/api/list-projects",
};
