import type { ImageStylePreset } from "./types.js";
import stylesData from "../../assets/image-styles/styles.json";

export const IMAGE_STYLES: ImageStylePreset[] = stylesData;

export function getStyleById(id?: string): ImageStylePreset | undefined {
  return IMAGE_STYLES.find((s) => s.id === id);
}

export function buildFinalPrompt(placeholderPrompt: string, styleId?: string): string {
  const style = getStyleById(styleId);
  if (!style || !style.promptSuffix) return placeholderPrompt;
  return `${placeholderPrompt} — ${style.promptSuffix}`;
}
