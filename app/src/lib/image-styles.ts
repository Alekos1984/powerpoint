import type { ImageStylePreset } from "./types.js";
import stylesData from "../../assets/image-styles/styles.json";

export const IMAGE_STYLES: ImageStylePreset[] = stylesData;

export function getStyleById(id?: string): ImageStylePreset | undefined {
  return IMAGE_STYLES.find((s) => s.id === id);
}

const ASPECT_LABEL: Record<string, string> = {
  "1536x1024": "16:9 paysage",
  "1024x1536": "9:16 portrait",
  "1024x1024": "carré",
};

function formatSizeNote(size: string): string {
  const aspect = ASPECT_LABEL[size];
  return aspect ? `Format ${aspect} (${size} px).` : `Format ${size} px.`;
}

/**
 * The model needs two things stated plainly: the exact target size/aspect
 * ratio, and a short, direct style reference (e.g. "Style BD belge, façon
 * Largo Winch.") — it already knows what that means. A long paraphrase of
 * visual attributes is not more precise, it's noise that crowds out the
 * actual slide content in the prompt.
 */
const NO_TEXT_INSTRUCTION = "Ne pas inclure de texte dans l'image.";

export function buildFinalPrompt(placeholderPrompt: string, styleId?: string): string {
  const style = getStyleById(styleId);
  const size = style?.size ?? "1536x1024";
  const parts = [placeholderPrompt.trim(), formatSizeNote(size)];
  if (style?.promptSuffix) parts.push(style.promptSuffix);
  parts.push(NO_TEXT_INSTRUCTION);
  return parts.filter(Boolean).join(" ");
}
