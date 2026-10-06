import type { ComicProject, OverlayType, TextOverlay } from "./project";
export type OverlayTypography = Required<
  Pick<
    TextOverlay,
    | "roundness"
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "textAlign"
    | "textPadding"
  >
>;
export const OVERLAY_FONTS = [
  "Comic Neue, sans-serif",
  "Action Man, sans-serif",
  "Comic Relief, sans-serif",
  "Patrick Hand, cursive",
  "Handlee, cursive",
  "Bad Script, cursive",
  "Gochi Hand, cursive",
  "Rancho, cursive",
  "Impact, sans-serif",
  "Luckiest Guy, cursive",
  "Permanent Marker, cursive",
  "Gloria Hallelujah, cursive",
  "Bubbler One, sans-serif",
  "Fuzzy Bubbles, cursive",
  "Rubik Bubbles, cursive",
];
export function overlayDefaults(
  project: ComicProject,
  type: OverlayType,
): OverlayTypography {
  return {
    roundness: type === "caption" ? 18 : 60,
    fontFamily:
      type === "sfx" ? "Impact, sans-serif" : "Comic Neue, sans-serif",
    fontSize: type === "sfx" ? 28 : 8,
    fontWeight: type === "sfx" ? 800 : 600,
    textAlign: "center",
    textPadding: 4,
    ...project.overlayDefaults?.[type],
  };
}
// Keep authored line breaks, including blank lines; wrap each paragraph independently.
export function wrapOverlayText(text: string, maxChars: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (next.length > maxChars && line) {
        result.push(line);
        line = word;
      } else line = next;
    }
    result.push(line);
  }
  return result;
}

export type MeasureText = (text: string) => number;
// Measure whole candidate lines so proportional letters, spaces and kerning count.
export function wrapOverlayTextToWidth(text: string, width: number, measure: MeasureText): string[] {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= width) { line = candidate; continue; }
      if (line) { result.push(line); line = ""; }
      // An unbroken word must also respect both margins; never shrink the font.
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > width) { result.push(line); line = ""; }
        line += character;
      }
    }
    result.push(line);
  }
  return result;
}

export function overlayFont(overlay: TextOverlay, pixelSize: number): string {
  const weight = overlay.fontWeight ?? (overlay.type === "sfx" ? 800 : 600);
  const family = overlay.fontFamily ?? (overlay.type === "sfx" ? "Impact, sans-serif" : "Comic Neue, sans-serif");
  return `${weight} ${pixelSize}px ${family}`;
}

let measuringContext: CanvasRenderingContext2D | null | undefined;
export function overlayTextMeasure(overlay: TextOverlay, pixelSize: number): MeasureText {
  // The DOM-free fallback supports static rendering and non-browser consumers.
  if (typeof document !== "undefined" && typeof CanvasRenderingContext2D !== "undefined") {
    measuringContext ??= document.createElement("canvas").getContext("2d");
    if (measuringContext) {
      const context = measuringContext;
      const font = overlayFont(overlay, pixelSize);
      return text => { context.font = font; return context.measureText(text).width; };
    }
  }
  return text => Array.from(text).length * pixelSize * .5;
}
