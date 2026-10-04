import type { LayoutRect } from "./pageTemplates";
import type { Locale } from "./settings";
export const PANEL_CORNERS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export type PanelCorner = (typeof PANEL_CORNERS)[number];
export function resizeFromCorner(
  rect: LayoutRect,
  corner: PanelCorner,
  dx: number,
  dy: number,
  columns: number,
  rows: number,
): LayoutRect {
  const left = corner.endsWith("left"),
    top = corner.startsWith("top");
  const x = left
    ? Math.max(0, Math.min(rect.x + rect.width - 1, rect.x + Math.round(dx)))
    : rect.x;
  const y = top
    ? Math.max(0, Math.min(rect.y + rect.height - 1, rect.y + Math.round(dy)))
    : rect.y;
  const right = left
    ? rect.x + rect.width
    : Math.max(
        rect.x + 1,
        Math.min(columns, rect.x + rect.width + Math.round(dx)),
      );
  const bottom = top
    ? rect.y + rect.height
    : Math.max(
        rect.y + 1,
        Math.min(rows, rect.y + rect.height + Math.round(dy)),
      );
  return { x, y, width: right - x, height: bottom - y };
}
export function layoutControlsText(locale: Locale) {
  return locale === "sv"
    ? {
        hint: "Klicka på en ruta och dra i hörnen. Hörnen fäster i rutnätet. Klicka utanför för att avmarkera; dra över tom yta för att skapa en ruta.",
        resize: "Ändra ruta",
        corners: [
          "övre vänstra hörnet",
          "övre högra hörnet",
          "nedre vänstra hörnet",
          "nedre högra hörnet",
        ],
      }
    : locale === "nb"
      ? {
          hint: "Velg en rute og dra i hjørnene. Hjørnene festes til rutenettet. Klikk utenfor for å fjerne markeringen; dra over tom plass for å lage en rute.",
          resize: "Endre rute",
          corners: [
            "øvre venstre hjørne",
            "øvre høyre hjørne",
            "nedre venstre hjørne",
            "nedre høyre hjørne",
          ],
        }
      : {
          hint: "Select a panel and drag its corners to snap to the grid. Click outside to deselect; drag across empty space to draw a panel.",
          resize: "Resize panel",
          corners: [
            "top left corner",
            "top right corner",
            "bottom left corner",
            "bottom right corner",
          ],
        };
}
