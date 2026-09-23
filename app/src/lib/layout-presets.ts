import type { LayoutId } from "./types.js";

export interface LayoutPreset {
  id: LayoutId;
  label: string;
  cssClass: string;
}

export const LAYOUT_PRESETS: Record<LayoutId, LayoutPreset> = {
  "full-bleed-image-text-overlay": {
    id: "full-bleed-image-text-overlay",
    label: "Format A — image plein écran",
    cssClass: "layout-full-bleed",
  },
  "image-half-left": {
    id: "image-half-left",
    label: "Format B — image 50% (gauche)",
    cssClass: "layout-half-left",
  },
  "image-half-right": {
    id: "image-half-right",
    label: "Format B — image 50% (droite)",
    cssClass: "layout-half-right",
  },
  "text-only": {
    id: "text-only",
    label: "Texte seul",
    cssClass: "layout-text-only",
  },
};
