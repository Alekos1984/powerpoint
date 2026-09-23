import { getStore } from "@netlify/blobs";
import { buildFinalPrompt, getStyleById } from "../../src/lib/image-styles.js";
import { loadProject, saveProject } from "../../src/lib/project-store.js";
import type { Slide } from "../../src/lib/types.js";

/**
 * Netlify Background Function (note the -background filename): a single
 * gpt-image-1 call can take well past the ~10-26s synchronous function
 * budget, and a full deck means up to 16 of them. Progress is written to
 * Netlify Blobs after every slide, not just at the end, so the client can
 * poll project-state and show images landing one by one.
 */

// Overridable only so this function is testable against a local mock server
// without spending real OpenAI calls; never set in production.
const OPENAI_IMAGES_URL = process.env.OPENAI_IMAGES_BASE_URL ?? "https://api.openai.com/v1/images/generations";

async function callOpenAiImage(prompt: string, size: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in this environment.");

  const res = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size, quality: "medium", n: 1 }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI Images API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = json.data?.[0];
  if (item?.b64_json) return item.b64_json;
  if (item?.url) {
    const imgRes = await fetch(item.url);
    const buf = await imgRes.arrayBuffer();
    return Buffer.from(buf).toString("base64");
  }
  throw new Error("OpenAI Images API response contained no image data.");
}

function shouldProcess(slide: Slide, force: boolean): boolean {
  if (!slide.image || slide.reviewStatus !== "approved") return false;
  if (force) return true;
  return !slide.image.generatedAssetId;
}

export default async (req: Request): Promise<void> => {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("id");
  const onlyOrder = url.searchParams.get("slide") ? Number(url.searchParams.get("slide")) : undefined;
  const force = url.searchParams.get("force") === "1";
  if (!projectId) return;

  const initialProject = await loadProject(projectId);
  if (!initialProject) return;

  const targetOrders = initialProject.slides
    .filter((s) => (onlyOrder ? s.order === onlyOrder : true))
    .filter((s) => shouldProcess(s, force))
    .map((s) => s.order);

  if (targetOrders.length === 0) return;

  const assetStore = getStore("generated-images");

  for (const order of targetOrders) {
    // Re-read the project fresh for every slide rather than reusing one held-open copy,
    // so a concurrent edit from the browser (a different slide's prompt, say) during this
    // run isn't clobbered by writing back a stale in-memory snapshot at the end.
    const project = await loadProject(projectId);
    if (!project) return;
    const slide = project.slides.find((s) => s.order === order);
    if (!slide?.image) continue;

    const prompt = slide.image.finalPrompt ?? buildFinalPrompt(slide.image.placeholderPrompt, slide.image.styleId);
    const size = getStyleById(slide.image.styleId)?.size ?? "1536x1024";

    try {
      const base64 = await callOpenAiImage(prompt, size);
      const assetKey = `${project.id}/${slide.id}.png`;
      const bytes = Buffer.from(base64, "base64");
      await assetStore.set(assetKey, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      slide.image.generatedAssetId = assetKey;
      slide.image.generationError = undefined;
    } catch (err) {
      slide.image.generationError = (err as Error).message;
    }

    await saveProject(project);
  }

  const finalProject = await loadProject(projectId);
  if (!finalProject) return;
  const allDone = finalProject.slides
    .filter((s) => s.image && s.reviewStatus === "approved")
    .every((s) => s.image!.generatedAssetId || s.image!.generationError);
  if (allDone) {
    finalProject.status = "images_ready";
    await saveProject(finalProject);
  }
};
