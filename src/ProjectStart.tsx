import { AlbumCover } from "./AlbumCard";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import type { AlbumSection } from "./AlbumMenu";
import "./projectStart.css";

export type StartRoute = "pages" | "manus" | "storybook";
export type RecentVisit = { id: string; section: AlbumSection };
const RECENT_KEY = "comicbook-ai.recent-albums";
const sections: AlbumSection[] = ["manus", "beats", "storyboard", "images", "pages", "adaptation", "characters", "locations", "scenes"];
export function readRecentVisits(): RecentVisit[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is RecentVisit => typeof v?.id === "string" && sections.includes(v.section)).slice(0, 30) : [];
  } catch { return []; }
}
export function recordRecentVisit(visits: RecentVisit[], id: string, section: AlbumSection) {
  const next = [{ id, section }, ...visits.filter(v => v.id !== id)].slice(0, 30);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* A failed convenience preference must not block album editing. */ }
  return next;
}
export function recentAlbums(projects: ComicProject[], visits: RecentVisit[]) {
  const byId = new Map(projects.map(p => [p.id, p]));
  const visited = visits.flatMap(v => { const p = byId.get(v.id); byId.delete(v.id); return p ? [p] : []; });
  return [...visited, ...[...byId.values()].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))];
}
export function StartIcon({ kind }: { kind: "pages" | "manus" | "storybook" | "open" | "arrow" | "local" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "pages" ? <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 11h18M12 11v10M15 3v8" /></> : kind === "manus" ? <><path d="M14 3H5v18h14v-9M8 8h3M8 12h3M8 16h7M15 5l3-3 3 3-8 8-4 1 1-4z" /></> : kind === "storybook" ? <><path d="M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2v15" /></> : kind === "open" ? <path d="M3 8V5h6l3 3h9v3M3 8h19l-3 12H2L3 8z" /> : kind === "arrow" ? <path d="M4 12h16m-6-6 6 6-6 6" /> : <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 14h18M16 16h2" /></>}
  </svg>;
}
export function ProjectStart({ projects, locale, onStart, onOpen, onBrowse, onRecovery }: {
  projects: ComicProject[]; locale: Locale; onStart: (route: StartRoute) => void; onOpen: (id: string) => void; onBrowse: () => void; onRecovery?: () => void;
}) {
  const sv = locale === "sv", nb = locale === "nb", tr = (s: string, e: string, n = e) => sv ? s : nb ? n : e;
  const cards: { kind: StartRoute | "open"; title: string; text: string; action: string }[] = [
    { kind: "pages", title: tr("Skapa dina sidor direkt", "Create pages directly", "Lag sidene dine direkte"), text: tr("Börja med layouten. Lägg in egna bilder, pratbubblor och berättartext.", "Start with the layout. Add your own images, speech bubbles and captions.", "Start med oppsettet. Legg inn egne bilder, snakkebobler og fortellertekst."), action: tr("Börja bygga sidor", "Start building pages", "Begynn å bygge sider") },
    { kind: "manus", title: tr("Starta med ett manus", "Start with a manuscript", "Start med et manus"), text: tr("Ta din text från berättelseögonblick till bildmanus, bilder och färdiga sidor.", "Take your text from story moments to storyboard, images and finished pages.", "Ta teksten fra fortellingsøyeblikk til bildemanus, bilder og ferdige sider."), action: tr("Börja med din text", "Start with your text", "Begynn med teksten din") },
    { kind: "storybook", title: tr("Importera från StoryBook AI", "Import from StoryBook AI", "Importer fra StoryBook AI"), text: tr("Ta med kapitel, karaktärer och platser från din StoryBook-export.", "Bring in chapters, characters and locations from your StoryBook export.", "Ta med kapitler, karakterer og steder fra StoryBook-eksporten."), action: tr("Välj en exportfil", "Choose an export file", "Velg en eksportfil") },
    { kind: "open", title: tr("Öppna ett projekt", "Open a project", "Åpne et prosjekt"), text: tr("Fortsätt med ett sparat album eller återställ ett projekt från en backup.", "Continue a saved album or restore a project from a backup.", "Fortsett med et lagret album eller gjenopprett et prosjekt fra en sikkerhetskopi."), action: tr("Hitta ditt album", "Find your album", "Finn albumet ditt") },
  ];
  return <section className="project-start" aria-labelledby="project-start-title">
    <header className="project-start-heading"><p className="eyebrow">{tr("Din berättelse. Ditt bildspråk.", "Your story. Your visual language.", "Din fortelling. Ditt bildespråk.")}</p><h1 id="project-start-title">{tr("Var vill du börja?", "Where would you like to start?", "Hvor vil du begynne?")}</h1><p>{tr("Bygg sidor direkt eller låt ett manus bli början på ditt seriealbum.", "Build pages directly or let a manuscript be the start of your comic album.", "Bygg sider direkte eller la et manus bli starten på tegneseriealbumet.")}</p></header>
    <div className="project-start-cards">{cards.map(card => <button type="button" className="project-start-card" key={card.kind} onClick={() => card.kind === "open" ? onBrowse() : onStart(card.kind)}>
      <span className="project-start-icon"><StartIcon kind={card.kind} /></span><span className="project-start-card-copy"><strong>{card.title}</strong><span>{card.text}</span><span className="project-start-action">{card.action}<StartIcon kind="arrow" /></span></span>
    </button>)}</div>
    <section className="project-start-recent" aria-labelledby="project-start-recent-title"><header><h2 id="project-start-recent-title">{tr("Senast öppnade", "Recently opened", "Sist åpnet")}</h2><button type="button" className="text-button" onClick={onBrowse}>{tr("Visa alla projekt", "Show all projects", "Vis alle prosjekter")} →</button></header>
      {projects.length ? <div className="project-start-recent-list">{projects.slice(0,4).map(project => <button type="button" key={project.id} onClick={() => onOpen(project.id)}><AlbumCover project={project} /><span className="project-start-recent-title"><strong>{project.title}</strong>{project.introduction && <span className="album-intro">{project.introduction}</span>}{project.source.type === "storybook" && <span className="album-source-tag">StoryBook AI</span>}<small>{project.style.name} · {project.pages.length} {tr("sidor", "pages", "sider")}</small></span><StartIcon kind="arrow" /></button>)}</div> : <p className="quiet">{tr("Dina album visas här när du har skapat eller öppnat dem.", "Your albums appear here after you create or open them.", "Albumene vises her når du har opprettet eller åpnet dem.")}</p>}
    </section>{onRecovery?<button type="button" className="text-button" onClick={onRecovery}>{tr("Lokala återställningspunkter", "Local recovery points")}</button>:null}<footer className="project-start-footer"><span><StartIcon kind="local" />{tr("Dina projekt sparas lokalt på din dator.", "Your projects are saved locally on your computer.", "Prosjektene lagres lokalt på datamaskinen din.")}</span><span>ComicBook AI</span></footer>
  </section>;
}

