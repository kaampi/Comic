import { useEffect, useRef, useState } from "react";
import { AI_MODES, type AiMode } from "./ai";
import { applyLocale, applyTheme, LOCALES, readLocale, readTheme, type Locale, type Theme } from "./settings";
import { BUILTIN_STYLES, STYLE_GENRES, createCustomStyleId, readCustomStyles, saveCustomStyles, type IllustrationStyle } from "./stylesLibrary";
import { createProject, readProjects, saveProjects, type ComicProject, type ProjectSource } from "./project";
import { buildPanelPrompt } from "./promptBuilder";
import { PAGE_PRESETS, overlaps } from "./pageTemplates";

type Panel = "styles" | "guide" | "settings" | "new-project" | null;
type StyleDraft = { id?: string; name: string; genre: string; promptText: string };
type ProjectTab = "manus" | "characters" | "locations" | "scenes" | "pages";

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
  const [sceneTitle, setSceneTitle] = useState("");
  const [projectTab, setProjectTab] = useState<ProjectTab>("manus");
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [copiedPanelId, setCopiedPanelId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [layoutStart, setLayoutStart] = useState<{x:number;y:number} | null>(null);
  const [appPageGrid, setAppPageGrid] = useState(readPageGridDefaults);
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
  const updateActiveProject = (update: (project: ComicProject) => ComicProject) => {
    if (!activeProjectId) return;
    const next = projects.map((project) => project.id === activeProjectId ? { ...update(project), updatedAt: new Date().toISOString() } : project);
    setProjects(next); saveProjects(next);
  };
  const addScene = () => {
    if (!sceneTitle.trim()) return;
    updateActiveProject((project) => ({ ...project, scenes: [...project.scenes, { id: "scene-" + crypto.randomUUID(), title: sceneTitle.trim(), sourceText: "", panelIds: [] }] }));
    setSceneTitle("");
  };
  const addPanel = (sceneId: string) => {
    updateActiveProject((project) => {
      const scenePanels = project.panels.filter((panel) => panel.sceneId === sceneId);
      const panel = { id: "panel-" + crypto.randomUUID(), sceneId, order: scenePanels.length + 1, action: "", dialogue: "", narration: "", imagePrompt: "", characterIds: [], locationId: undefined };
      return { ...project, panels: [...project.panels, panel], scenes: project.scenes.map((scene) => scene.id === sceneId ? { ...scene, panelIds: [...scene.panelIds, panel.id] } : scene) };
    });
  };
  const updateScene = (sceneId: string, patch: { title?: string; sourceText?: string }) => updateActiveProject((project) => ({ ...project, scenes: project.scenes.map((scene) => scene.id === sceneId ? { ...scene, ...patch } : scene) }));
  const updatePanel = (panelId: string, field: "action" | "dialogue" | "narration" | "imagePrompt", value: string) => updateActiveProject((project) => ({ ...project, panels: project.panels.map((panel) => panel.id === panelId ? { ...panel, [field]: value } : panel) }));
  const addCharacter = () => { if (!newCharacterName.trim()) return; updateActiveProject((project) => ({ ...project, characters: [...project.characters, { id: "character-" + crypto.randomUUID(), name: newCharacterName.trim(), description: "", visualIdentity: "" }] })); setNewCharacterName(""); };
  const addLocation = () => { if (!newLocationName.trim()) return; updateActiveProject((project) => ({ ...project, locations: [...project.locations, { id: "location-" + crypto.randomUUID(), name: newLocationName.trim(), description: "", visualIdentity: "" }] })); setNewLocationName(""); };
  const updateCharacter = (id: string, patch: Partial<ComicProject["characters"][number]>) => updateActiveProject((project) => ({ ...project, characters: project.characters.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateLocation = (id: string, patch: Partial<ComicProject["locations"][number]>) => updateActiveProject((project) => ({ ...project, locations: project.locations.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const togglePanelCharacter = (panelId: string, characterId: string) => updateActiveProject((project) => ({ ...project, panels: project.panels.map((panel) => panel.id !== panelId ? panel : { ...panel, characterIds: (panel.characterIds ?? []).includes(characterId) ? (panel.characterIds ?? []).filter((id) => id !== characterId) : [...(panel.characterIds ?? []), characterId] }) }));
  const setPanelLocation = (panelId: string, locationId: string) => updateActiveProject((project) => ({ ...project, panels: project.panels.map((panel) => panel.id === panelId ? { ...panel, locationId: locationId || undefined } : panel) }));
  const copyPanelPrompt = async (project: ComicProject, panelId: string) => {
    const prompt = buildPanelPrompt(project, panelId); if (!prompt) return;
    try { await navigator.clipboard.writeText(prompt); setCopiedPanelId(panelId); window.setTimeout(() => setCopiedPanelId((current) => current === panelId ? null : current), 1600); } catch {}
  };
  const addPage = () => updateActiveProject((project) => ({ ...project, pages: [...project.pages, { id: "page-" + crypto.randomUUID(), number: project.pages.length + 1, gridColumns: project.pageDefaults.gridColumns, gridRows: project.pageDefaults.gridRows, placements: [] }] }));
  const setProjectGridDefaults = (gridColumns:number, gridRows:number) => updateActiveProject((project) => ({...project,pageDefaults:{gridColumns,gridRows}}));
  const setPageGrid = (pageId:string, gridColumns:number, gridRows:number) => updateActiveProject((project) => ({...project,pages:project.pages.map((page)=>page.id===pageId?{...page,gridColumns,gridRows,placements:[]}:page)}));
  const updateAppGrid = (gridColumns:number, gridRows:number) => { const value={gridColumns,gridRows}; setAppPageGrid(value); savePageGridDefaults(value); };
  const applyPreset = (pageId: string, presetId: string) => {
    const preset = PAGE_PRESETS.find((item) => item.id === presetId); if (!preset) return;
    updateActiveProject((project) => ({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, placements: preset.panels.map((rect,index) => ({ id: "placement-" + crypto.randomUUID(), ...rect, readingOrder: index + 1 })) } : page) }));
  };
  const selectGridCell = (pageId: string, x: number, y: number) => {
    if (!layoutStart) { setLayoutStart({x,y}); return; }
    const rect = { x: Math.min(layoutStart.x,x), y: Math.min(layoutStart.y,y), width: Math.abs(x-layoutStart.x)+1, height: Math.abs(y-layoutStart.y)+1 };
    setLayoutStart(null);
    updateActiveProject((project) => ({ ...project, pages: project.pages.map((page) => {
      if (page.id !== pageId || page.placements.some((item) => overlaps(item,rect))) return page;
      return { ...page, placements: [...page.placements, { id:"placement-"+crypto.randomUUID(), ...rect, readingOrder: page.placements.length+1 }] };
    }) }));
  };
  const setPlacementPanel = (pageId:string, placementId:string, panelId:string) => updateActiveProject((project) => ({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, placements: page.placements.map((item) => item.id === placementId ? { ...item, panelId: panelId || undefined } : item) } : page) }));
  const removePlacement = (pageId:string, placementId:string) => updateActiveProject((project) => ({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, placements: page.placements.filter((item) => item.id !== placementId).map((item,index) => ({...item,readingOrder:index+1})) } : page) }));
  const moveReadingOrder = (pageId:string, placementId:string, direction:-1|1) => updateActiveProject((project) => ({ ...project, pages: project.pages.map((page) => { if(page.id!==pageId)return page; const ordered=[...page.placements].sort((x,y)=>x.readingOrder-y.readingOrder); const index=ordered.findIndex((item)=>item.id===placementId); const target=index+direction; if(index<0||target<0||target>=ordered.length)return page; [ordered[index],ordered[target]]=[ordered[target],ordered[index]]; return {...page,placements:ordered.map((item,i)=>({...item,readingOrder:i+1}))}; }) }));
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
          <nav className="project-tabs" aria-label="Projektinnehåll">
            {([["manus","Manus"],["characters","Karaktärer"],["locations","Platser"],["scenes","Scener"],["pages","Sidor"]] as const).map(([id,label]) => <button key={id} className={projectTab === id ? "is-active" : ""} onClick={() => setProjectTab(id)}>{label}</button>)}
          </nav>
          {projectTab === "manus" ? <section className="manuscript-workspace">
            <div className="manuscript-main">
              <div className="section-heading"><div><p className="eyebrow">KÄLLTEXT</p><h2>Manus</h2></div><span className="save-state">Sparas lokalt</span></div>
              <textarea className="manuscript-editor" value={activeProject.source.textSnapshot ?? ""} onChange={(e) => updateActiveProject((project) => ({ ...project, source: { ...project.source, textSnapshot: e.target.value } }))} placeholder="Klistra in eller skriv texten som ska adapteras till serie…" aria-label="Manus" />
              <div className="manuscript-stats"><span>{(activeProject.source.textSnapshot ?? "").trim() ? (activeProject.source.textSnapshot ?? "").trim().split(/\s+/).length : 0} ord</span><span>{(activeProject.source.textSnapshot ?? "").length} tecken</span></div>
            </div>
            <aside className="scene-sidebar"><p className="eyebrow">SCENER</p><h2>Scenindelning</h2><p className="quiet">Skapa scener manuellt och bearbeta dem sedan under fliken Scener.</p>
              <div className="scene-add"><input value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addScene()} placeholder="Scennamn…" /><button className="primary-button" type="button" disabled={!sceneTitle.trim()} onClick={addScene}>Lägg till</button></div>
              <div className="scene-list">{activeProject.scenes.length ? activeProject.scenes.map((scene, index) => <button className="scene-row scene-button" key={scene.id} onClick={() => { setSelectedSceneId(scene.id); setProjectTab("scenes"); }}><span>{index + 1}</span><strong>{scene.title}</strong></button>) : <p className="quiet">Inga scener ännu.</p>}</div>
            </aside>
          </section> : null}
          {projectTab === "scenes" ? <section className="scene-workspace">
            <aside className="scene-navigator"><div className="section-heading"><div><p className="eyebrow">SCENER</p><h2>Scenlista</h2></div></div>
              {activeProject.scenes.map((scene,index) => <button key={scene.id} className={selectedSceneId === scene.id ? "scene-nav-item is-selected" : "scene-nav-item"} onClick={() => setSelectedSceneId(scene.id)}><span>{index+1}</span>{scene.title}</button>)}
              {!activeProject.scenes.length ? <p className="quiet">Skapa din första scen under Manus.</p> : null}
            </aside>
            {(() => { const scene = activeProject.scenes.find((item) => item.id === selectedSceneId) ?? activeProject.scenes[0]; if (!scene) return <div className="workspace-card"><h2>Ingen scen vald</h2></div>;
              const panels = scene.panelIds.map((id) => activeProject.panels.find((panel) => panel.id === id)).filter(Boolean);
              return <div className="scene-editor"><div className="section-heading"><div><p className="eyebrow">SCEN</p><input className="scene-title-input" value={scene.title} onChange={(e) => updateScene(scene.id,{title:e.target.value})} /></div><button className="primary-button" onClick={() => addPanel(scene.id)}>Ny bildruta</button></div>
                <label className="source-excerpt">Källtext<textarea rows={6} value={scene.sourceText} onChange={(e) => updateScene(scene.id,{sourceText:e.target.value})} placeholder="Klistra in det textavsnitt ur manuset som scenen bygger på…" /></label>
                <div className="panel-list">{panels.length ? panels.map((panel,index) => panel ? <article className="panel-editor" key={panel.id}><div className="panel-number">RUTA {index+1}</div>
                  <div className="panel-context"><fieldset><legend>Karaktärer i rutan</legend>{activeProject.characters.length ? activeProject.characters.map((character) => <label key={character.id}><input type="checkbox" checked={(panel.characterIds ?? []).includes(character.id)} onChange={() => togglePanelCharacter(panel.id,character.id)} /> {character.name}</label>) : <span className="quiet">Inga karaktärer skapade.</span>}</fieldset>
                    <label>Plats<select value={panel.locationId ?? ""} onChange={(e) => setPanelLocation(panel.id,e.target.value)}><option value="">Ingen vald</option>{activeProject.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label></div>
                  <label>Handling<textarea rows={3} value={panel.action} onChange={(e) => updatePanel(panel.id,"action",e.target.value)} placeholder="Vad ser vi i rutan?" /></label>
                  <label>Dialog<textarea rows={2} value={panel.dialogue} onChange={(e) => updatePanel(panel.id,"dialogue",e.target.value)} /></label>
                  <label>Berättartext<textarea rows={2} value={panel.narration} onChange={(e) => updatePanel(panel.id,"narration",e.target.value)} /></label>
                  <label>Bildinstruktion<textarea rows={3} value={panel.imagePrompt} onChange={(e) => updatePanel(panel.id,"imagePrompt",e.target.value)} placeholder="Komposition, utsnitt, kameravinkel…" /></label>
                  <details className="prompt-preview"><summary>Färdig bildprompt</summary><pre>{buildPanelPrompt(activeProject,panel.id)}</pre><div className="prompt-actions"><span className="quiet">Byggs lokalt · inget skickas till en AI-tjänst</span><button className="primary-button" type="button" onClick={() => copyPanelPrompt(activeProject,panel.id)}>{copiedPanelId === panel.id ? "Kopierad" : "Kopiera prompt"}</button></div></details>
                </article> : null) : <div className="empty-panels"><p>Scenen har inga bildrutor ännu.</p><button className="primary-button" onClick={() => addPanel(scene.id)}>Skapa första bildrutan</button></div>}</div>
              </div>; })()}
          </section> : null}
          {projectTab === "characters" ? <section className="library-workspace"><div className="section-heading"><div><p className="eyebrow">VISUELL KONTINUITET</p><h2>Karaktärer</h2></div><div className="inline-add"><input value={newCharacterName} onChange={(e) => setNewCharacterName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCharacter()} placeholder="Karaktärens namn…" /><button className="primary-button" disabled={!newCharacterName.trim()} onClick={addCharacter}>Lägg till</button></div></div>
            <div className="entity-grid">{activeProject.characters.map((character) => <article className="entity-card" key={character.id}><input className="entity-name" value={character.name} onChange={(e) => updateCharacter(character.id,{name:e.target.value})} /><label>Berättelseroll / anteckningar<textarea rows={3} value={character.description} onChange={(e) => updateCharacter(character.id,{description:e.target.value})} /></label><label>Permanent visuell identitet<textarea rows={5} value={character.visualIdentity} onChange={(e) => updateCharacter(character.id,{visualIdentity:e.target.value})} placeholder="Ansikte, ålder, kroppsbyggnad, hår, bestående kännetecken…" /></label></article>)}</div>
            {!activeProject.characters.length ? <p className="quiet">Inga karaktärer ännu.</p> : null}</section> : null}
          {projectTab === "locations" ? <section className="library-workspace"><div className="section-heading"><div><p className="eyebrow">VISUELL KONTINUITET</p><h2>Platser</h2></div><div className="inline-add"><input value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLocation()} placeholder="Platsens namn…" /><button className="primary-button" disabled={!newLocationName.trim()} onClick={addLocation}>Lägg till</button></div></div>
            <div className="entity-grid">{activeProject.locations.map((location) => <article className="entity-card" key={location.id}><input className="entity-name" value={location.name} onChange={(e) => updateLocation(location.id,{name:e.target.value})} /><label>Beskrivning<textarea rows={3} value={location.description} onChange={(e) => updateLocation(location.id,{description:e.target.value})} /></label><label>Visuellt ankare<textarea rows={5} value={location.visualIdentity} onChange={(e) => updateLocation(location.id,{visualIdentity:e.target.value})} placeholder="Arkitektur, material, färger, återkommande detaljer…" /></label></article>)}</div>
            {!activeProject.locations.length ? <p className="quiet">Inga platser ännu.</p> : null}</section> : null}
          {projectTab === "pages" ? <section className="page-workspace">
            <aside className="page-sidebar"><div className="section-heading"><div><p className="eyebrow">ALBUM</p><h2>Sidor</h2></div><button className="primary-button" onClick={addPage}>Ny sida</button></div>
              <div className="page-list">{activeProject.pages.map((page) => <button key={page.id} className={selectedPageId === page.id ? "page-nav is-selected" : "page-nav"} onClick={() => {setSelectedPageId(page.id);setLayoutStart(null);}}>Sida {page.number}<span>{page.placements.length} rutor</span></button>)}</div>
            </aside>
            {(() => { const page = activeProject.pages.find((item) => item.id === selectedPageId) ?? activeProject.pages[0]; if (!page) return <div className="workspace-card"><h2>Skapa första sidan</h2><button className="primary-button" onClick={addPage}>Ny sida</button></div>;
              return <div className="page-planner"><div className="section-heading"><div><p className="eyebrow">SIDA {page.number}</p><h2>Rita sidlayout</h2><p className="quiet">{layoutStart ? "Välj rutans motsatta hörn." : "Klicka första och sista cellen för att rama in en serieruta."}</p></div><select className="preset-select" defaultValue="" onChange={(e)=>{if(e.target.value)applyPreset(page.id,e.target.value);e.currentTarget.value="";}}><option value="">Använd preset…</option>{PAGE_PRESETS.map((preset)=><option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></div>
                <div className="grid-settings"><div><strong>Projektstandard</strong><label>Kolumner <input type="number" min="2" max="6" value={activeProject.pageDefaults.gridColumns} onChange={(e)=>setProjectGridDefaults(Number(e.target.value),activeProject.pageDefaults.gridRows)} /></label><label>Rader <input type="number" min="2" max="8" value={activeProject.pageDefaults.gridRows} onChange={(e)=>setProjectGridDefaults(activeProject.pageDefaults.gridColumns,Number(e.target.value))} /></label><span className="quiet">Gäller nya sidor.</span></div><div><strong>Denna sida</strong><label>Kolumner <input type="number" min="2" max="6" value={page.gridColumns} onChange={(e)=>setPageGrid(page.id,Number(e.target.value),page.gridRows)} /></label><label>Rader <input type="number" min="2" max="8" value={page.gridRows} onChange={(e)=>setPageGrid(page.id,page.gridColumns,Number(e.target.value))} /></label><span className="quiet">Ändring återställer sidans layout.</span></div></div>
                <div className="layout-canvas">
                  <div className="construction-grid" style={{gridTemplateColumns:`repeat(${page.gridColumns},1fr)`,gridTemplateRows:`repeat(${page.gridRows},1fr)`}}>{Array.from({length:page.gridColumns*page.gridRows},(_,i)=>{const x=i%page.gridColumns,y=Math.floor(i/page.gridColumns);return <button key={i} className={layoutStart?.x===x&&layoutStart?.y===y?"grid-cell is-start":"grid-cell"} onClick={()=>selectGridCell(page.id,x,y)} aria-label={`Kolumn ${x+1}, rad ${y+1}`} />;})}</div>
                  <div className="layout-panels" style={{gridTemplateColumns:`repeat(${page.gridColumns},1fr)`,gridTemplateRows:`repeat(${page.gridRows},1fr)`}}>{page.placements.map((placement)=>{const panel=placement.panelId?activeProject.panels.find((item)=>item.id===placement.panelId):undefined;return <div className="drawn-panel" key={placement.id} style={{gridColumn:`${placement.x+1} / span ${placement.width}`,gridRow:`${placement.y+1} / span ${placement.height}`}}><b>{placement.readingOrder}</b><span>{panel?.action || "Tom serieruta"}</span></div>;})}</div>
                </div>
                <div className="placement-list"><h3>Rutor och läsordning</h3>{page.placements.map((placement)=><div className="placement-row" key={placement.id}><strong>{placement.readingOrder}</strong><select value={placement.panelId??""} onChange={(e)=>setPlacementPanel(page.id,placement.id,e.target.value)}><option value="">Ingen bildruta vald</option>{activeProject.panels.map((panel)=><option key={panel.id} value={panel.id}>{activeProject.scenes.find((s)=>s.id===panel.sceneId)?.title??"Scen"} — ruta {panel.order}</option>)}</select><button className="text-button" disabled={placement.readingOrder===1} onClick={()=>moveReadingOrder(page.id,placement.id,-1)}>↑</button><button className="text-button" disabled={placement.readingOrder===page.placements.length} onClick={()=>moveReadingOrder(page.id,placement.id,1)}>↓</button><button className="text-button danger-button" onClick={()=>removePlacement(page.id,placement.id)}>Ta bort</button></div>)}</div>
              </div>; })()}
          </section> : null}
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