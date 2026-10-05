import { albumPageFormat, pageDimensions, PAGE_RENDER_WIDTH, PANEL_BORDER, type PageFormat } from "./pageFormat";
export type PanelBorderStyle = { color: string; thicknessPt: number; visible: boolean };
export function validPanelBorder(value: unknown): value is PanelBorderStyle {
  const b=value as PanelBorderStyle|null;
  return !!b && /^#[0-9a-f]{6}$/i.test(b.color) && Number.isFinite(b.thicknessPt) && b.thicknessPt>=0 && b.thicknessPt<=24 && typeof b.visible==="boolean";
}
export function albumPanelBorder(project: {pageFormat?:PageFormat;panelBorderDefaults?:PanelBorderStyle}): PanelBorderStyle {
  return validPanelBorder(project.panelBorderDefaults)?project.panelBorderDefaults!:{color:"#27211b",thicknessPt:PANEL_BORDER*pageDimensions(albumPageFormat(project)).widthMm/PAGE_RENDER_WIDTH*72/25.4,visible:true};
}
export function panelBorderStyle(project: {pageFormat?:PageFormat;panelBorderDefaults?:PanelBorderStyle}, layer: {panelBorder?:PanelBorderStyle}): PanelBorderStyle {
  return validPanelBorder(layer.panelBorder)?layer.panelBorder!:albumPanelBorder(project);
}
export function panelBorderWidth(project: {pageFormat?:PageFormat;panelBorderDefaults?:PanelBorderStyle}, layer: {panelBorder?:PanelBorderStyle}) {
  const style=panelBorderStyle(project,layer);
  return style.visible?style.thicknessPt*25.4/72*PAGE_RENDER_WIDTH/pageDimensions(albumPageFormat(project)).widthMm:0;
}
