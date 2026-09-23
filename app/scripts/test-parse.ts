import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseBrief } from "../src/lib/parse-brief.js";

const fixturePath = fileURLToPath(new URL("../fixtures/example-brief.md", import.meta.url));
const markdown = readFileSync(fixturePath, "utf-8");

const project = parseBrief(markdown);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok — ${message}`);
  }
}

assert(project.title.includes("Séville"), "deck title extracted");
assert(project.meta.language === "espagnol", `language extracted (got: ${project.meta.language})`);
assert(project.slides.length === 16, `16 slides parsed (got: ${project.slides.length})`);
assert(project.meta.timingTable.length === 16, `16 timing rows parsed (got: ${project.meta.timingTable.length})`);
assert(
  project.meta.pivotSlideOrders.length > 0 && project.meta.pivotSlideOrders.includes(7),
  `pivot slides detected (got: ${project.meta.pivotSlideOrders.join(", ")})`,
);

const slide1 = project.slides.find((s) => s.order === 1)!;
assert(slide1.layout === "full-bleed-image-text-overlay", `slide 1 is Format A (got: ${slide1.layout})`);
assert(slide1.spokenText.startsWith("Hoy voy a hablar"), "slide 1 spoken text extracted");
assert(slide1.onScreenText.body.length > 0, "slide 1 on-screen text extracted");

const slide2 = project.slides.find((s) => s.order === 2)!;
assert(slide2.layout === "image-half-left", `slide 2 is Format B / left (got: ${slide2.layout})`);

// Slides 12, 15, 16 each contain an in-body "# **bold callout**" line, which must
// not be mistaken for a new top-level section (regression check for that bug).
const slide12 = project.slides.find((s) => s.order === 12)!;
assert(slide12.onScreenText.body.some((l) => l.includes("ACCEPTENS")), "slide 12 keeps its content past the '# **ACCEPTENS**' callout");
assert(slide12.spokenText.length > 0, "slide 12 spoken text survives the callout line");
assert(slide12.layout === "image-half-right", `slide 12 is Format B / right (got: ${slide12.layout})`);

const slide15 = project.slides.find((s) => s.order === 15)!;
assert(slide15.spokenText.length > 0, "slide 15 spoken text survives its callout line");
assert(slide15.layout === "full-bleed-image-text-overlay", `slide 15 is Format A (got: ${slide15.layout})`);

const slide16 = project.slides.find((s) => s.order === 16)!;
assert(slide16.onScreenText.body.some((l) => l.includes("preparados")), "slide 16 keeps its content past its callout line");
assert(slide16.spokenText.length > 0, "slide 16 spoken text survives the callout line");

console.log(`\n${project.slides.length} slides, ${project.meta.timingTable.length} timing rows, title: "${project.title}"`);
