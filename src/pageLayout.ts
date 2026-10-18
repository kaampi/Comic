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
        moveHint: "Håll musknappen nedtryckt på en ruta i 0,4 sekunder och dra för att flytta den. Esc avbryter. Stäng av formredigering för att flytta.",
        reducedMotion: "Geléeffekten är avstängd av systemets inställning för minskad rörelse.",
        moving: "Flytta rutan och släpp för att placera. Esc avbryter.",
        invalidMove: "Här får rutan inte plats. Släpp för att behålla den gamla placeringen, eller dra vidare.",
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
          moveHint: "Hold museknappen på en rute i 0,4 sekunder og dra for å flytte. Esc avbryter. Slå av formredigering for å flytte.",
          reducedMotion: "Geleeffekten er slått av av systemets innstilling for redusert bevegelse.",
          moving: "Flytt ruten og slipp for å plassere. Esc avbryter.",
          invalidMove: "Ruten får ikke plass her. Slipp for å beholde den gamle plasseringen, eller dra videre.",
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
          moveHint: "Hold a panel for 0.4 seconds, then drag to move it. Esc cancels. Turn off shape editing to move panels.",
          reducedMotion: "Jelly motion is disabled by your system’s reduced motion setting.",
          moving: "Drag the panel, then release to place it. Esc cancels.",
          invalidMove: "The panel does not fit here. Release to keep its original position, or drag elsewhere.",
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

