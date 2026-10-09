import { useEffect, useState } from "react";
import { pageSpacing, spacingFitsAlbum, type PageFormat, type PageGrid, type PageSpacing } from "./pageFormat";
import type { Locale } from "./settings";

const keys = ["topMm", "bottomMm", "leftMm", "rightMm", "columnGapMm", "rowGapMm"] as const;
const draftFor = (format: PageFormat) => Object.fromEntries(keys.map(key => [key, String(Math.round(pageSpacing(format)[key] * 1000) / 1000)])) as Record<typeof keys[number], string>;
export function PageSpacingEditor({ format, grids, locale, onChange }: { format: PageFormat; grids: PageGrid[]; locale: Locale; onChange: (spacing: PageSpacing) => void }) {
  const sv = locale === "sv", nb = locale === "nb";
  const [draft, setDraft] = useState(() => draftFor(format)), [error, setError] = useState(false);
  const signature = JSON.stringify(format);
  useEffect(() => { setDraft(draftFor(format)); setError(false); }, [signature]);
  const labels = sv ? ["Överkant (mm)", "Underkant (mm)", "Vänster (mm)", "Höger (mm)", "Mellan kolumner (mm)", "Mellan rader (mm)"] : nb ? ["Overkant (mm)", "Underkant (mm)", "Venstre (mm)", "Høyre (mm)", "Mellom kolonner (mm)", "Mellom rader (mm)"] : ["Top (mm)", "Bottom (mm)", "Left (mm)", "Right (mm)", "Between columns (mm)", "Between rows (mm)"];
  function edit(key: typeof keys[number], value: string) {
    const next = { ...draft, [key]: value }; setDraft(next);
    const spacing = Object.fromEntries(keys.map(key => [key, next[key].trim() === "" ? NaN : Number(next[key])])) as PageSpacing;
    const valid = spacingFitsAlbum({ ...format, spacing }, grids); setError(!valid);
    if (valid) onChange(spacing);
  }
  return <fieldset className="page-spacing-editor">
    <legend>{sv ? "Sidmarginaler och rutmellanrum" : nb ? "Sidemarger og ruteavstand" : "Page margins and panel spacing"}</legend>
    {keys.map((key, index) => <label key={key}>{labels[index]}<input type="number" min="0" max="1000" step="0.1" value={draft[key]} aria-invalid={error || undefined} onChange={e => edit(key, e.currentTarget.value)} /></label>)}
    <p className="quiet">{sv ? "Gäller alla sidor i albumet. Måtten ändrar rutnätet och kan påverka bildbeskärningen. Bakgrunden fyller fortfarande hela sidan." : nb ? "Gjelder alle sider i albumet. Målene endrer rutenettet og kan påvirke bildebeskjæringen. Bakgrunnen fyller fortsatt hele siden." : "Applies to every album page. These dimensions change the grid and may affect image cropping. The background still fills the whole page."}</p>
    {error ? <p role="alert">{sv ? "Ange positiva mått eller noll och lämna plats för alla bildrutor. Ändringen har inte sparats." : nb ? "Angi positive mål eller null og la det være plass til alle bilderutene. Endringen er ikke lagret." : "Enter non-negative dimensions and leave room for all panels. The change has not been saved."}</p> : null}
  </fieldset>;
}
