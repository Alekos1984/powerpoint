export type LayoutId =
  | "full-bleed-image-text-overlay"
  | "image-half-left"
  | "image-half-right"
  | "text-only";

export interface GeneratedImageEntry {
  /** Netlify Blobs key — unique per generation, so regenerating never overwrites an earlier attempt. */
  assetId: string;
  generatedAt: string;
}

export interface SlideImage {
  /** Raw prompt seed as written in the brief, before style qualifiers are appended. */
  placeholderPrompt: string;
  /** placeholderPrompt + style preset qualifiers; editable by the user in step 3. */
  finalPrompt?: string;
  styleId?: string;
  /** The currently-selected generation — defaults to the newest, but the user can pick an older one from history. */
  generatedAssetId?: string;
  /** Matches whichever entry generatedAssetId points to; cache-busts the asset URL since a regeneration otherwise reuses... (see history). */
  generatedAt?: string;
  /** Every successful generation for this slide, oldest first, so a regeneration doesn't discard earlier attempts. */
  history?: GeneratedImageEntry[];
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
