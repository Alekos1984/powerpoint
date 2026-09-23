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
    // Read once to get this slide's own prompt/style — that part is safe to read early.
    const projectBeforeCall = await loadProject(projectId);
    if (!projectBeforeCall) return;
    const slideBeforeCall = projectBeforeCall.slides.find((s) => s.order === order);
    if (!slideBeforeCall?.image) continue;

    const prompt = slideBeforeCall.image.finalPrompt ?? buildFinalPrompt(slideBeforeCall.image.placeholderPrompt, slideBeforeCall.image.styleId);
    const size = getStyleById(slideBeforeCall.image.styleId)?.size ?? "1536x1024";
    const slideId = slideBeforeCall.id;

    let result: { assetKey: string; bytes: Buffer } | undefined;
    let error: string | undefined;
    try {
      const base64 = await callOpenAiImage(prompt, size); // slow (real API call) — nothing is written yet
      result = { assetKey: `${projectId}/${slideId}.png`, bytes: Buffer.from(base64, "base64") };
    } catch (err) {
      error = (err as Error).message;
    }

    // Re-read right before writing (not the copy from before the slow API call), so a
    // concurrent edit made *during* that call — e.g. the user tweaking this same slide's
    // prompt while it was generating — isn't clobbered by writing back a stale snapshot.
    const projectAfterCall = await loadProject(projectId);
    if (!projectAfterCall) return;
    const slideAfterCall = projectAfterCall.slides.find((s) => s.order === order);
    if (!slideAfterCall?.image) continue;

    if (result) {
      await assetStore.set(result.assetKey, result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength) as ArrayBuffer);
      slideAfterCall.image.generatedAssetId = result.assetKey;
      slideAfterCall.image.generatedAt = new Date().toISOString();
      slideAfterCall.image.generationError = undefined;
    } else {
      slideAfterCall.image.generationError = error;
    }

    await saveProject(projectAfterCall);
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
