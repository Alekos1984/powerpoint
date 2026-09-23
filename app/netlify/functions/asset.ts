import { getStore } from "@netlify/blobs";

/** Serves a generated image back to the browser — Netlify Blobs aren't directly web-accessible. */
export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("Missing 'key' query parameter.", { status: 400 });

  const store = getStore("generated-images");
  const blob = await store.get(key, { type: "arrayBuffer" });
  if (!blob) return new Response("Not found.", { status: 404 });

  return new Response(blob, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config = {
  path: "/api/asset",
};