export function ProjectChooser({ projects, locale, onOpen, onRestore, onRecovery }: { projects: ComicProject[]; locale: Locale; onOpen: (id: string) => void; onRestore: () => void; onRecovery?: () => void }) {
  const sv = locale === "sv", tr = (s: string, e: string) => sv ? s : e;
  return <div className="project-chooser"><p className="eyebrow">{tr("Dina projekt", "Your projects")}</p><h1 id="project-chooser-title">{tr("Öppna ett projekt", "Open a project")}</h1>
    {projects.length ? <div className="project-chooser-list">{projects.map(project => <button type="button" key={project.id} onClick={() => onOpen(project.id)}><AlbumCover project={project} /><span className="project-chooser-copy"><strong>{project.title}</strong><small>{project.style.name} · {project.pages.length} {tr("sidor", "pages")}</small></span><span>{tr("Öppna", "Open")} →</span></button>)}</div> : <p className="quiet">{tr("Inga sparade album ännu. Skapa ett album eller återställ en backup.", "No saved albums yet. Create an album or restore a backup.")}</p>}
    {onRecovery?<button className="text-button" type="button" onClick={onRecovery}>{tr("Lokala återställningspunkter", "Local recovery points")}</button>:null}
    <section className="project-chooser-backup"><h2>{tr("Har du en albumbackup?", "Have an album backup?")}</h2><p className="quiet">{tr("Återställ backupen som ett nytt album. Dina befintliga projekt finns kvar.", "Restore the backup as a new album. Your existing projects are retained.")}</p><button type="button" className="primary-button" onClick={onRestore}>{tr("Välj albumbackup", "Choose album backup")}</button></section>
  </div>;
}
