import type { LayoutId, Project, ProjectMeta, Slide, TimingEntry } from "./types.js";

/**
 * Deterministic Markdown -> Project parser. No LLM call: this only understands
 * the brief schema confirmed in docs/webapp-architecture.md §8.1
 * (# Slide N — Title / ## Texto en pantalla / ## Texto oral / ## Visual impactante,
 * plus a deck-level preamble and trailing timing/principles sections).
 * The optional LLM rewrite pass (restructure-text) is a separate, later step —
 * this function must keep working with it disabled.
 */

interface Section {
  heading: string;
  body: string;
}

const SLIDE_HEADING = /^Slide\s+(\d+)\s*[—-]\s*(.*)$/i;

/** A `# `-prefixed line whose entire text is wrapped in `**bold**` is an in-slide
 * emphasis callout (e.g. `# **ACCEPTENS**`), not a real section heading — a real
 * heading never needs to bold its own text. Without this exception, such lines
 * are misread as new top-level sections and silently truncate the slide. */
function isEmphasisCallout(headingText: string): boolean {
  return /^\*\*.+\*\*$/.test(headingText.trim());
}

function splitTopLevelSections(md: string): Section[] {
  const lines = md.split(/\r?\n/);
  const sections: Section[] = [];
  let heading: string | null = null;
  let buf: string[] = [];

  for (const line of lines) {
    const match = /^#\s+(.+?)\s*$/.exec(line);
    if (match && !isEmphasisCallout(match[1])) {
      if (heading !== null) sections.push({ heading, body: buf.join("\n") });
      heading = match[1];
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (heading !== null) sections.push({ heading, body: buf.join("\n") });
  return sections;
}

function splitSubsections(body: string): Map<string, string> {
  const lines = body.split(/\r?\n/);
  const subs = new Map<string, string>();
  let heading: string | null = null;
  let buf: string[] = [];

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (heading !== null) subs.set(heading, buf.join("\n"));
      heading = match[1];
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (heading !== null) subs.set(heading, buf.join("\n"));
  return subs;
}

function nonEmptyLines(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== "---");
}

function parseOnScreenText(body: string): string[] {
  return nonEmptyLines(body);
}

function parseSpokenText(body: string): string {
  const quoted = body
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith(">"))
    .map((l) => l.replace(/^\s*>\s?/, ""))
    .join("\n")
    .trim();
  return quoted.replace(/^"|"$/g, "").trim();
}

function parseVisual(body: string, order: number): { layout: LayoutId; placeholderPrompt: string } {
  const lines = nonEmptyLines(body);
  let layout: LayoutId | null = null;
  const promptLines: string[] = [];

  for (const line of lines) {
    if (/format\s*a/i.test(line)) {
      layout = "full-bleed-image-text-overlay";
      continue;
    }
    if (/format\s*b/i.test(line)) {
      if (/gauche|left|izquierda/i.test(line)) layout = "image-half-left";
      else if (/droite|right|derecha/i.test(line)) layout = "image-half-right";
      else layout = order % 2 === 0 ? "image-half-right" : "image-half-left";
      continue;
    }
    promptLines.push(line);
  }

  return {
    layout: layout ?? "text-only",
    placeholderPrompt: promptLines.join(" ").trim(),
  };
}

function parsePreamble(section: Section): { title: string; language?: string; tone?: string; targetDurationMinutes?: number } {
  const language = /Langue\s*:\s*([^\n*]+)/i.exec(section.body)?.[1]?.trim();
  const tone = /Ton\s*:\s*([^\n*]+)/i.exec(section.body)?.[1]?.trim();
  const durationMatch = /(\d+)\s*minutes?/i.exec(section.body);
  return {
    title: section.heading,
    language,
    tone,
    targetDurationMinutes: durationMatch ? Number(durationMatch[1]) : undefined,
  };
}

function parseTimingTable(body: string): TimingEntry[] {
  const entries: TimingEntry[] = [];
  const rowPattern = /\|\s*(\d+)\s*\|\s*(\d+):(\d{2})\s*\|/g;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(body))) {
    entries.push({
      slideOrder: Number(match[1]),
      targetSeconds: Number(match[2]) * 60 + Number(match[3]),
    });
  }
  return entries;
}

function parsePrinciples(body: string): { visualPrinciples: string[]; pivotSlideOrders: number[] } {
  const bullets = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => l.replace(/^-\s*/, ""));

  const pivotLine = bullets.find((l) => /pivot/i.test(l));
  const pivotSlideOrders = pivotLine ? Array.from(pivotLine.matchAll(/\d+/g)).map((m) => Number(m[0])) : [];

  return { visualPrinciples: bullets, pivotSlideOrders };
}

export function parseBrief(markdown: string): Project {
  const sections = splitTopLevelSections(markdown);

  const slideSections = sections
    .map((s, index) => ({ s, index, match: SLIDE_HEADING.exec(s.heading) }))
    .filter((x): x is { s: Section; index: number; match: RegExpExecArray } => x.match !== null);

  if (slideSections.length === 0) {
    throw new Error("No '# Slide N — Title' sections found in the brief.");
  }

  const firstSlideIndex = slideSections[0].index;
  const lastSlideIndex = slideSections[slideSections.length - 1].index;

  const preambleSection = firstSlideIndex > 0 ? sections[0] : undefined;
  const trailingSections = sections.slice(lastSlideIndex + 1);

  const preamble = preambleSection ? parsePreamble(preambleSection) : { title: "Untitled project" };

  let timingTable: TimingEntry[] = [];
  let visualPrinciples: string[] = [];
  let pivotSlideOrders: number[] = [];
  for (const section of trailingSections) {
    if (/temporel|timing|répartition/i.test(section.heading)) {
      timingTable = parseTimingTable(section.body);
    }
    if (/principe|principles/i.test(section.heading)) {
      const parsed = parsePrinciples(section.body);
      visualPrinciples = parsed.visualPrinciples;
      pivotSlideOrders = parsed.pivotSlideOrders;
    }
  }

  const slides: Slide[] = slideSections.map(({ s, match }) => {
    const order = Number(match[1]);
    const title = match[2].trim();
    const subs = splitSubsections(s.body);

    const onScreenBody = subs.get("Texto en pantalla") ?? "";
    const spokenBody = subs.get("Texto oral") ?? "";
    const visualBody = subs.get("Visual impactante") ?? "";

    const { layout, placeholderPrompt } = parseVisual(visualBody, order);

    return {
      id: `slide-${order}`,
      order,
      title,
      spokenText: parseSpokenText(spokenBody),
      onScreenText: { body: parseOnScreenText(onScreenBody) },
      layout,
      image: placeholderPrompt ? { placeholderPrompt } : undefined,
      approved: false,
    } satisfies Slide;
  });

  slides.sort((a, b) => a.order - b.order);

  const meta: ProjectMeta = {
    language: preamble.language,
    tone: preamble.tone,
    targetDurationMinutes: preamble.targetDurationMinutes,
    visualPrinciples,
    timingTable,
    pivotSlideOrders,
  };

  const project: Project = {
    id: crypto.randomUUID(),
    title: preamble.title,
    createdAt: new Date().toISOString(),
    status: "draft",
    meta,
    slides,
  };

  return project;
}
