import { resolveColorMode, stylePromptForMode, grayscaleModifier } from "../styleColorMode";
import type { ComicProject } from "../project";
import type { ImagePrompt, PanelPlan } from "./types";

const id = (prefix: string) => prefix + "-" + crypto.randomUUID();
const lineOnlyModifier = "Rendering mode: line art only, black ink drawing, clean contour lines and controlled hatching, no color, no painted fills, no grayscale wash, no colored lighting. Preserve the chosen comic style through line quality, shape language, anatomy, expression, composition, and background detail.";

export const CAMERA_ANGLES = {
  "eye-level": "Eye-level camera angle",
  "low-angle": "Low camera angle",
  "high-angle": "High camera angle",
  "worms-eye": "Extreme low-angle worm's-eye view",
  "birds-eye": "Bird's-eye view",
  "dutch-angle": "Tilted Dutch angle",
  "top-down": "Overhead top-down view",
};
export const LENSES = {
  "14mm": "Dramatic ultra-wide perspective (14mm reference), exaggerated near-to-far scale",
  "24mm": "Wide-angle perspective (24mm reference), broad view and clear depth",
  "50mm": "Balanced natural perspective (50mm reference)",
  "85mm": "Compressed perspective (85mm reference), background appears closer",
  "200mm": "Strongly compressed perspective (200mm reference), flattened depth",
};
export const DEPTHS = {
  deep: "Deep depth of field, foreground and background remain sharp",
  shallow: "Shallow depth of field, soft background",
  macro: "Isolate a small foreground detail with macro depth of field",
};
export const EFFECTS = {
  speed_lines: "Dynamic speed lines",
  motion_blur: "Directional motion blur",
  zoom_blur: "Radial zoom blur",
  halftone_dots: "Ben-Day halftone dots in shadows",
  lens_flare: "Lens flare and light bleed",
  chromatic_aberration: "Chromatic aberration with color-separated edges",
  double_exposure: "Ghosted motion trails",
  glitch_scanlines: "Digital glitch distortion and horizontal scanlines",
};
function option(options: Record<string, string>, key?: string) { return key ? options[key] ?? "" : ""; }
const text = (value?: string) => typeof value === "string" ? value.trim() : "";

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
  const direction = panel.promptDirection;
  const scene = [
    "Comic panel illustration.",
    panel.visualDescription.trim(),
    panel.shotType ? `Shot: ${panel.shotType}.` : "",
    panel.sizeHint ? `Composition should read clearly in a ${panel.sizeHint} comic panel.` : "",
    characterText(project, panel.characterIds) ? `Characters: ${characterText(project, panel.characterIds)}.` : "",
    locationText(project, panel.locationId) ? `Location: ${locationText(project, panel.locationId)}.` : ""
  ];
  const global = project.promptStyle;
  const style = [
    `Illustration style: ${text(global?.medium) || stylePromptForMode(project.style, colorMode)}`,
    text(global?.lines) ? `Lines, brushwork and form: ${text(global?.lines)}` : "",
    colorMode === "color" && text(global?.color) ? `Color and shading: ${text(global?.color)}` : "",
    text(global?.texture) ? `Texture and finish: ${text(global?.texture)}` : "",
  ].filter(Boolean).join("\n");
  const requirements = [
    "Preserve character identity and clothing continuity with adjacent panels.",
    "Leave natural negative space for later speech balloons or captions.",
    project.style.decorativeSeals
      ? "Do not render dialogue, narrative text, speech bubbles, watermarks, or UI. Peripheral decorative calligraphic marks and red seal impressions are allowed."
      : "Do not render dialogue, captions, lettering, speech bubbles, watermarks, signatures, or UI."
  ];
  if (direction || global) {
    const location = text(direction?.setting) || locationText(project, panel.locationId);
    const characters = project.characters.filter(c => panel.characterIds.includes(c.id)).map(c =>
      [`${c.name}: ${text(c.visualIdentity) || text(c.description) || c.name}.`, text(direction?.characterActions?.[c.id]) ? `Action and pose: ${text(direction?.characterActions?.[c.id])}` : ""].filter(Boolean).join("\n")
    );
    const camera = [panel.shotType ? `Shot: ${panel.shotType}.` : "", option(CAMERA_ANGLES, direction?.cameraAngle), option(LENSES, direction?.lens), option(DEPTHS, direction?.depthOfField), text(direction?.focalPoint) ? `Visual focal point: ${text(direction?.focalPoint)}. This is the compositional emphasis, not a requirement to blur other areas.` : "", panel.sizeHint ? `Composition should read clearly in a ${panel.sizeHint} comic panel.` : ""].filter(Boolean);
    const effects = (direction?.effects ?? []).filter(key => colorMode === "color" || key !== "chromatic_aberration").map(key => option(EFFECTS, key)).filter(Boolean);
    return [
      "-- MODULE 1: GLOBAL STYLE --", style, renderingMode,
      ...(camera.length ? ["-- MODULE 2: CAMERA & COMPOSITION --", ...camera, "Interpret perspective and focus within the chosen illustration style."] : []),
      ...(effects.length ? ["-- MODULE 3: SPECIAL EFFECTS --", `${effects.join(", ")}. Strength: ${direction?.effectStrength ?? "normal"}. Apply to: ${direction?.effectScope ?? "background"}. Preserve readability of faces and important objects; avoid duplicating textures already present in the album style.`] : []),
      "-- MODULE 4: SUBJECT & ACTION --", "Comic panel illustration.", ...characters,
      `Action and staging: ${text(panel.visualDescription)}`,
      location ? `Environment: ${location}` : "",
      text(direction?.lighting) ? `Scene lighting: ${text(direction?.lighting)}` : "",
      text(direction?.continuity) ? `Current scene continuity: ${text(direction?.continuity)}` : "",
      ...requirements,
    ].filter(Boolean).join("\n");
  }
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


