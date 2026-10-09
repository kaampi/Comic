import { resolveColorMode, stylePromptForMode, grayscaleModifier } from "../styleColorMode";
import type { ComicProject } from "../project";
import type { ImagePrompt, PanelPlan } from "./types";

const id = (prefix: string) => prefix + "-" + crypto.randomUUID();
const lineOnlyModifier = "Rendering mode: line art only, black ink drawing, clean contour lines and controlled hatching, no color, no painted fills, no grayscale wash, no colored lighting. Preserve the chosen comic style through line quality, shape language, anatomy, expression, composition, and background detail.";

function characterText(project: ComicProject, ids: string[]): string {
  return ids.map((cid) => project.characters.find((c) => c.id === cid)).filter(Boolean).map((c) => {
    const identity = c!.visualIdentity?.trim() || c!.description?.trim();
    return identity ? `${c!.name}: ${identity}` : c!.name;
  }).join(". ");
}

function locationText(project: ComicProject, locationId?: string): string {
  if (!locationId) return "";
  const location = project.locations.find((l) => l.id === locationId);
  if (!location) return "";
  const identity = location.visualIdentity?.trim() || location.description?.trim();
  return identity ? `${location.name}: ${identity}` : location.name;
}

export function buildImagePrompt(project: ComicProject, panel: PanelPlan, mode: ImagePrompt["mode"] = "full"): string {
  const colorMode = resolveColorMode(project.style, project.renderOptions);
  const renderingMode = colorMode === "line-art" ? lineOnlyModifier : colorMode === "grayscale" ? grayscaleModifier : "";
  const scene = [
    "Comic panel illustration.",
    panel.visualDescription.trim(),
    panel.shotType ? `Shot: ${panel.shotType}.` : "",
    panel.sizeHint ? `Composition should read clearly in a ${panel.sizeHint} comic panel.` : "",
    characterText(project, panel.characterIds) ? `Characters: ${characterText(project, panel.characterIds)}.` : "",
    locationText(project, panel.locationId) ? `Location: ${locationText(project, panel.locationId)}.` : ""
  ];
  const style = `Illustration style: ${stylePromptForMode(project.style, colorMode)}`;
  const requirements = [
    "Preserve character identity and clothing continuity with adjacent panels.",
    "Leave natural negative space for later speech balloons or captions.",
    project.style.decorativeSeals
      ? "Do not render dialogue, narrative text, speech bubbles, watermarks, or UI. Peripheral decorative calligraphic marks and red seal impressions are allowed."
      : "Do not render dialogue, captions, lettering, speech bubbles, watermarks, signatures, or UI."
  ];
  return [
    ...(mode === "short" ? scene.slice(0, 4) : scene),
    style, renderingMode,
    ...(mode === "short" ? requirements.slice(-1) : requirements)
  ].filter(Boolean).join(" ");
}

export function generateImagePrompts(project: ComicProject, panels: PanelPlan[], mode: ImagePrompt["mode"] = "full"): ImagePrompt[] {
  const now = new Date().toISOString();
  return panels.map((panel) => ({
    id: id("image-prompt"),
    panelId: panel.id,
    mode,
    prompt: buildImagePrompt(project, panel, mode),
    negativePrompt: [
      resolveColorMode(project.style, project.renderOptions) === "line-art" ? "color, colored fills, painted rendering, grayscale wash" : resolveColorMode(project.style, project.renderOptions) === "grayscale" ? "color, sepia, colored accents, tinted paper" : "",
      project.style.decorativeSeals ? "dialogue, narrative text, speech bubbles, captions, watermark, UI" : "text, lettering, speech bubbles, captions, watermark, signature, UI"
    ].filter(Boolean).join(", "),
    createdAt: now,
    updatedAt: now
  }));
}

