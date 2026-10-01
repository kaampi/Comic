import { useEffect, useRef, useState } from "react";
import { AI_MODES, type AiMode } from "./ai";
import { applyLocale, applyTheme, LOCALES, readLocale, readTheme, type Locale, type Theme } from "./settings";
import { BUILTIN_STYLES, STYLE_GENRES, createCustomStyleId, readCustomStyles, saveCustomStyles, type IllustrationStyle } from "./stylesLibrary";
import { createProject, readProjects, saveProjects, type ComicProject, type ProjectSource } from "./project";

type Panel = "styles" | "guide" | "settings" | "new-project" | null;
type StyleDraft = { id?: string; name: string; genre: string; promptText: string };

export function App() {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [aiMode, setAiMode] = useState<AiMode>("prompt");
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [styleGenre, setStyleGenre] = useState("Alla");
  const [styleQuery, setStyleQuery] = useState("");
  const [customStyles, setCustomStyles] = useState<IllustrationStyle[]>(readCustomStyles);
  const [styleDraft, setStyleDraft] = useState<StyleDraft | null>(null);
  const [projects, setProjects] = useState<ComicProject[]>(readProjects);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newSource, setNewSource] = useState<ProjectSource>("blank");
  const [newStyleId, setNewStyleId] = useState(BUILTIN_STYLES[0].id);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { applyLocale(locale); }, [locale]);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    if (!projectMenuOpen) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setProjectMenuOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [projectMenuOpen]);

  const closePanel = () => setPanel(null);
  const allStyles = [...BUILTIN_STYLES, ...customStyles];
  const visibleStyles = allStyles.filter((style) => {
    const genreMatch = styleGenre === "Alla" || style.genre === styleGenre;
    const q = styleQuery.trim().toLowerCase();
    return genreMatch && (!q || style.name.toLowerCase().includes(q) || style.promptText.toLowerCase().includes(q));
  });
  const persistCustomStyles = (next: IllustrationStyle[]) => { setCustomStyles(next); saveCustomStyles(next); };
  const saveDraft = () => {
    if (!styleDraft || !styleDraft.name.trim() || !styleDraft.promptText.trim()) return;
    const style: IllustrationStyle = { id: styleDraft.id ?? createCustomStyleId(), name: styleDraft.name.trim(), genre: styleDraft.genre.trim() || "Custom", promptText: styleDraft.promptText.trim() };
    persistCustomStyles(styleDraft.id ? customStyles.map((item) => item.id === styleDraft.id ? style : item) : [...customStyles, style]);
    setStyleDraft(null);
  };
  const duplicateStyle = (style: IllustrationStyle) => setStyleDraft({ name: style.name + " – kopia", genre: style.genre, promptText: style.promptText });
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const createNewProject = () => {
    if (!newTitle.trim()) return;
    const style = allStyles.find((item) => item.id === newStyleId) ?? BUILTIN_STYLES[0];
    const project = createProject(newTitle, newSource, style);
    const next = [project, ...projects]; setProjects(next); saveProjects(next); setActiveProjectId(project.id);
    setNewTitle(""); setNewSource("blank"); setPanel(null); setProjectMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={closePanel} aria-label="Gå till startsidan">
          <span className="brand-mark" aria-hidden="true">CB</span><span>ComicBook AI</span>
        </button>
        <div className="top-menu" ref={menuRef}>
          <button className="text-button" type="button" aria-expanded={projectMenuOpen} onClick={() => setProjectMenuOpen((open) => !open)}>Projekt</button>
          {projectMenuOpen ? <div className="menu-panel" role="menu">
            <button role="menuitem" type="button" className="menu-item" onClick={() => { setPanel("new-project"); setProjectMenuOpen(false); }}>Nytt seriealbum</button>
            {projects.length ? <><div className="menu-divider" />{projects.slice(0, 5).map((project) => <button key={project.id} role="menuitem" type="button" className="menu-item" onClick={() => { setActiveProjectId(project.id); setProjectMenuOpen(false); }}>{project.title}</button>)}</> : <><div className="menu-divider" /><span className="menu-empty">Inga senaste projekt ännu</span></>}
            <div className="menu-divider" /><button role="menuitem" type="button" className="menu-item" onClick={() => { setActiveProjectId(null); setProjectMenuOpen(false); }}>Visa alla projekt</button>
          </div> : null}
        </div>
        <button className="text-button" type="button" onClick={() => setPanel("styles")}>Stillmallar</button>
        <button className="text-button" type="button" onClick={() => setPanel("guide")}>Guide</button>
        <button className="text-button" type="button" onClick={() => setPanel("settings")}>Inställningar</button>
        <div className="top-chrome">
          <label className="locale-select"><span className="visually-hidden">Språk</span>
            <select value={locale} aria-label="Språk" onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <button className={theme === "light" ? "text-button theme-toggle is-on" : "text-button theme-toggle"} type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "Mörkt" : "Ljust"}</button>
        </div>
      </header>

      <main className="home">
        {activeProject ? <section className="project-workspace">
          <p className="eyebrow">SERIEPROJEKT</p><h1>{activeProject.title}</h1>
          <p className="lede">Stil: {activeProject.style.name}</p>
          <nav className="project-tabs" aria-label="Projektinnehåll"><button className="is-active">Manus</button><button>Karaktärer</button><button>Platser</button><button>Scener</button><button>Sidor</button></nav>
          <section className="workspace-card"><h2>Projektet är redo.</h2><p className="quiet">Nästa steg är att lägga till källtext och bryta ned den i scener och bildrutor.</p></section>
        </section> : <>
          <header className="home-brand"><p className="eyebrow">COMIC CREATION WORKSPACE</p><h1>Från berättelse<br />till seriealbum.</h1>
            <p className="lede">Planera bildrutor, bygg konsekventa bildprompter och skapa din serie utan att låsa projektet till en viss AI-tjänst.</p></header>
          <section className="workspace-card"><div className="card-heading"><div><p className="eyebrow">DINA PROJEKT</p><h2>{projects.length ? "Fortsätt där du slutade." : "Skapa ditt första seriealbum."}</h2></div>
            <button className="primary-button" type="button" onClick={() => setPanel("new-project")}>Nytt seriealbum</button></div>
            {projects.length ? <div className="project-list">{projects.map((project) => <button key={project.id} type="button" onClick={() => setActiveProjectId(project.id)}><strong>{project.title}</strong><span>{project.style.name}</span></button>)}</div> : <p className="quiet">Projekt lagras lokalt och är helt fristående från StoryBook.</p>}
          </section>
        </>}
      </main>

      {panel ? <div className="overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closePanel()}>
        <article className="guide-card" role="dialog" aria-modal="true">
          <div className="guide-actions"><button className="text-button" type="button" onClick={closePanel}>Stäng</button></div>
          {panel === "new-project" ? <><p className="eyebrow">NYTT PROJEKT</p><h1>Nytt seriealbum</h1>
            <div className="new-project-form"><label>Projektnamn<input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="T.ex. Mysteriet på Svartön" /></label>
              <fieldset><legend>Utgångsmaterial</legend>
                <label><input type="radio" checked={newSource === "blank"} onChange={() => setNewSource("blank")} /> Börja från tomt projekt</label>
                <label className="disabled-choice"><input type="radio" disabled /> Importera text/manus <small>nästa steg</small></label>
                <label className="disabled-choice"><input type="radio" disabled /> Importera från StoryBook <small>nästa steg</small></label>
              </fieldset>
              <label>Stillmall<select value={newStyleId} onChange={(e) => setNewStyleId(e.target.value)}>{allStyles.map((style) => <option key={style.id} value={style.id}>{style.genre} — {style.name}</option>)}</select></label>
              <div className="style-preview"><span className="style-genre">SNAPSHOT I PROJEKTET</span><p>{allStyles.find((style) => style.id === newStyleId)?.promptText}</p></div>
              <div className="style-editor-actions"><button className="text-button" type="button" onClick={closePanel}>Avbryt</button><button className="primary-button" type="button" disabled={!newTitle.trim()} onClick={createNewProject}>Skapa projekt</button></div>
            </div></> : null}
          {panel === "guide" ? <><p className="eyebrow">GUIDE</p><h1>ComicBook AI Guide</h1><p className="lede">Guiden skriver vi senare. Den här platsen är förberedd för den.</p></> : null}
          {panel === "styles" ? <><p className="eyebrow">SYSTEM</p><h1>Stillmallar</h1><p className="lede">Globala visuella stilar som kan användas när ComicBook AI bygger bildprompter.</p>
              <div className="style-tools"><input value={styleQuery} onChange={(e) => setStyleQuery(e.target.value)} placeholder="Sök stillmall…" aria-label="Sök stillmall" />
                <select value={styleGenre} onChange={(e) => setStyleGenre(e.target.value)} aria-label="Genre"><option>Alla</option>{STYLE_GENRES.map((genre) => <option key={genre}>{genre}</option>)}<option>Custom</option></select>
                <button className="primary-button" type="button" onClick={() => setStyleDraft({ name: "", genre: "Custom", promptText: "" })}>Ny stillmall</button></div>
              {styleDraft ? <div className="style-editor">
                <label>Namn<input value={styleDraft.name} onChange={(e) => setStyleDraft({ ...styleDraft, name: e.target.value })} /></label>
                <label>Genre<input value={styleDraft.genre} onChange={(e) => setStyleDraft({ ...styleDraft, genre: e.target.value })} /></label>
                <label>Prompt<textarea rows={6} value={styleDraft.promptText} onChange={(e) => setStyleDraft({ ...styleDraft, promptText: e.target.value })} /></label>
                <div className="style-editor-actions"><button className="text-button" type="button" onClick={() => setStyleDraft(null)}>Avbryt</button><button className="primary-button" type="button" onClick={saveDraft}>Spara</button></div>
              </div> : null}
              <div className="style-grid">{visibleStyles.map((style) => {
                const custom = style.id.startsWith("custom-");
                return <article className="style-card" key={style.id}><span className="style-genre">{style.genre}{custom ? " · Egen" : " · Inbyggd"}</span><h2>{style.name}</h2><p>{style.promptText}</p>
                  <div className="style-card-actions"><button className="text-button" type="button" onClick={() => duplicateStyle(style)}>Duplicera</button>
                    {custom ? <><button className="text-button" type="button" onClick={() => setStyleDraft({ ...style })}>Redigera</button>
                    <button className="text-button danger-button" type="button" onClick={() => persistCustomStyles(customStyles.filter((item) => item.id !== style.id))}>Radera</button></> : null}</div>
                </article>;
              })}</div></> : null}
          {panel === "settings" ? <><p className="eyebrow">SYSTEM</p><h1>Inställningar</h1><p className="lede">Välj hur ComicBook AI ska arbeta med bildgenerering.</p>
            <div className="ai-options" role="radiogroup" aria-label="AI-läge">{AI_MODES.map((mode) => (
              <button key={mode.id} type="button" className={aiMode === mode.id ? "ai-option is-selected" : "ai-option"} disabled={!mode.available}
                aria-pressed={aiMode === mode.id} onClick={() => mode.available && setAiMode(mode.id)}>
                <span><strong>{mode.label}</strong>{!mode.available ? <small>Kommer senare</small> : null}</span><span>{mode.description}</span>
              </button>
            ))}</div></> : null}
        </article>
      </div> : null}
    </div>
  );
}