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
  "Patrick Hand, cursive",
  "Handlee, cursive",
  "Bad Script, cursive",
  "Gochi Hand, cursive",
  "Rancho, cursive",
  "Impact, sans-serif",
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
