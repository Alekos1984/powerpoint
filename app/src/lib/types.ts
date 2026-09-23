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
  /** ISO timestamp of the last successful generation — used to cache-bust the asset URL on regeneration, since the blob key itself is stable. */
  generatedAt?: string;
  /** Set when the step-4 generation call failed for this slide; cleared on a successful (re)generation. */
  generationError?: string;
}

export type ReviewStatus = "pending" | "approved" | "needs_changes";

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
  /** Per-slide gate for step 2 (text/layout review). */
  reviewStatus: ReviewStatus;
  /** What the user wants changed when reviewStatus is "needs_changes" — consumed by a future LLM rewrite pass. */
  feedback?: string;
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

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: string;
  status: ProjectStatus;
  slideCount: number;
  approvedCount: number;
}

export interface ImageStylePreset {
  id: string;
  label: string;
  promptSuffix: string;
  size: string;
  referenceImages?: string[];
}
