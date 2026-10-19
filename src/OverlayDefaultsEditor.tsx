import type { ComicProject, OverlayType } from "./project";
import type { Locale } from "./settings";
import { overlayDefaults, type OverlayTypography } from "./overlayTypography";
import { OverlayStyleFields } from "./TextBoxStyles";
export function OverlayDefaultsEditor({ project, locale, onChange }: { project: ComicProject; locale: Locale; onChange: (type: OverlayType, value: OverlayTypography) => void }) {
  const sv = locale === "sv";
  return <details className="panel-tool-card"><summary>{sv ? "Standardvärden för text och bubblor" : "Text and bubble defaults"}</summary><p className="quiet">{sv ? "Gäller nya textlager i detta album. Befintliga texter behåller sina värden." : "Applies to new text layers in this album. Existing text keeps its settings."}</p>
    {(["speech","thought","caption","sfx"] as OverlayType[]).map((type,index) => <details key={type}><summary>{(sv ? ["Pratbubbla","Tankebubbla","Berättartext","Ljudeffekt"] : ["Speech","Thought","Caption","Sound effect"])[index]}</summary><OverlayStyleFields type={type} value={overlayDefaults(project,type)} locale={locale} onChange={value => onChange(type,value)} /></details>)}
  </details>;
}
