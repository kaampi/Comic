import { useEffect, useRef, useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import { optimizeStylePreview } from "./stylePreview";
import "./albumCard.css";

export type AlbumInfo = Pick<ComicProject, "introduction" | "cover">;
export function AlbumCover({ project }: { project: ComicProject }) {
  return <span className="album-cover">{project.cover ? <img src={project.cover.dataUrl} alt="" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="2" width="18" height="20" rx="2" /><path d="M7 7h10M7 11h10M7 15h6" /></svg>}</span>;
}
export function AlbumCard({ project, locale, onSave, onOpen, onDelete }: {
  project: ComicProject; locale: Locale; onSave: (info: AlbumInfo) => Promise<boolean>; onOpen: () => void; onDelete: () => void;
}) {
  const tr = (sv: string, en: string) => locale === "sv" ? sv : en;
  const [introduction, setIntroduction] = useState(project.introduction ?? "");
  const [cover, setCover] = useState(project.cover);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const revision = useRef(0), mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;revision.current++;};},[]);
  const dirty = introduction !== (project.introduction ?? "") || cover !== project.cover;
  async function save(open = false) {
    setBusy(true);setError("");
    const success = (!dirty && !error) || await onSave({ introduction, cover });
    if(!mounted.current)return;
    setBusy(false);
    if (!success) { setError(tr("Albuminformationen kunde inte sparas. Försök igen.", "Album information could not be saved. Please try again.")); return; }
    setSaved(true);if(open)onOpen();
  }
  async function chooseCover(file?: File) {
    if(!file)return;
    const current = ++revision.current;setBusy(true);setError("");
    try {
      const dataUrl = await optimizeStylePreview(file);
      if(current === revision.current){setCover({name:file.name,dataUrl});setSaved(false);}
    } catch { if(current === revision.current)setError(tr("Bilden kunde inte läsas. Välj en annan bild.", "Could not read the image. Choose another image.")); }
    finally {if(current === revision.current)setBusy(false);}
  }
  return <section className="album-card">
    <header><p className="eyebrow">{tr("Ditt album", "Your album")}</p><h1 id="album-card-title">{project.title}</h1>{project.source.type === "storybook" && <span className="album-source-tag">{tr("Importerad från kaampi Write", "Imported from kaampi Write")}</span>}</header>
    <div className="album-card-body"><div className="album-card-art"><AlbumCover project={{...project,cover}} /><label className="file-picker">{tr("Välj omslagsbild", "Choose cover image")}<input type="file" accept="image/*" disabled={busy} onChange={event=>{void chooseCover(event.target.files?.[0]);event.target.value="";}} /></label>{cover && <button type="button" className="text-button" disabled={busy} onClick={()=>{revision.current++;setCover(undefined);setSaved(false);}}>{tr("Ta bort omslag", "Remove cover")}</button>}</div>
    <div className="album-card-copy"><p className="quiet">{project.style.name} · {project.pages.length} {tr("sidor", "pages")}</p><label>{tr("Kort introduktion", "Short introduction")}<textarea rows={7} maxLength={2000} value={introduction} disabled={busy} placeholder={tr("Vad handlar albumet om?", "What is the album about?")} onChange={event=>{setIntroduction(event.target.value);setSaved(false);}} /></label><p className="quiet">{tr("Omslag och introduktion sparas i ditt kaampi Comic-album.", "The cover and introduction are saved in your kaampi Comic album.")}</p><button className="text-button" type="button" disabled={busy || (!dirty && !error)} onClick={()=>void save()}>{tr("Spara albuminfo", "Save album info")}</button>{saved && !dirty && <p role="status">{tr("Albuminformationen är sparad.", "Album information saved.")}</p>}</div></div>
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" className="album-delete-button text-button" disabled={busy} onClick={onDelete}>{tr("Ta bort album", "Delete album")}</button><button type="button" className="primary-button" disabled={busy} onClick={()=>void save(true)}>{busy ? tr("Arbetar…", "Working…") : tr("Öppna album för redigering", "Open album for editing")} →</button></footer>
  </section>;
}
