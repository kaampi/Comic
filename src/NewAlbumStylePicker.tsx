import { useId, useState } from "react";
import { STYLE_GROUPS, styleGroupLabel, type IllustrationStyle } from "./stylesLibrary";
import { builtinTags } from "./styleOrganization";
import type { Locale } from "./settings";
import "./newAlbumStylePicker.css";

function Preview({ style, locale }: { style: IllustrationStyle; locale: Locale }) {
  const [failed, setFailed] = useState(false);
  const src = style.previewImage || style.linePreviewImage;
  return src && !failed ? <img src={src} alt={style.name} loading="lazy" onError={() => setFailed(true)} /> : <span className="new-style-missing">{locale === "sv" ? "Ingen exempelbild ännu" : "No example image yet"}</span>;
}
export function NewAlbumStylePicker({ styles, value, locale, onChange }: { styles: IllustrationStyle[]; value: string; locale: Locale; onChange: (id: string) => void }) {
  const sv = locale === "sv", tr = (s: string, e: string) => sv ? s : e;
  const selected = styles.find(s => s.id === value);
  const groups = [...new Set([...STYLE_GROUPS, ...styles.map(s => s.genre)])].filter(g => styles.some(s => s.genre === g));
  const [openGroup, setOpenGroup] = useState<string | null>(() => selected?.genre ?? groups[0] ?? null);
  const prefix = useId();
  return <section className="new-album-style-picker" aria-labelledby={`${prefix}-title`}>
    <header className="new-style-heading"><h2 id={`${prefix}-title`}>{tr("Välj albumets bildstil", "Choose the album's visual style")}</h2><p>{tr("Öppna en grupp och jämför de stora exempelbilderna. Klicka på en stil för att välja den.", "Open a group and compare the large examples. Click a style to select it.")}</p></header>
    {selected && <div className="new-style-selected" role="status"><div className="new-style-selected-preview"><Preview key={selected.id} style={selected} locale={locale} /></div><div><span>{tr("Vald bildstil", "Selected visual style")}</span><strong>{selected.name}</strong><small>{styleGroupLabel(selected.genre,locale)}</small></div><span className="new-style-selected-check" aria-hidden="true">✓</span></div>}
    <div className="new-style-groups">{groups.map((group, index) => {
      const members = styles.filter(s => s.genre === group), open = group === openGroup;
      return <section className="new-style-group" key={group}><h3><button type="button" id={`${prefix}-group-${index}`} aria-expanded={open} aria-controls={`${prefix}-panel-${index}`} onClick={() => setOpenGroup(open ? null : group)}><span className="new-style-chevron" aria-hidden="true">{open ? "−" : "+"}</span><span>{styleGroupLabel(group,locale)}</span><small>{members.length} {tr("stilar", "styles")}{selected?.genre === group ? " · ✓" : ""}</small></button></h3>
        <div id={`${prefix}-panel-${index}`} role="region" aria-labelledby={`${prefix}-group-${index}`} hidden={!open}>{open && <fieldset className="new-style-grid"><legend className="visually-hidden">{tr("Bildstil", "Visual style")} · {styleGroupLabel(group,locale)}</legend>{members.map(style => <label className={`new-style-choice${style.id === value ? " is-selected" : ""}`} key={style.id}><input type="radio" name={`${prefix}-style`} value={style.id} checked={style.id === value} onChange={() => onChange(style.id)} /><span className="new-style-image"><Preview key={style.id} style={style} locale={locale} /></span><span className="new-style-choice-info"><strong>{style.name}</strong><small>{builtinTags(style,sv).join(" · ")}</small>{style.visualReferences?.length ? <small>{style.visualReferences.join(" · ")}</small> : null}</span><span className="new-style-choice-check">{style.id === value ? tr("✓ Vald", "✓ Selected") : tr("Välj stil", "Select style")}</span></label>)}</fieldset>}</div>
      </section>;
    })}</div>
    <p className="new-style-note">{tr("Stilen kopieras till albumet. Du kan ändra den senare i albuminställningarna.", "The style is copied into the album. You can change it later in album settings.")}</p>
  </section>;
}
