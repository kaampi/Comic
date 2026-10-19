import { useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import { libraryEntries } from "./comicPanelLibrary";
import { LIBRARY_DRAG_TYPE } from "./libraryDrop";
import "./PanelLibrary.css";

export function PanelLibrary({
  project,
  pageId,
  placementId,
  locale,
  onAssign,
  onDragStart,
  onDragEnd,
}: {
  project: ComicProject;
  pageId?: string;
  placementId?: string;
  locale: Locale;
  onAssign: (panelId: string) => void;
  onDragStart?: (panelId: string) => void;
  onDragEnd?: () => void;
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
  for(const entry of entries.filter(e=>!unplacedOnly||(!e.pages.length&&!e.parked))){
    const id=entry.beat?.id??entry.panel.id;
    let group=groups.at(-1);
    if(group?.id.split("::")[0]!==id)group=undefined;
    if(!group){group={id:`${id}::${entry.panel.id}`,label:entry.beat?`Beat ${entry.beat.order}`:`${sv?"Bildruta":"Panel"} ${entry.panel.order}`,order:entry.beat?.order??Number.MAX_SAFE_INTEGER,entries:[]};groups.push(group);}
    group.entries.push(entry);
  }


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
      <p className="panel-library-drag-hint">{sv ? "Dra en oplacerad bild till en ruta eller till en tom plats på sidan." : locale === "nb" ? "Dra et uplassert bilde til en rute eller til et tomt sted på siden." : "Drag an unplaced image to a frame or an empty spot on the page."}</p>
      <div className="panel-library-list">
        {groups.map(group=><section className="panel-library-beat" key={group.id} aria-label={group.label}>
          <h4>{group.label}</h4>
          {group.entries.map(entry=><button type="button" className="panel-library-card" data-panel-id={entry.panel.id} key={entry.panel.id} aria-label={entry.title} title={entry.title} disabled={entry.parked||!!entry.pages.length||(!empty&&!entry.image)} draggable={!!entry.image&&!entry.pages.length&&!entry.parked} onClick={()=>{if(empty&&!entry.pages.length&&!entry.parked)onAssign(entry.panel.id);}} onDragStart={event=>{if(!entry.image||entry.pages.length||entry.parked){event.preventDefault();return;}event.dataTransfer.setData(LIBRARY_DRAG_TYPE,JSON.stringify({projectId:project.id,panelId:entry.panel.id}));event.dataTransfer.effectAllowed="copy";onDragStart?.(entry.panel.id);}} onDragEnd={()=>onDragEnd?.()}>
            {entry.image?<img src={entry.image.dataUrl} alt="" draggable={false}/>:<span className="panel-library-placeholder">{sv?"Ingen bild ännu":"No image yet"}</span>}
            <span className="panel-library-info"><small>{entry.parked?(sv?"I panelpool / väntande":"In panel pool / waiting"):entry.pages.length?entry.pages.map(p=>`${sv?"Sida":"Page"} ${p.number}`).join(", "):(sv?"Oplacerad":"Unplaced")}</small></span>
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
        entries.every((e) => e.pages.length || e.parked) && (
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
          <span className="page-frame-heading">{sv ? "Bildruta på sidan" : "Page frame"}</span>
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


