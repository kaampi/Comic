import { useState } from "react";
import { FontPicker } from "./FontPicker";
import { ColorInput } from "./ColorInput";
import { SvgOverlay } from "./SvgOverlay";
import { overlayDefaults, type OverlayTypography } from "./overlayTypography";
import type { ComicProject, OverlayType, TextOverlay } from "./project";
import { DEFAULT_PAGE_FORMAT, pageGridMetrics, PANEL_BORDER, type PageGrid } from "./pageFormat";
import type { Locale } from "./settings";
import "./textBoxStyles.css";

export function OverlayStyleFields({ type, value, locale, onChange }: { type: OverlayType; value: OverlayTypography; locale: Locale; onChange: (value: OverlayTypography) => void }) {
  const sv = locale === "sv", tr = (s: string, e: string) => sv ? s : e;
  const patch = (part: Partial<OverlayTypography>) => onChange({ ...value, ...part });
  return <div className="overlay-style-fields">
    <FontPicker label="Font" value={value.fontFamily} onChange={fontFamily => patch({ fontFamily })} />
    <label>{tr("Textstorlek (pt)", "Text size (pt)")}<input type="number" min="0.1" max="600" step="0.5" value={value.fontSize} onChange={e => patch({ fontSize: Math.max(.1, Math.min(600, Number(e.target.value))) })} /></label>
    <label>{tr("Textvikt", "Text weight")}<select value={value.fontWeight} onChange={e => patch({ fontWeight: Number(e.target.value) })}>{[300,400,500,600,700,800,900].map(weight => <option key={weight} value={weight}>{weight}</option>)}</select></label>
    <label>{tr("Textjustering", "Text alignment")}<select value={value.textAlign} onChange={e => patch({ textAlign: e.target.value as OverlayTypography["textAlign"] })}>{["left","center","right"].map((align,i) => <option key={align} value={align}>{(sv ? ["Vänster","Centrerad","Höger"] : ["Left","Center","Right"])[i]}</option>)}</select></label>
    <label>{tr("Sidmarginal (%)", "Side padding (%)")}<input type="number" min="0" max="25" value={value.textPadding} onChange={e => patch({ textPadding: Math.max(0, Math.min(25, Number(e.target.value))) })} /></label>
    <label>{tr("Rundning", "Roundness")}<input type="number" min={type === "caption" ? -100 : 0} max="100" value={value.roundness} onChange={e => patch({ roundness: Math.max(type === "caption" ? -100 : 0, Math.min(100, Number(e.target.value))) })} /></label>
    {type === "speech" && <label>{tr("Bubbelform", "Bubble shape")}<select value={value.bubbleStyle ?? "organic"} onChange={e => patch({ bubbleStyle: e.target.value as OverlayTypography["bubbleStyle"] })}>{["organic","wide","tall","shout","whisper"].map((shape,i) => <option key={shape} value={shape}>{(sv ? ["Vanlig","Bred","Hög","Rop","Viskning"] : ["Regular","Wide","Tall","Shout","Whisper"])[i]}</option>)}</select></label>}
    <label>{tr("Textfärg", "Text color")}<ColorInput value={value.textColor ?? "#171411"} onChange={textColor => patch({ textColor })} /></label>
    <label>{tr("Bakgrundsfärg", "Fill color")}<ColorInput value={value.fillColor ?? "#fffdf7"} onChange={fillColor => patch({ fillColor })} /></label>
    <label>{tr("Ramfärg", "Border color")}<ColorInput value={value.strokeColor ?? "#171411"} onChange={strokeColor => patch({ strokeColor })} /></label>
    <label>{tr("Ramtjocklek", "Border width")}<input type="number" min="0" max="20" step="0.5" value={value.strokeWidth ?? 2} onChange={e => patch({ strokeWidth: Math.max(0, Math.min(20, Number(e.target.value))) })} /></label>
    <label>{tr("Bakgrundens opacitet (%)", "Fill opacity (%)")}<input type="number" min="0" max="100" value={Math.round((value.fillOpacity ?? 1) * 100)} onChange={e => patch({ fillOpacity: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })} /></label>
  </div>;
}

export function TextBoxStyles({ defaults, locale, onChange, pageGrid = { gridColumns: 3, gridRows: 5 } }: { pageGrid?: PageGrid; defaults: ComicProject["overlayDefaults"]; locale: Locale; onChange: (defaults: ComicProject["overlayDefaults"]) => void }) {
  const [active, setActive] = useState<"speech"|"thought"|"caption">("speech"), sv = locale === "sv";
  const types = ["speech","thought","caption"] as const;
  const labels = sv ? ["Pratbubbla","Tankebubbla","Berättarruta"] : ["Speech bubble","Thought bubble","Caption box"];
  const samples = sv ? ["Vi har en berättelse att berätta.","Undrar vad som väntar runt hörnet…","En ny berättelse tar sin början."] : ["We have a story to tell.","I wonder what is around the corner…","A new story is about to begin."];
  // A normal new bubble in one grid cell, enlarged as a whole for inspection.
  // Physical point sizes and wrapping match the page editor.
  const cell = pageGridMetrics(pageGrid, DEFAULT_PAGE_FORMAT);
  const metrics = { width: cell.cellWidth - 2 * PANEL_BORDER, height: cell.cellHeight - 2 * PANEL_BORDER, pageWidthMm: 210 };
  const typography = overlayDefaults({ overlayDefaults: defaults }, active);
  return <section className="text-box-styles" aria-label={sv ? "Albumets textutseende" : "Album text styles"}>
    <p className="quiet">{sv ? "Förstorade exempel från en panel. Textstorleken anges i tryckpunkter (pt); på sidan beror visningsstorleken på zoomnivån." : "Enlarged examples from a panel. Text size is in print points (pt); its on-screen size on the page depends on zoom."}</p>
    <div className="text-box-examples">{types.map((type,index) => {
      const value = overlayDefaults({ overlayDefaults: defaults }, type);
      const overlay: TextOverlay = { id: `example-${type}`, type, text: samples[index], x:8, y:8, width:42, height:24, rotation:0, tailEnabled:type === "speech", tailX:42, tailY:40, bubbleStyle:"organic", fillColor:"#fffdf7", fillOpacity:1, strokeColor:"#171411", strokeWidth:2, textColor:"#171411", ...value };
      return <button className={`text-box-example${active === type ? " is-active" : ""}`} type="button" key={type} aria-pressed={active === type} onClick={() => setActive(type)}><strong>{labels[index]}</strong><svg viewBox={`0 0 ${metrics.width * .6} ${metrics.height * .45}`} role="img" aria-label={labels[index]}><g transform={`scale(${metrics.width / 100} ${metrics.height / 100})`}><SvgOverlay overlay={overlay} textMetrics={metrics} /></g></svg><span>{sv ? "Anpassa" : "Customize"} →</span></button>;
    })}</div>
    <div className="text-box-style-editor"><h3>{labels[types.indexOf(active)]}</h3><OverlayStyleFields key={active} type={active} value={typography} locale={locale} onChange={value => onChange({ ...defaults, [active]: value })} /></div>
    <p className="quiet">{sv ? "Det här blir albumets standard för nya textlager. Du kan ändra allt senare i albuminställningarna." : "These are the album defaults for new text layers. You can change everything later in album settings."}</p>
  </section>;
}
