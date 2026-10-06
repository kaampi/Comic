import { useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import { libraryEntries } from "./comicPanelLibrary";
import "./PanelLibrary.css";

export function PanelLibrary({
  project,
  pageId,
  placementId,
  locale,
  onAssign,
}: {
  project: ComicProject;
  pageId?: string;
  placementId?: string;
  locale: Locale;
  onAssign: (panelId: string) => void;
}) {
  const [unplacedOnly, setUnplacedOnly] = useState(false);
  const sv = locale === "sv";
  const page = project.pages.find((p) => p.id === pageId);
  const target =
    page && page.background?.id === placementId && page.background
      ? page.background
      : page?.placements.find((p) => p.id === placementId);
  const entries = libraryEntries(project);
  const empty = !!target && !target.panelId && !target.adaptationPanelPlanId;
  const groups: Array<{id:string;label:string;order:number;entries:typeof entries}>=[];
  for(const entry of entries.filter(e=>!unplacedOnly||!e.pages.length)){
    const id=entry.beat?.id??entry.panel.id;
    let group=groups.find(g=>g.id===id);
    if(!group){group={id,label:entry.beat?`Beat ${entry.beat.order}`:`${sv?"Bildruta":"Panel"} ${entry.panel.order}`,order:entry.beat?.order??Number.MAX_SAFE_INTEGER,entries:[]};groups.push(group);}
    group.entries.push(entry);
  }
  groups.sort((a,b)=>a.order-b.order);

  return (
    <section
      className="panel-library"
      aria-label={sv ? "Bildbibliotek" : "Image library"}
    >
      <h3>
        {sv ? "Bildbibliotek" : "Image library"} <span>{entries.length}</span>
      </h3>
      <label className="panel-library-filter">
        <input
          type="checkbox"
          checked={unplacedOnly}
          onChange={(e) => setUnplacedOnly(e.target.checked)}
        />
        {sv ? "Visa bara oplacerade" : "Show unplaced only"}
      </label>
      <div className="panel-library-list">
        {groups.map(group=><section className="panel-library-beat" key={group.id} aria-label={group.label}>
          <h4>{group.label}</h4>
          {group.entries.map(entry=><button type="button" className="panel-library-card" data-panel-id={entry.panel.id} key={entry.panel.id} aria-label={entry.title} title={entry.title} disabled={!empty||!!entry.pages.length} onClick={()=>onAssign(entry.panel.id)}>
            {entry.image?<img src={entry.image.dataUrl} alt=""/>:<span className="panel-library-placeholder">{sv?"Ingen bild ännu":"No image yet"}</span>}
            <span className="panel-library-info"><small>{entry.pages.length?entry.pages.map(p=>`${sv?"Sida":"Page"} ${p.number}`).join(", "):(sv?"Oplacerad":"Unplaced")}</small></span>
          </button>)}
        </section>)}
      </div>
      {!entries.length && (
        <p className="quiet">
          {sv
            ? "Skapa rutor i manusvyn för att fylla biblioteket."
            : "Create panels in the manuscript to fill the library."}
        </p>
      )}
      {unplacedOnly &&
        entries.length > 0 &&
        entries.every((e) => e.pages.length) && (
          <p className="quiet">
            {sv ? "Alla rutor är placerade." : "All panels are placed."}
          </p>
        )}
    </section>
  );
}


export function PageFramePicker({project,pageId,placementId,locale,onSelect}:{project:ComicProject;pageId:string;placementId?:string;locale:Locale;onSelect:(id:string)=>void}) {
  const sv=locale==="sv";
  const page=project.pages.find(p=>p.id===pageId);
  const target=page&&page.background?.id===placementId&&page.background?page.background:page?.placements.find(p=>p.id===placementId);
  return <div className="page-frame-picker">
      {page && (
        <label>
          {sv ? "Bildruta på sidan" : "Page frame"}
          <select
            aria-label={sv ? "Bildruta på sidan" : "Page frame"}
            value={
              target?.id === page?.background?.id && target
                ? "__background__"
                : (target?.id ?? "")
            }
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="">{sv ? "Välj bildruta…" : "Choose frame…"}</option>
            <option value="__background__">
              {sv ? "Sidans bakgrund" : "Page background"}
            </option>
            {page.placements.map((p) => (
              <option key={p.id} value={p.id}>
                {sv ? "Ruta" : "Frame"} {p.readingOrder}
                {p.panelId || p.adaptationPanelPlanId
                  ? sv
                    ? " · placerad"
                    : " · filled"
                  : ""}
              </option>
            ))}
          </select>
        </label>
      )}
  </div>;
}
