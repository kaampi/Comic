import { pageDimensions, type PageFormat } from "./pageFormat";
import type { Locale } from "./settings";
export function PageFormatEditor({value, onChange, locale}: {value: PageFormat; onChange: (value: PageFormat) => void; locale: Locale}) {
  const sv = locale === "sv", d = pageDimensions(value);
  return <fieldset><legend>{sv ? "Sidformat" : "Page format"}</legend>
    <label>{sv ? "Format" : "Size"}<select value={value.preset} onChange={e => onChange({...value, preset:e.target.value as PageFormat["preset"]})}><option value="a4">A4</option><option value="letter">Letter</option><option value="custom">{sv ? "Eget format" : "Custom"}</option></select></label>
    <label>{sv ? "Orientering" : "Orientation"}<select value={value.orientation} onChange={e => onChange({...value, orientation:e.target.value as PageFormat["orientation"]})}><option value="portrait">{sv ? "Stående" : "Portrait"}</option><option value="landscape">{sv ? "Liggande" : "Landscape"}</option></select></label>
    {value.preset === "custom" ? (["widthMm", "heightMm"] as const).map((key,i) => <label key={key}>{(sv ? ["Bredd (mm)", "Höjd (mm)"] : ["Width (mm)", "Height (mm)"])[i]}<input type="number" min="20" max="1000" step="0.1" value={value[key]} onChange={e => onChange({...value, [key]:Math.max(20,Math.min(1000,Number(e.target.value)||20))})}/></label>) : null}
    <p className="quiet">{d.widthMm} × {d.heightMm} mm</p>
  </fieldset>;
}
