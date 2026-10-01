import { useEffect, useRef, useState } from "react";
import { AI_MODES, type AiMode } from "./ai";
import { applyLocale, applyTheme, LOCALES, readLocale, readTheme, readPageGridDefaults, savePageGridDefaults, type Locale, type Theme } from "./settings";
import { BUILTIN_STYLES, STYLE_GENRES, createCustomStyleId, readCustomStyles, saveCustomStyles, type IllustrationStyle } from "./stylesLibrary";
import { createProject, readProjects, saveProjects, type ComicProject, type ProjectSource } from "./project";
import { buildPanelPrompt } from "./promptBuilder";
import { PAGE_PRESETS, overlaps } from "./pageTemplates";
import { parseStoryBookExport, parseStoryBookCards, cardMatchesBook, type StoryBookImport, type StoryBookCardsImport } from "./storybookImport";
import { SvgOverlay } from "./SvgOverlay";
import type { OverlayType } from "./project";
import { uiText, type UiKey } from "./i18n";

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
  const [layoutEnd, setLayoutEnd] = useState<{x:number;y:number} | null>(null);
  const [contextPlacement, setContextPlacement] = useState<{pageId:string;placementId:string;x:number;y:number}|null>(null);
  const [panelEditor, setPanelEditor] = useState<{pageId:string;placementId:string}|null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [appPageGrid, setAppPageGrid] = useState(readPageGridDefaults);
  const [storyBookImport, setStoryBookImport] = useState<StoryBookImport | null>(null);
  const [storyBookCards, setStoryBookCards] = useState<StoryBookCardsImport | null>(null);
  const [importError, setImportError] = useState("");
  const [importCharacters, setImportCharacters] = useState(true);
  const [importLocations, setImportLocations] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { applyLocale(locale); }, [locale]);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    if (!projectMenuOpen) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setProjectMenuOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [projectMenuOpen]);
  useEffect(() => {
    if (!contextPlacement) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setContextPlacement(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [contextPlacement]);
  useEffect(() => {
    if (!panelEditor) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPanelEditor(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [panelEditor]);

  const tr = (key: UiKey) => uiText(locale, key);
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
  const setPageGrid = (pageId:string, gridColumns:number, gridRows:number) => {
    const page = activeProject?.pages.find((item) => item.id === pageId);
    if (page?.placements.length && !window.confirm("Rutnätsändringen tar bort sidans nuvarande layout. Fortsätta?")) return;
    setLayoutStart(null);
    updateActiveProject((project) => ({...project,pages:project.pages.map((item)=>item.id===pageId?{...item,gridColumns,gridRows,placements:[]}:item)}));
  };
  const updateAppGrid = (gridColumns:number, gridRows:number) => { const value={gridColumns,gridRows}; setAppPageGrid(value); savePageGridDefaults(value); };
  const applyPreset = (pageId: string, presetId: string) => {
    const preset = PAGE_PRESETS.find((item) => item.id === presetId); if (!preset) return;
    updateActiveProject((project) => ({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, placements: preset.panels.map((rect,index) => ({ id: "placement-" + crypto.randomUUID(), ...rect, readingOrder: index + 1, overlays: [] })) } : page) }));
  };
  const finishLayoutDrag = (pageId:string) => {
    if (!layoutStart || !layoutEnd) { setLayoutStart(null); setLayoutEnd(null); return; }
    const rect={x:Math.min(layoutStart.x,layoutEnd.x),y:Math.min(layoutStart.y,layoutEnd.y),width:Math.abs(layoutEnd.x-layoutStart.x)+1,height:Math.abs(layoutEnd.y-layoutStart.y)+1};
    setLayoutStart(null); setLayoutEnd(null);
    updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>{
      if(page.id!==pageId||page.placements.some((item)=>overlaps(item,rect))) return page;
      return {...page,placements:[...page.placements,{id:"placement-"+crypto.randomUUID(),...rect,readingOrder:page.placements.length+1,overlays:[]}]};
    })}));
  };
  const setPlacementRect=(pageId:string,placementId:string,rect:{x:number;y:number;width:number;height:number})=>updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>{
    if(page.id!==pageId)return page;
    const next={...rect,width:Math.max(1,rect.width),height:Math.max(1,rect.height)};
    if(next.x<0||next.y<0||next.x+next.width>page.gridColumns||next.y+next.height>page.gridRows)return page;
    if(page.placements.some((p)=>p.id!==placementId&&overlaps(p,next)))return page;
    return {...page,placements:page.placements.map((p)=>p.id===placementId?{...p,...next}:p)};
  })}));
  const beginResize=(event:React.PointerEvent, pageId:string, placement:ComicProject["pages"][number]["placements"][number], edge:"left"|"right"|"top"|"bottom", columns:number, rows:number)=>{
    event.stopPropagation();event.preventDefault();
    const canvas=(event.currentTarget as HTMLElement).closest(".layout-canvas") as HTMLElement|null;if(!canvas)return;
    const box=canvas.getBoundingClientRect(),cellW=(box.width-20-(columns-1)*6)/columns,cellH=(box.height-20-(rows-1)*6)/rows;
    const sx=event.clientX,sy=event.clientY,original={x:placement.x,y:placement.y,width:placement.width,height:placement.height};let last="";
    const move=(ev:PointerEvent)=>{const dx=Math.round((ev.clientX-sx)/(cellW+6)),dy=Math.round((ev.clientY-sy)/(cellH+6));let next={...original};
      if(edge==="right")next.width=original.width+dx;
      if(edge==="bottom")next.height=original.height+dy;
      if(edge==="left"){next.x=original.x+dx;next.width=original.width-dx;}
      if(edge==="top"){next.y=original.y+dy;next.height=original.height-dy;}
      const key=`${next.x},${next.y},${next.width},${next.height}`;if(key!==last){last=key;setPlacementRect(pageId,placement.id,next);}
    };
    const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);};
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);
  };
  const loadPlacementImage=(pageId:string,placementId:string,file:File)=>{
    if(!file.type.startsWith("image/"))return;
    const reader=new FileReader();
    reader.onload=()=>{if(typeof reader.result!=="string")return;updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((p)=>p.id===placementId?{...p,image:{name:file.name,dataUrl:reader.result as string}}:p)})}));};
    reader.readAsDataURL(file);
  };
  const removePlacementImage=(pageId:string,placementId:string)=>{setContextPlacement(null);updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((p)=>p.id===placementId?{...p,image:undefined}:p)})}));};
  const addOverlay=(pageId:string,placementId:string,type:OverlayType)=>{
    const newOverlayId="overlay-"+crypto.randomUUID();
    updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>{
    if(placement.id!==placementId)return placement;
    const overlays=placement.overlays??[];
    const previous=type==="speech"?[...overlays].reverse().find((overlay)=>overlay.type==="speech"):undefined;
    const width=previous?.width??42,height=previous?.height??24;
    const x=previous?Math.max(0,Math.min(100-width,previous.x+4)):10;
    const y=previous?Math.max(0,Math.min(100-height,previous.y+4)):10;
    const dx=x-(previous?.x??x),dy=y-(previous?.y??y);
    const overlay={id:newOverlayId,type,text:type==="sfx"?"BOOM!":"Text",x,y,width,height,rotation:0,fontSize:previous?.fontSize??(type==="sfx"?28:8),fontFamily:previous?.fontFamily??(type==="sfx"?"Impact, sans-serif":"Comic Neue, sans-serif"),fontWeight:previous?.fontWeight??(type==="sfx"?800:600),bubbleStyle:"organic" as const,tailEnabled:type==="speech"?(previous?.tailEnabled??true):false,tailCurve:previous?.tailCurve??0,tailRootWidth:previous?.tailRootWidth??50,roundness:previous?.roundness??(type==="caption"?18:60),tailX:type==="speech"?(previous?.tailX!==undefined?previous.tailX+dx:x+width*.65):undefined,tailY:type==="speech"?(previous?.tailY!==undefined?previous.tailY+dy:y+height*1.15):undefined};
    return {...placement,overlays:[...overlays,overlay]};
  })})}));
    setSelectedOverlayId(newOverlayId);
  };
  const updateOverlay=(pageId:string,placementId:string,overlayId:string,patch:any)=>updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>placement.id!==placementId?placement:{...placement,overlays:(placement.overlays??[]).map((overlay)=>overlay.id===overlayId?{...overlay,...patch}:overlay)})})}));
  const deleteOverlay=(pageId:string,placementId:string,overlayId:string)=>{updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>placement.id!==placementId?placement:{...placement,overlays:(placement.overlays??[]).filter((overlay)=>overlay.id!==overlayId)})})}));if(selectedOverlayId===overlayId)setSelectedOverlayId(null);};

  const beginOverlayDrag=(event:React.PointerEvent<SVGGElement>,pageId:string,placementId:string,overlay:any,mode:"move"|"resize"|"tail")=>{
    event.stopPropagation();event.preventDefault();
    const svg=(event.currentTarget.ownerSVGElement);if(!svg)return;
    const box=svg.getBoundingClientRect(),sx=event.clientX,sy=event.clientY,start={...overlay};
    const move=(ev:PointerEvent)=>{const dx=(ev.clientX-sx)/box.width*100,dy=(ev.clientY-sy)/box.height*100;
      if(mode==="move"){const x=Math.max(0,Math.min(100-start.width,start.x+dx)),y=Math.max(0,Math.min(100-start.height,start.y+dy));updateOverlay(pageId,placementId,overlay.id,{x,y,tailX:start.tailX===undefined?undefined:start.tailX+dx,tailY:start.tailY===undefined?undefined:start.tailY+dy});}
      if(mode==="resize")updateOverlay(pageId,placementId,overlay.id,{width:Math.max(6,Math.min(100-start.x,start.width+dx)),height:Math.max(5,Math.min(100-start.y,start.height+dy))});
      if(mode==="tail")updateOverlay(pageId,placementId,overlay.id,{tailX:Math.max(0,Math.min(100,(start.tailX??start.x+start.width/2)+dx)),tailY:Math.max(0,Math.min(100,(start.tailY??start.y+start.height)+dy))});
    };
    const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);
  };
  const setPlacementPanel = (pageId:string, placementId:string, panelId:string) => updateActiveProject((project) => ({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, placements: page.placements.map((item) => item.id === placementId ? { ...item, panelId: panelId || undefined } : item) } : page) }));
  const removePlacement = (pageId:string, placementId:string) => updateActiveProject((project) => ({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, placements: page.placements.filter((item) => item.id !== placementId).map((item,index) => ({...item,readingOrder:index+1})) } : page) }));
  const moveReadingOrder = (pageId:string, placementId:string, direction:-1|1) => updateActiveProject((project) => ({ ...project, pages: project.pages.map((page) => { if(page.id!==pageId)return page; const ordered=[...page.placements].sort((x,y)=>x.readingOrder-y.readingOrder); const index=ordered.findIndex((item)=>item.id===placementId); const target=index+direction; if(index<0||target<0||target>=ordered.length)return page; [ordered[index],ordered[target]]=[ordered[target],ordered[index]]; return {...page,placements:ordered.map((item,i)=>({...item,readingOrder:i+1}))}; }) }));
  const moveScene = (sceneId:string, direction:-1|1) => updateActiveProject((project) => { const scenes=[...project.scenes]; const index=scenes.findIndex((item)=>item.id===sceneId); const target=index+direction; if(index<0||target<0||target>=scenes.length)return project; [scenes[index],scenes[target]]=[scenes[target],scenes[index]]; return {...project,scenes}; });
  const deletePanel = (panelId:string) => {
    if (!window.confirm("Radera bildrutan? Den tas även bort från alla sidlayouter.")) return;
    updateActiveProject((project) => ({...project,panels:project.panels.filter((item)=>item.id!==panelId),scenes:project.scenes.map((scene)=>({...scene,panelIds:scene.panelIds.filter((id)=>id!==panelId)})),pages:project.pages.map((page)=>({...page,placements:page.placements.map((placement)=>placement.panelId===panelId?{...placement,panelId:undefined}:placement)}))}));
  };
  const movePanel = (sceneId:string, panelId:string, direction:-1|1) => updateActiveProject((project) => ({...project,scenes:project.scenes.map((scene)=>{if(scene.id!==sceneId)return scene;const ids=[...scene.panelIds];const index=ids.indexOf(panelId),target=index+direction;if(index<0||target<0||target>=ids.length)return scene;[ids[index],ids[target]]=[ids[target],ids[index]];return {...scene,panelIds:ids};}),panels:project.panels.map((panel)=>{if(panel.sceneId!==sceneId)return panel;const scene=project.scenes.find((item)=>item.id===sceneId);if(!scene)return panel;const ids=[...scene.panelIds];const index=ids.indexOf(panelId),target=index+direction;if(index>=0&&target>=0&&target<ids.length)[ids[index],ids[target]]=[ids[target],ids[index]];return {...panel,order:ids.indexOf(panel.id)+1};})}));
  const deleteScene = (sceneId:string) => {
    const panelIds=activeProject?.scenes.find((item)=>item.id===sceneId)?.panelIds ?? [];
    if (!window.confirm(`Radera scenen och dess ${panelIds.length} bildrutor? Bildrutorna kopplas också bort från sidor.`)) return;
    updateActiveProject((project)=>({...project,scenes:project.scenes.filter((item)=>item.id!==sceneId),panels:project.panels.filter((item)=>item.sceneId!==sceneId),pages:project.pages.map((page)=>({...page,placements:page.placements.map((placement)=>placement.panelId&&panelIds.includes(placement.panelId)?{...placement,panelId:undefined}:placement)}))}));
    setSelectedSceneId(null);
  };
  const deletePage = (pageId:string) => {
    if (!window.confirm("Radera sidan? Manusets bildrutor påverkas inte.")) return;
    updateActiveProject((project)=>{const pages=project.pages.filter((item)=>item.id!==pageId).map((item,index)=>({...item,number:index+1}));return {...project,pages};});
    setSelectedPageId(null); setLayoutStart(null);
  };
  const movePage = (pageId:string,direction:-1|1) => updateActiveProject((project)=>{const pages=[...project.pages];const index=pages.findIndex((item)=>item.id===pageId),target=index+direction;if(index<0||target<0||target>=pages.length)return project;[pages[index],pages[target]]=[pages[target],pages[index]];return {...project,pages:pages.map((item,i)=>({...item,number:i+1}))};});
  const readStoryBookFile = async (file: File) => {
    setImportError("");
    try { const parsed=parseStoryBookExport(await file.text()); setStoryBookImport(parsed); setNewTitle(parsed.title); }
    catch (error) { setStoryBookImport(null); setImportError(error instanceof Error ? error.message : "Filen kunde inte läsas."); }
  };
  const readStoryBookCardsFile = async (file: File) => {
    setImportError("");
    try { setStoryBookCards(parseStoryBookCards(await file.text())); }
    catch (error) { setStoryBookCards(null); setImportError(error instanceof Error ? error.message : "Cards-filen kunde inte läsas."); }
  };
  const createFromStoryBook = () => {
    if (!storyBookImport || !newTitle.trim()) return;
    const style=allStyles.find((item)=>item.id===newStyleId) ?? BUILTIN_STYLES[0];
    const base=createProject(newTitle,"storybook",style);
    const importedCharacters=importCharacters?storyBookImport.characters.map((item)=>({id:"character-"+crypto.randomUUID(),sourceId:item.id,name:item.name,description:item.description,visualIdentity:"",pronoun:item.pronoun,approximateAge:item.approximateAge})):[];
    const portraits:Record<string,string>={};
    if(storyBookCards) for(const character of importedCharacters){
      const card=storyBookCards.characters.find((candidate)=>candidate.name.toLocaleLowerCase()===character.name.toLocaleLowerCase() && (!storyBookImport.sourceBookId || cardMatchesBook(candidate,storyBookImport.sourceBookId)));
      if(card?.portraitDataUrl) portraits[character.id]=card.portraitDataUrl;
      if(card){character.description=card.personality||character.description;character.visualIdentity=card.appearance||"";character.pronoun=card.pronoun??character.pronoun;character.approximateAge=card.approximateAge??character.approximateAge;}
    }
    const project: ComicProject={...base,pageDefaults:{...appPageGrid},source:{type:"storybook",textSnapshot:storyBookImport.text,storyBookId:storyBookImport.sourceBookId||undefined},references:{characterPortraits:portraits},
      characters:importedCharacters,
      locations:importLocations?storyBookImport.locations.map((item)=>({id:"location-"+crypto.randomUUID(),sourceId:item.id,name:item.name,description:item.description,visualIdentity:""})):[],
      scenes:storyBookImport.chapters.filter((chapter)=>chapter.text).map((chapter)=>({id:"scene-"+crypto.randomUUID(),title:chapter.title,sourceText:chapter.text,panelIds:[]}))
    };
    const next=[project,...projects];setProjects(next);saveProjects(next);setActiveProjectId(project.id);setStoryBookImport(null);setStoryBookCards(null);setImportError("");setPanel(null);setProjectMenuOpen(false);
  };
  const deleteProject = (projectId:string) => {
    const project=projects.find((item)=>item.id===projectId);
    if(!project || !window.confirm(`Radera projektet "${project.title}"? Detta tar bort ComicBook AI:s lokala kopia och kan inte ångras. StoryBook-filer påverkas inte.`)) return;
    const next=projects.filter((item)=>item.id!==projectId);
    setProjects(next); saveProjects(next);
    if(activeProjectId===projectId){setActiveProjectId(null);setSelectedSceneId(null);setSelectedPageId(null);setLayoutStart(null);setProjectTab("manus");}
    setProjectMenuOpen(false);
  };
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
        <button className="brand" type="button" onClick={closePanel} aria-label={tr("goHome")}>
          <span className="brand-mark" aria-hidden="true">CB</span><span>ComicBook AI</span>
        </button>
        <div className="top-menu" ref={menuRef}>
          <button className="text-button" type="button" aria-expanded={projectMenuOpen} onClick={() => setProjectMenuOpen((open) => !open)}>{tr("project")}</button>
          {projectMenuOpen ? <div className="menu-panel" role="menu">
            <button role="menuitem" type="button" className="menu-item" onClick={() => { setPanel("new-project"); setProjectMenuOpen(false); }}>{tr("newAlbum")}</button>
            {projects.length ? <><div className="menu-divider" />{projects.slice(0, 5).map((project) => <div className="menu-project-row" key={project.id}><button role="menuitem" type="button" className="menu-item" onClick={() => { setActiveProjectId(project.id); setProjectMenuOpen(false); }}>{project.title}</button><button type="button" className="menu-delete-project" aria-label={`Radera ${project.title}`} title={tr("deleteProject")} onClick={() => deleteProject(project.id)}>×</button></div>)}</> : <><div className="menu-divider" /><span className="menu-empty">{tr("noRecent")}</span></>}
            <div className="menu-divider" /><button role="menuitem" type="button" className="menu-item" onClick={() => { setActiveProjectId(null); setProjectMenuOpen(false); }}>{tr("showAll")}</button>
          </div> : null}
        </div>
        <button className="text-button" type="button" onClick={() => setPanel("styles")}>{tr("styleTemplates")}</button>
        <button className="text-button" type="button" onClick={() => setPanel("guide")}>{tr("guide")}</button>
        <button className="text-button" type="button" onClick={() => setPanel("settings")}>{tr("settings")}</button>
        <div className="top-chrome">
          <label className="locale-select"><span className="visually-hidden">{tr("language")}</span>
            <select value={locale} aria-label={tr("language")} onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <button className={theme === "light" ? "text-button theme-toggle is-on" : "text-button theme-toggle"} type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? tr("dark") : tr("light")}</button>
        </div>
      </header>
      {activeProject ? <nav className="project-topbar" aria-label={tr("activeProject")}>
        <button className="project-title-button" type="button" onClick={() => setProjectTab("manus")}>{activeProject.title}</button>
        <span className="project-topbar-spacer" />
        <button type="button" onClick={() => setProjectTab("manus")}>{tr("manuscript")}</button>
        <button type="button" onClick={() => setProjectTab("characters")}>{tr("characters")}</button>
        <button type="button" onClick={() => setProjectTab("locations")}>{tr("locations")}</button>
        <button type="button" onClick={() => setProjectTab("scenes")}>{tr("panels")}</button>
        <button type="button" onClick={() => setProjectTab("pages")}>{tr("pages")}</button>
        <button type="button" onClick={() => setPanel("styles")}>{tr("imageStyles")}</button>
      </nav> : null}

      <main className="home">
        {activeProject ? <section className="project-workspace">
          <p className="eyebrow">{tr("comicProject")}</p><h1>{activeProject.title}</h1>
          <p className="lede">{tr("style")}: {activeProject.style.name}</p>
          <nav className="project-tabs" aria-label={tr("projectContent")}>
            {([["manus",tr("manuscript")],["characters",tr("characters")],["locations",tr("locations")],["scenes",tr("scenes")],["pages",tr("pages")]] as const).map(([id,label]) => <button key={id} className={projectTab === id ? "is-active" : ""} onClick={() => setProjectTab(id)}>{label}</button>)}
          </nav>
          {projectTab === "manus" ? <section className="manuscript-workspace">
            <div className="manuscript-main">
              <div className="section-heading"><div><p className="eyebrow">{tr("sourceText")}</p><h2>{tr("manuscript")}</h2></div><span className="save-state">{tr("savedLocally")}</span></div>
              <textarea className="manuscript-editor" value={activeProject.source.textSnapshot ?? ""} onChange={(e) => updateActiveProject((project) => ({ ...project, source: { ...project.source, textSnapshot: e.target.value } }))} placeholder="Klistra in eller skriv texten som ska adapteras till serie…" aria-label="Manus" />
              <div className="manuscript-stats"><span>{(activeProject.source.textSnapshot ?? "").trim() ? (activeProject.source.textSnapshot ?? "").trim().split(/\s+/).length : 0} ord</span><span>{(activeProject.source.textSnapshot ?? "").length} tecken</span></div>
            </div>
            <aside className="scene-sidebar"><p className="eyebrow">{tr("scenes")}</p><h2>{tr("sceneDivision")}</h2><p className="quiet">{tr("createScenesHelp")}</p>
              <div className="scene-add"><input value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addScene()} placeholder={tr("sceneName")} /><button className="primary-button" type="button" disabled={!sceneTitle.trim()} onClick={addScene}>{tr("add")}</button></div>
              <div className="scene-list">{activeProject.scenes.length ? activeProject.scenes.map((scene, index) => <button className="scene-row scene-button" key={scene.id} onClick={() => { setSelectedSceneId(scene.id); setProjectTab("scenes"); }}><span>{index + 1}</span><strong>{scene.title}</strong></button>) : <p className="quiet">{tr("noScenes")}</p>}</div>
            </aside>
          </section> : null}
          {projectTab === "scenes" ? <section className="scene-workspace">
            <aside className="scene-navigator"><div className="section-heading"><div><p className="eyebrow">{tr("scenes")}</p><h2>{tr("sceneList")}</h2></div></div>
              {activeProject.scenes.map((scene,index) => <button key={scene.id} className={selectedSceneId === scene.id ? "scene-nav-item is-selected" : "scene-nav-item"} onClick={() => setSelectedSceneId(scene.id)}><span>{index+1}</span>{scene.title}</button>)}
              {!activeProject.scenes.length ? <p className="quiet">{tr("createFirstScene")}</p> : null}
            </aside>
            {(() => { const scene = activeProject.scenes.find((item) => item.id === selectedSceneId) ?? activeProject.scenes[0]; if (!scene) return <div className="workspace-card"><h2>{tr("noSceneSelected")}</h2></div>;
              const panels = scene.panelIds.map((id) => activeProject.panels.find((panel) => panel.id === id)).filter(Boolean);
              return <div className="scene-editor"><div className="section-heading"><div><p className="eyebrow">SCEN</p><input className="scene-title-input" value={scene.title} onChange={(e) => updateScene(scene.id,{title:e.target.value})} /></div><div className="edit-actions"><button className="text-button" disabled={activeProject.scenes[0]?.id===scene.id} onClick={()=>moveScene(scene.id,-1)}>↑ Scen</button><button className="text-button" disabled={activeProject.scenes[activeProject.scenes.length-1]?.id===scene.id} onClick={()=>moveScene(scene.id,1)}>↓ Scen</button><button className="text-button danger-button" onClick={()=>deleteScene(scene.id)}>{tr("deleteScene")}</button><button className="primary-button" onClick={() => addPanel(scene.id)}>{tr("newPanel")}</button></div></div>
                <label className="source-excerpt">{tr("sourceExcerpt")}<textarea rows={6} value={scene.sourceText} onChange={(e) => updateScene(scene.id,{sourceText:e.target.value})} placeholder="Klistra in det textavsnitt ur manuset som scenen bygger på…" /></label>
                <div className="panel-list">{panels.length ? panels.map((panel,index) => panel ? <article className="panel-editor" key={panel.id}><div className="panel-number">RUTA {index+1}<span className="panel-edit-actions"><button className="text-button" disabled={index===0} onClick={()=>movePanel(scene.id,panel.id,-1)}>↑</button><button className="text-button" disabled={index===panels.length-1} onClick={()=>movePanel(scene.id,panel.id,1)}>↓</button><button className="text-button danger-button" onClick={()=>deletePanel(panel.id)}>{tr("delete")}</button></span></div>
                  <div className="panel-context"><fieldset><legend>{tr("charactersInPanel")}</legend>{activeProject.characters.length ? activeProject.characters.map((character) => <label key={character.id}><input type="checkbox" checked={(panel.characterIds ?? []).includes(character.id)} onChange={() => togglePanelCharacter(panel.id,character.id)} /> {character.name}</label>) : <span className="quiet">{tr("noCharacters")}</span>}</fieldset>
                    <label>{tr("place")}<select value={panel.locationId ?? ""} onChange={(e) => setPanelLocation(panel.id,e.target.value)}><option value="">{tr("noneSelected")}</option>{activeProject.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label></div>
                  <label>{tr("action")}<textarea rows={3} value={panel.action} onChange={(e) => updatePanel(panel.id,"action",e.target.value)} placeholder="Vad ser vi i rutan?" /></label>
                  <label>{tr("dialogue")}<textarea rows={2} value={panel.dialogue} onChange={(e) => updatePanel(panel.id,"dialogue",e.target.value)} /></label>
                  <label>{tr("narration")}<textarea rows={2} value={panel.narration} onChange={(e) => updatePanel(panel.id,"narration",e.target.value)} /></label>
                  <label>{tr("imageInstruction")}<textarea rows={3} value={panel.imagePrompt} onChange={(e) => updatePanel(panel.id,"imagePrompt",e.target.value)} placeholder="Komposition, utsnitt, kameravinkel…" /></label>
                  <details className="prompt-preview"><summary>{tr("finishedPrompt")}</summary><pre>{buildPanelPrompt(activeProject,panel.id)}</pre><div className="prompt-actions"><span className="quiet">{tr("builtLocally")}</span><button className="primary-button" type="button" onClick={() => copyPanelPrompt(activeProject,panel.id)}>{copiedPanelId === panel.id ? tr("copied") : tr("copyPrompt")}</button></div></details>
                </article> : null) : <div className="empty-panels"><p>{tr("noPanels")}</p><button className="primary-button" onClick={() => addPanel(scene.id)}>{tr("createFirstPanel")}</button></div>}</div>
              </div>; })()}
          </section> : null}
          {projectTab === "characters" ? <section className="library-workspace"><div className="section-heading"><div><p className="eyebrow">{tr("visualContinuity")}</p><h2>{tr("characters")}</h2></div><div className="inline-add"><input value={newCharacterName} onChange={(e) => setNewCharacterName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCharacter()} placeholder="Karaktärens namn…" /><button className="primary-button" disabled={!newCharacterName.trim()} onClick={addCharacter}>{tr("add")}</button></div></div>
            <div className="entity-grid">{activeProject.characters.map((character) => <article className="entity-card" key={character.id}><input className="entity-name" value={character.name} onChange={(e) => updateCharacter(character.id,{name:e.target.value})} /><label>{tr("storyRole")}<textarea rows={3} value={character.description} onChange={(e) => updateCharacter(character.id,{description:e.target.value})} /></label><label>{tr("visualIdentity")}<textarea rows={5} value={character.visualIdentity} onChange={(e) => updateCharacter(character.id,{visualIdentity:e.target.value})} placeholder="Ansikte, ålder, kroppsbyggnad, hår, bestående kännetecken…" /></label></article>)}</div>
            {!activeProject.characters.length ? <p className="quiet">{tr("noCharactersYet")}</p> : null}</section> : null}
          {projectTab === "locations" ? <section className="library-workspace"><div className="section-heading"><div><p className="eyebrow">{tr("visualContinuity")}</p><h2>{tr("locations")}</h2></div><div className="inline-add"><input value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLocation()} placeholder="Platsens namn…" /><button className="primary-button" disabled={!newLocationName.trim()} onClick={addLocation}>{tr("add")}</button></div></div>
            <div className="entity-grid">{activeProject.locations.map((location) => <article className="entity-card" key={location.id}><input className="entity-name" value={location.name} onChange={(e) => updateLocation(location.id,{name:e.target.value})} /><label>{tr("description")}<textarea rows={3} value={location.description} onChange={(e) => updateLocation(location.id,{description:e.target.value})} /></label><label>{tr("visualAnchor")}<textarea rows={5} value={location.visualIdentity} onChange={(e) => updateLocation(location.id,{visualIdentity:e.target.value})} placeholder="Arkitektur, material, färger, återkommande detaljer…" /></label></article>)}</div>
            {!activeProject.locations.length ? <p className="quiet">{tr("noLocationsYet")}</p> : null}</section> : null}
          {projectTab === "pages" ? <section className="page-workspace">
            <aside className="page-sidebar"><div className="section-heading"><div><p className="eyebrow">{tr("album")}</p><h2>{tr("pages")}</h2></div><button className="primary-button" onClick={addPage}>{tr("newPage")}</button></div>
              <div className="page-list">{activeProject.pages.map((page) => <button key={page.id} className={selectedPageId === page.id ? "page-nav is-selected" : "page-nav"} onClick={() => {setSelectedPageId(page.id);setLayoutStart(null);}}>Sida {page.number}<span>{page.placements.length} rutor</span></button>)}</div>
            </aside>
            {(() => { const page = activeProject.pages.find((item) => item.id === selectedPageId) ?? activeProject.pages[0]; if (!page) return <div className="workspace-card"><h2>{tr("createFirstPage")}</h2><button className="primary-button" onClick={addPage}>{tr("newPage")}</button></div>;
              return <div className="page-planner"><div className="section-heading"><div><p className="eyebrow">SIDA {page.number}</p><h2>Rita sidlayout</h2><p className="quiet">{layoutStart ? tr("dragSize") : tr("dragLayout")}</p></div><div className="edit-actions"><button className="text-button" disabled={page.number===1} onClick={()=>movePage(page.id,-1)}>← Sida</button><button className="text-button" disabled={page.number===activeProject.pages.length} onClick={()=>movePage(page.id,1)}>Sida →</button><button className="text-button danger-button" onClick={()=>deletePage(page.id)}>{tr("deletePage")}</button><select className="preset-select" defaultValue="" onChange={(e)=>{if(e.target.value)applyPreset(page.id,e.target.value);e.currentTarget.value="";}}><option value="">{tr("usePreset")}</option>{PAGE_PRESETS.map((preset)=><option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></div></div>
                <div className="grid-settings"><div><strong>{tr("projectDefault")}</strong><label>{tr("columns")} <input type="number" min="2" max="6" value={activeProject.pageDefaults.gridColumns} onChange={(e)=>setProjectGridDefaults(Number(e.target.value),activeProject.pageDefaults.gridRows)} /></label><label>{tr("rows")} <input type="number" min="2" max="8" value={activeProject.pageDefaults.gridRows} onChange={(e)=>setProjectGridDefaults(activeProject.pageDefaults.gridColumns,Number(e.target.value))} /></label><span className="quiet">{tr("appliesNewPages")}</span></div><div><strong>{tr("thisPage")}</strong><label>{tr("columns")} <input type="number" min="2" max="6" value={page.gridColumns} onChange={(e)=>setPageGrid(page.id,Number(e.target.value),page.gridRows)} /></label><label>{tr("rows")} <input type="number" min="2" max="8" value={page.gridRows} onChange={(e)=>setPageGrid(page.id,page.gridColumns,Number(e.target.value))} /></label><span className="quiet">{tr("resetLayout")}</span></div></div>
                <div className="layout-canvas">
                  <div className="construction-grid" onPointerLeave={()=>layoutStart&&setLayoutEnd(layoutEnd??layoutStart)} onPointerUp={()=>finishLayoutDrag(page.id)} style={{gridTemplateColumns:`repeat(${page.gridColumns},1fr)`,gridTemplateRows:`repeat(${page.gridRows},1fr)`}}>{Array.from({length:page.gridColumns*page.gridRows},(_,i)=>{const x=i%page.gridColumns,y=Math.floor(i/page.gridColumns);const selected=layoutStart&&layoutEnd&&x>=Math.min(layoutStart.x,layoutEnd.x)&&x<=Math.max(layoutStart.x,layoutEnd.x)&&y>=Math.min(layoutStart.y,layoutEnd.y)&&y<=Math.max(layoutStart.y,layoutEnd.y);return <div key={i} className={selected?"grid-cell is-start":"grid-cell"} onPointerDown={(e)=>{if(e.button!==0)return;e.preventDefault();setLayoutStart({x,y});setLayoutEnd({x,y});}} onPointerEnter={()=>layoutStart&&setLayoutEnd({x,y})} />;})}</div>
                  <div className="layout-panels" style={{gridTemplateColumns:`repeat(${page.gridColumns},1fr)`,gridTemplateRows:`repeat(${page.gridRows},1fr)`}}>{page.placements.map((placement)=>{const panel=placement.panelId?activeProject.panels.find((item)=>item.id===placement.panelId):undefined;return <div className="drawn-panel" onContextMenu={(e)=>{e.preventDefault();e.stopPropagation();setContextPlacement({pageId:page.id,placementId:placement.id,x:e.clientX,y:e.clientY});}} onDoubleClick={()=>{setPanelEditor({pageId:page.id,placementId:placement.id});setSelectedOverlayId((placement.overlays??[])[0]?.id??null);}} key={placement.id} style={{gridColumn:`${placement.x+1} / span ${placement.width}`,gridRow:`${placement.y+1} / span ${placement.height}`}}>{placement.image?<img className="panel-image" src={placement.image.dataUrl} alt="" />:null}<b>{placement.readingOrder}</b>{!placement.image?<span>{panel?.action || "Tom serieruta"}</span>:null}<span className="resize-handle resize-left" title="Ändra bredd" onPointerDown={(e)=>beginResize(e,page.id,placement,"left",page.gridColumns,page.gridRows)}>↔</span><span className="resize-handle resize-right" title="Ändra bredd" onPointerDown={(e)=>beginResize(e,page.id,placement,"right",page.gridColumns,page.gridRows)}>↔</span><span className="resize-handle resize-top" title="Ändra höjd" onPointerDown={(e)=>beginResize(e,page.id,placement,"top",page.gridColumns,page.gridRows)}>↕</span><span className="resize-handle resize-bottom" title="Ändra höjd" onPointerDown={(e)=>beginResize(e,page.id,placement,"bottom",page.gridColumns,page.gridRows)}>↕</span><svg className="panel-overlays panel-overlays-preview" viewBox="0 0 100 100" preserveAspectRatio="none">{(placement.overlays??[]).map((overlay)=><SvgOverlay key={overlay.id} overlay={overlay}/>)}</svg></div>;})}</div>
                </div>
                {contextPlacement?.pageId===page.id?<div className="panel-context-menu" style={{left:contextPlacement.x,top:contextPlacement.y}} onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>{(()=>{const p=page.placements.find((x)=>x.id===contextPlacement.placementId);if(!p)return null;return <><label className="context-file-action">{p.image?tr("changeImage"):tr("uploadImage")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{const file=e.target.files?.[0];if(file)loadPlacementImage(page.id,p.id,file);setContextPlacement(null);}} /></label>{p.image?<button className="danger-button" onClick={()=>removePlacementImage(page.id,p.id)}>{tr("deleteImage")}</button>:null}<div className="menu-divider"/><button className="danger-button" onClick={()=>{removePlacement(page.id,p.id);setContextPlacement(null);}}>{tr("deletePanel")}</button></>;})()}</div>:null}
                <div className="placement-list"><h3>{tr("panelsReadingOrder")}</h3>{page.placements.map((placement)=><div className="placement-row" key={placement.id}><strong>{placement.readingOrder}</strong><select value={placement.panelId??""} onChange={(e)=>setPlacementPanel(page.id,placement.id,e.target.value)}><option value="">{tr("noPanelSelected")}</option>{activeProject.panels.map((panel)=><option key={panel.id} value={panel.id}>{activeProject.scenes.find((s)=>s.id===panel.sceneId)?.title??"Scen"} — ruta {panel.order}</option>)}</select><button className="text-button" disabled={placement.readingOrder===1} onClick={()=>moveReadingOrder(page.id,placement.id,-1)}>↑</button><button className="text-button" disabled={placement.readingOrder===page.placements.length} onClick={()=>moveReadingOrder(page.id,placement.id,1)}>↓</button><button className="text-button" onClick={()=>{setPanelEditor({pageId:page.id,placementId:placement.id});setSelectedOverlayId((placement.overlays??[])[0]?.id??null);}}>{tr("editText")}</button><button className="text-button danger-button" onClick={()=>removePlacement(page.id,placement.id)}>{tr("remove")}</button></div>)}</div>
              </div>; })()}
          </section> : null}
        </section> : <>
          <header className="home-brand"><p className="eyebrow">{tr("comicWorkspace")}</p><h1>{tr("fromStory")}<br />{tr("toComic")}</h1>
            <p className="lede">Planera bildrutor, bygg konsekventa bildprompter och skapa din serie utan att låsa projektet till en viss AI-tjänst.</p></header>
          <section className="workspace-card"><div className="card-heading"><div><p className="eyebrow">{tr("yourProjects")}</p><h2>{projects.length ? tr("continueWhere") : tr("createFirst")}</h2></div>
            <button className="primary-button" type="button" onClick={() => setPanel("new-project")}>{tr("newAlbum")}</button></div>
            {projects.length ? <div className="project-list">{projects.map((project) => <button key={project.id} type="button" onClick={() => setActiveProjectId(project.id)}><strong>{project.title}</strong><span>{project.style.name}</span></button>)}</div> : <p className="quiet">{tr("localIndependent")}</p>}
          </section>
        </>}
      </main>

      {panelEditor && activeProject ? (()=>{const pg=activeProject.pages.find(x=>x.id===panelEditor.pageId),pl=pg?.placements.find(x=>x.id===panelEditor.placementId);if(!pg||!pl)return null;const o=(pl.overlays??[]).find(item=>item.id===selectedOverlayId)??null;return <div className="panel-editor-backdrop" onPointerDown={(e)=>e.target===e.currentTarget&&setPanelEditor(null)}><section className="panel-editor-modal"><header><div><p className="eyebrow">{tr("panelEditor")}</p><h2>{tr("page")} {pg.number} · {tr("row")} {pl.readingOrder}</h2></div><div className="panel-editor-header-actions"><button className="primary-button compact-button" type="button" onClick={()=>addOverlay(pg.id,pl.id,"speech")}>{tr("addTextBox")}</button><button className="text-button" onClick={()=>setPanelEditor(null)}>{tr("close")}</button></div></header><div className="panel-editor-layout"><div className="panel-editor-stage">{pl.image?<img src={pl.image.dataUrl} alt="" />:<div className="panel-editor-empty">{tr("noImage")}</div>}<svg viewBox="0 0 100 100" preserveAspectRatio="none">{(pl.overlays??[]).map((item)=>{const selected=item.id===selectedOverlayId;return <g key={item.id} className={selected?"editable-overlay is-selected":"editable-overlay"}><g className="overlay-drag-surface" onPointerDown={(e)=>{setSelectedOverlayId(item.id);beginOverlayDrag(e,pg.id,pl.id,item,"move");}}><SvgOverlay overlay={item}/></g>{selected?<><rect className="overlay-selection-frame" x={item.x} y={item.y} width={item.width} height={item.height} rx="1"/><rect className="overlay-resize-grip" x={item.x+item.width-1.5} y={item.y+item.height-1.5} width="3" height="3" rx=".5" onPointerDown={(e)=>beginOverlayDrag(e,pg.id,pl.id,item,"resize")}/>{item.type==="speech"&&item.tailEnabled!==false&&item.tailX!==undefined&&item.tailY!==undefined?<circle className="overlay-tail-grip" cx={item.tailX} cy={item.tailY} r="1.6" onPointerDown={(e)=>beginOverlayDrag(e,pg.id,pl.id,item,"tail")}/>:null}</>:null}</g>})}</svg></div><aside className="panel-editor-tools"><div className="panel-properties-heading"><p className="eyebrow">{o?tr("properties"):tr("textLayer")}</p>{o?<button className="text-button danger-text" type="button" onClick={()=>deleteOverlay(pg.id,pl.id,o.id)}>{tr("remove")}</button>:null}</div>{o?<div className="panel-tool-card selected-panel-tool"><label>{tr("type")}<select value={o.type} onChange={(e)=>{const type=e.target.value as OverlayType;updateOverlay(pg.id,pl.id,o.id,{type,tailEnabled:type==="speech",tailX:type==="speech"?(o.tailX??o.x+o.width*.65):undefined,tailY:type==="speech"?(o.tailY??o.y+o.height*1.15):undefined,roundness:type==="caption"?(o.roundness??18):(o.roundness??60)});}}><option value="speech">{tr("speech")}</option><option value="caption">{tr("caption")}</option><option value="thought">{tr("thought")}</option><option value="sfx">{tr("sfx")}</option></select></label><label>{tr("roundness")}<input className="numeric-field" type="number" min="0" max="100" value={o.roundness??(o.type==="caption"?18:60)} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{roundness:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label><label>{tr("text")}<textarea rows={4} value={o.text} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{text:e.target.value})}/></label><label>{tr("font")}<select value={o.fontFamily??"Comic Neue, sans-serif"} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fontFamily:e.target.value})}><option value="Comic Neue, sans-serif">Comic Neue</option><option value="Patrick Hand, cursive">Patrick Hand</option><option value="Handlee, cursive">Handlee</option><option value="Bad Script, cursive">Bad Script</option><option value="Gochi Hand, cursive">Gochi Hand</option><option value="Rancho, cursive">Rancho</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="Impact, sans-serif">Impact</option></select></label><div className="type-secondary-grid"><label>{tr("weight")}<select value={o.fontWeight??600} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fontWeight:Number(e.target.value)})}><option value="400">400 Normal</option><option value="500">500 Medium</option><option value="600">600 Semi-bold</option><option value="700">700 Bold</option><option value="800">800 Extra-bold</option><option value="900">900 Black</option></select></label><label>{tr("size")}<input className="numeric-field" type="number" min="1" max="120" step="0.5" value={o.fontSize??8} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fontSize:Math.max(1,Math.min(120,Number(e.target.value)||1))})}/></label></div>{o.type==="speech"?<><label className="tail-toggle"><input type="checkbox" checked={o.tailEnabled!==false} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{tailEnabled:e.target.checked,tailX:e.target.checked?(o.tailX??o.x+o.width*.65):o.tailX,tailY:e.target.checked?(o.tailY??o.y+o.height*1.15):o.tailY})}/> <span>{tr("tail")}</span></label>{o.tailEnabled!==false?<div className="tail-settings-grid"><label>{tr("bend")}<input className="numeric-field" type="number" min="-100" max="100" value={o.tailCurve??0} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{tailCurve:Math.max(-100,Math.min(100,Number(e.target.value)||0))})}/></label><label>{tr("rootWidth")}<input className="numeric-field" type="number" min="0" max="100" value={o.tailRootWidth??50} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{tailRootWidth:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label></div>:null}</>:null}</div>:<div className="panel-editor-empty-properties"><p>{tr("chooseTextBox")}</p><p className="quiet">{tr("createTextHint")}</p></div>}</aside></div></section></div>})() : null}
      {panel ? <div className="overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closePanel()}>
        <article className="guide-card" role="dialog" aria-modal="true">
          <div className="guide-actions"><button className="text-button" type="button" onClick={closePanel}>{tr("close")}</button></div>
          {panel === "new-project" ? <><p className="eyebrow">{tr("newProject")}</p><h1>{tr("newAlbum")}</h1>
            <div className="new-project-form"><label>{tr("projectName")}<input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="T.ex. Mysteriet på Svartön" /></label>
              <fieldset><legend>{tr("sourceMaterial")}</legend>
                <label><input type="radio" checked={newSource === "blank"} onChange={() => setNewSource("blank")} /> {tr("blankProject")}</label>
                <label className="disabled-choice"><input type="radio" disabled /> {tr("importText")} <small>{tr("nextStep")}</small></label>
                <label><input type="radio" checked={newSource === "storybook"} onChange={() => { setNewSource("storybook"); setStoryBookImport(null); setImportError(""); }} /> {tr("importStoryBook")}</label>
              </fieldset>
              {newSource === "storybook" ? <div className="storybook-import"><label className="file-picker">StoryBook-backup (.json)<input type="file" accept=".json,application/json" onChange={(e)=>{const file=e.target.files?.[0];if(file)void readStoryBookFile(file);}} /></label>{storyBookImport ? <label className="file-picker">Cards-export – valfri (.json)<input type="file" accept=".json,application/json" onChange={(e)=>{const file=e.target.files?.[0];if(file)void readStoryBookCardsFile(file);}} /></label> : null}{importError ? <p className="import-error">{importError}</p> : null}{storyBookImport ? <div className="import-review"><p className="eyebrow">{tr("reviewImport")}</p><strong>{storyBookImport.title}</strong><span>{storyBookImport.text.length} tecken · {storyBookImport.chapters.length} kapitel · {storyBookImport.characters.length} karaktärer · {storyBookImport.locations.length} platser</span>{storyBookCards ? <span>{storyBookCards.characters.filter((card)=>!storyBookImport.sourceBookId||cardMatchesBook(card,storyBookImport.sourceBookId)).length} Cards-karaktärer hittade · porträtt kopieras lokalt</span> : <span className="quiet">Du kan även välja en Cards-export för karaktärsporträtt.</span>}<label><input type="checkbox" checked={importCharacters} onChange={(e)=>setImportCharacters(e.target.checked)} /> {tr("copyCharacters")}</label><label><input type="checkbox" checked={importLocations} onChange={(e)=>setImportLocations(e.target.checked)} /> {tr("copyLocations")}</label><p className="quiet">{tr("importIndependent")}</p></div> : null}</div> : null}
              <label>{tr("styleTemplate")}<select value={newStyleId} onChange={(e) => setNewStyleId(e.target.value)}>{allStyles.map((style) => <option key={style.id} value={style.id}>{style.genre} — {style.name}</option>)}</select></label>
              <div className="style-preview"><span className="style-genre">{tr("projectSnapshot")}</span><p>{allStyles.find((style) => style.id === newStyleId)?.promptText}</p></div>
              <div className="style-editor-actions"><button className="text-button" type="button" onClick={closePanel}>{tr("cancel")}</button><button className="primary-button" type="button" disabled={!newTitle.trim() || (newSource==="storybook" && !storyBookImport)} onClick={newSource==="storybook" ? createFromStoryBook : createNewProject}>{newSource==="storybook" ? tr("importCreate") : tr("createProject")}</button></div>
            </div></> : null}
          {panel === "guide" ? <><p className="eyebrow">{tr("guide").toUpperCase()}</p><h1>ComicBook AI {tr("guide")}</h1><p className="lede">{tr("guidePlaceholder")}</p></> : null}
          {panel === "styles" ? <><p className="eyebrow">{tr("system")}</p><h1>{tr("styleTemplates")}</h1><p className="lede">{tr("styleTemplatesLead")}</p>
              <div className="style-tools"><input value={styleQuery} onChange={(e) => setStyleQuery(e.target.value)} placeholder={tr("searchStyle")} aria-label={tr("searchStyle")} />
                <select value={styleGenre} onChange={(e) => setStyleGenre(e.target.value)} aria-label="Genre"><option>{tr("all")}</option>{STYLE_GENRES.map((genre) => <option key={genre}>{genre}</option>)}<option>Custom</option></select>
                <button className="primary-button" type="button" onClick={() => setStyleDraft({ name: "", genre: "Custom", promptText: "" })}>{tr("newStyle")}</button></div>
              {styleDraft ? <div className="style-editor">
                <label>{tr("name")}<input value={styleDraft.name} onChange={(e) => setStyleDraft({ ...styleDraft, name: e.target.value })} /></label>
                <label>{tr("genre")}<input value={styleDraft.genre} onChange={(e) => setStyleDraft({ ...styleDraft, genre: e.target.value })} /></label>
                <label>{tr("prompt")}<textarea rows={6} value={styleDraft.promptText} onChange={(e) => setStyleDraft({ ...styleDraft, promptText: e.target.value })} /></label>
                <div className="style-editor-actions"><button className="text-button" type="button" onClick={() => setStyleDraft(null)}>{tr("cancel")}</button><button className="primary-button" type="button" onClick={saveDraft}>{tr("save")}</button></div>
              </div> : null}
              <div className="style-grid">{visibleStyles.map((style) => {
                const custom = style.id.startsWith("custom-");
                return <article className="style-card" key={style.id}><span className="style-genre">{style.genre}{custom ? ` · ${tr("custom")}` : ` · ${tr("builtin")}`}</span><h2>{style.name}</h2><p>{style.promptText}</p>
                  <div className="style-card-actions"><button className="text-button" type="button" onClick={() => duplicateStyle(style)}>{tr("duplicate")}</button>
                    {custom ? <><button className="text-button" type="button" onClick={() => setStyleDraft({ ...style })}>{tr("edit")}</button>
                    <button className="text-button danger-button" type="button" onClick={() => persistCustomStyles(customStyles.filter((item) => item.id !== style.id))}>{tr("delete")}</button></> : null}</div>
                </article>;
              })}</div></> : null}
          {panel === "settings" ? <><p className="eyebrow">{tr("system")}</p><h1>{tr("settings")}</h1><p className="lede">{tr("settingsLead")}</p>
            <div className="app-grid-setting"><h3>{tr("defaultGrid")}</h3><label>{tr("columns")} <input type="number" min="2" max="6" value={appPageGrid.gridColumns} onChange={(e)=>updateAppGrid(Number(e.target.value),appPageGrid.gridRows)} /></label><label>{tr("rows")} <input type="number" min="2" max="8" value={appPageGrid.gridRows} onChange={(e)=>updateAppGrid(appPageGrid.gridColumns,Number(e.target.value))} /></label></div><div className="ai-options" role="radiogroup" aria-label={tr("aiMode")}>{AI_MODES.map((mode) => (
              <button key={mode.id} type="button" className={aiMode === mode.id ? "ai-option is-selected" : "ai-option"} disabled={!mode.available}
                aria-pressed={aiMode === mode.id} onClick={() => mode.available && setAiMode(mode.id)}>
                <span><strong>{mode.id==="prompt"?tr("promptMode"):mode.id==="api"?tr("apiMode"):tr("localAi")}</strong>{!mode.available ? <small>{tr("comingLater")}</small> : null}</span><span>{mode.id==="prompt"?tr("promptModeDesc"):mode.id==="api"?tr("apiModeDesc"):tr("localAiDesc")}</span>
              </button>
            ))}</div></> : null}
        </article>
      </div> : null}
    </div>
  );
}