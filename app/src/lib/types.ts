export type LayoutId =
  | "full-bleed-image-text-overlay"
  | "image-half-left"
  | "image-half-right"
  | "text-only";

export interface SlideImage {
  /** Raw prompt seed as written in the brief, before style qualifiers are appended. */
  placeholderPrompt: string;
  /** placeholderPrompt + style preset qualifiers; editable by the user in step 3. */
  finalPrompt?: string;
  styleId?: string;
  /** Netlify Blobs key of the generated asset, once step 4 has run. */
  generatedAssetId?: string;
}

export interface Slide {
  id: string;
  order: number;
  title?: string;
  spokenText: string;
  onScreenText: {
    body: string[];
  };
  layout: LayoutId;
  image?: SlideImage;
  /** Per-slide gate for step 2 (layout/text review). */
  approved: boolean;
}

export interface TimingEntry {
  slideOrder: number;
  targetSeconds: number;
}

export interface ProjectMeta {
  language?: string;
  tone?: string;
  targetDurationMinutes?: number;
  visualPrinciples: string[];
  timingTable: TimingEntry[];
  pivotSlideOrders: number[];
}

export type ProjectStatus =
  | "draft"
  | "layout_review"
  | "prompt_review"
  | "images_ready"
  | "exported";

export interface Project {
  id: string;
  title: string;
  createdAt: string;
  status: ProjectStatus;
  meta: ProjectMeta;
  slides: Slide[];
}

export interface ImageStylePreset {
  id: string;
  label: string;
  promptSuffix: string;
  size: string;
  referenceImages?: string[];
}
