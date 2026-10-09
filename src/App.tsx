import { AboutDialog, aboutLabel } from "./AboutDialog";
import { PanelBorderControls } from "./PanelBorderControls";
import { PanelFrameOutline } from "./PanelFrameOutline";
import { panelBorderStyle, type PanelBorderStyle } from "./panelBorder";
import { fitPanelToNeighbor, panelsOverlap, type PanelSide } from "./panelGeometry";
import { PanelEdgeFitControls } from "./PanelEdgeFitControls";
import { imageViewStyle, framePosition, panFramePosition } from "./imageView";
import { PanelShapeControls, PanelShapeHandles, PanelShapeModeSwitch } from "./PanelShapeControls";
import { panelShapePoints, shapeClipPath, shapePolygon, shapedPanel, validPanelShape, type ShapePoint } from "./panelShape";
import { pageLayerTextMetrics } from "./pageTypography";
import { FontPicker } from "./FontPicker";
import { albumPageFormat, pageAspect, layerRect, pageGridMetrics, pageGridStyle, spacingFitsAlbum, PANEL_BORDER } from "./pageFormat";
import { ensurePageBackground, editPageBackground } from "./pageBackground";
import "./pageBackground.css";
import { PageBackgroundImagePicker } from "./PageBackgroundImagePicker";
import { SfxPicker } from "./SfxPicker";
import { AlbumMenu, type AlbumTool, type AlbumSection } from "./AlbumMenu";
import { restoredAlbumCopy } from "./albumBackup";
import { OverlayDefaultsEditor } from "./OverlayDefaultsEditor";
import { overlayDefaults } from "./overlayTypography";
import { PanelLibrary, PageFramePicker } from "./PanelLibrary";
import { assignLibraryPanel } from "./comicPanelLibrary";
import { LIBRARY_DRAG_TYPE, libraryDropTarget, dropLibraryPanel, canUndoLibraryDrop, undoLibraryDrop, type LibraryDropTarget, type LibraryDropUndo } from "./libraryDrop";
import "./libraryDrop.css";
import { PANEL_CORNERS, resizeFromCorner, layoutControlsText, type PanelCorner } from "./pageLayout";
import "./pageLayout.css";
import { ManuscriptWorkspace } from "./ManuscriptWorkspace";
import { withAdaptation } from "./manuscriptModel";
import { manuscriptText } from "./manuscriptText";
import { useEffect, useRef, useState } from "react";
import { AI_MODES, type AiMode } from "./ai";
import { applyLocale, applyTheme, LOCALES, readLocale, readTheme, readPageGridDefaults, savePageGridDefaults, type Locale, type Theme } from "./settings";
import { hasProjectDatabase, loadProjectCollection, saveProjectCollection, ProjectStorageError } from "./projectDatabase";
import { classifyProjectSaveError, projectSaveErrorText, type ProjectSaveFailure } from "./projectSaveStatus";
import { ColorModeSelect } from "./ColorModeSelect";
import { renderOptionsForStyle, resolveColorMode, supportedColorModes, stylePromptForMode } from "./styleColorMode";
import { BUILTIN_STYLES, createCustomStyleId, readCustomStyles, saveCustomStyles, type IllustrationStyle } from "./stylesLibrary";
import { optimizeStylePreview } from "./stylePreview";
import { createProject, readProjects, type BubbleSwatch, type ComicProject, type ProjectSource } from "./project";
import { buildPanelPrompt } from "./promptBuilder";
import { PageGridControls } from "./PageGridControls";
import { PageCanvasHeader } from "./PageCanvasHeader";
import { parseStoryBookExport, parseStoryBookCards, cardMatchesBook, type StoryBookImport, type StoryBookCardsImport } from "./storybookImport";
import { SvgOverlay, thoughtTailEndpoint, bubbleTailStart, bubbleTailStartAngle } from "./SvgOverlay";
import type { OverlayType } from "./project";
import { uiText, type UiKey } from "./i18n";
import { panelize } from "./adaptation/panelize";
import { generateImagePrompts } from "./adaptation/prompts";
import type { StoryAdaptation } from "./adaptation/types";
import { readLocalAiSettings, saveLocalAiSettings } from "./localAi";
import { LocalAiSettings } from "./LocalAiSettings";
import { localAiText } from "./localAiText";

type Panel = "styles" | "guide" | "settings" | "new-project" | "about" | null;
type StyleDraft = Omit<IllustrationStyle, "id"> & { id?: string };
type ProjectTab = AlbumSection;

export function App() {
  const [albumTool,setAlbumTool]=useState<AlbumTool>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [aiMode, setAiMode] = useState<AiMode>("prompt");
  const [localAiSettings, setLocalAiSettings] = useState(readLocalAiSettings);
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [styleGenre, setStyleGenre] = useState("__all__");
  const [styleQuery, setStyleQuery] = useState("");
  const [customStyles, setCustomStyles] = useState<IllustrationStyle[]>(readCustomStyles);
  const [styleDraft, setStyleDraft] = useState<StyleDraft | null>(null);
  const [projects, setProjects] = useState<ComicProject[]>(() => hasProjectDatabase() ? [] : readProjects());
  const [projectsReady, setProjectsReady] = useState(() => !hasProjectDatabase());
  const [loadFailure, setLoadFailure] = useState<ProjectSaveFailure | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newSource, setNewSource] = useState<ProjectSource>("blank");
  const [newStyleId, setNewStyleId] = useState(BUILTIN_STYLES[0].id);
  const [sceneTitle, setSceneTitle] = useState("");
  const [projectTab, setProjectTab] = useState<ProjectTab>("manus");
  const [adaptationStep, setAdaptationStep] = useState<3|4>(3);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [copiedPanelId, setCopiedPanelId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedLayoutPlacement,setSelectedLayoutPlacement]=useState<{pageId:string;placementId:string}|null>(null);
  const [shapeEditing,setShapeEditing]=useState(false);
  const [pageLayoutError,setPageLayoutError]=useState(false);
  useEffect(()=>setPageLayoutError(false),[selectedPageId,activeProjectId]);
  useEffect(()=>setShapeEditing(false),[activeProjectId,selectedPageId]);
  const imagePanCleanup=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>imagePanCleanup.current?.(),[]);
  const resizeCleanup=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>resizeCleanup.current?.(),[]);
  const [layoutStart, setLayoutStart] = useState<{x:number;y:number} | null>(null);
  const [layoutEnd, setLayoutEnd] = useState<{x:number;y:number} | null>(null);
  const libraryDragSource = useRef<{projectId:string;panelId:string}|null>(null);
  const [libraryHover, setLibraryHover] = useState<{pageId:string;target:LibraryDropTarget}|null>(null);
  const [libraryDropUndo, setLibraryDropUndo] = useState<LibraryDropUndo|null>(null);
  useEffect(()=>{libraryDragSource.current=null;setLibraryHover(null);},[activeProjectId,selectedPageId,projectTab]);
  useEffect(()=>{
    const clear=()=>{libraryDragSource.current=null;setLibraryHover(null);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")clear();};
    window.addEventListener("dragend",clear);window.addEventListener("keydown",escape);
    return ()=>{window.removeEventListener("dragend",clear);window.removeEventListener("keydown",escape);};
  },[]);
  const [contextPlacement, setContextPlacement] = useState<{pageId:string;placementId:string;x:number;y:number}|null>(null);
  const [panelEditor, setPanelEditor] = useState<{pageId:string;placementId:string}|null>(null);
  const [imageEditPlacementId, setImageEditPlacementId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [inspectSourcePanelId, setInspectSourcePanelId] = useState<string | null>(null);
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
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !imagePanCleanup.current) { setPanelEditor(null); setImageEditPlacementId(null); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [panelEditor]);

  const tr = (key: UiKey) => uiText(locale, key);
  const aiText = localAiText(locale);
  const updateLocalAiSettings = (settings: typeof localAiSettings) => {
    setLocalAiSettings(settings); saveLocalAiSettings(settings);
  };
  const panelAspectRatio = (page: ComicProject["pages"][number], placement: ComicProject["pages"][number]["placements"][number]) => {
    const format = albumPageFormat(activeProject ?? {});
    if (placement.id === page.background?.id) return pageAspect(format);
    const rect = layerRect(page, placement, format);
    return Math.max(1, rect.width - 2 * PANEL_BORDER) / Math.max(1, rect.height - 2 * PANEL_BORDER);
  };
  const closePanel = () => setPanel(null);
  const allStyles = [...BUILTIN_STYLES, ...customStyles];
  const styleCategories = Array.from(new Set(allStyles.map((style) => style.genre))).sort((a,b) => a.localeCompare(b));
  const visibleStyles = allStyles.filter((style) => {
    const genreMatch = styleGenre === "__all__" || style.genre === styleGenre;
    const q = styleQuery.trim().toLowerCase();
    return genreMatch && (!q || style.name.toLowerCase().includes(q) || style.promptText.toLowerCase().includes(q) || style.genre.toLowerCase().includes(q));
  });
  const persistCustomStyles = (next: IllustrationStyle[]) => { setCustomStyles(next); saveCustomStyles(next); };
  const saveDraft = () => {
    if (!styleDraft || !styleDraft.name.trim() || !styleDraft.promptText.trim()) return;
    const style: IllustrationStyle = {
      id: styleDraft.id ?? createCustomStyleId(),
      name: styleDraft.name.trim(),
      genre: styleDraft.genre.trim() || "Custom",
      promptText: styleDraft.promptText.trim(),
      previewImage: styleDraft.previewImage,
      supportedColorModes: styleDraft.supportedColorModes,
      modePromptText: styleDraft.modePromptText,
      decorativeSeals: styleDraft.decorativeSeals,
      linePreviewImage: styleDraft.linePreviewImage
    };
    persistCustomStyles(styleDraft.id ? customStyles.map((item) => item.id === styleDraft.id ? style : item) : [...customStyles, style]);
    setStyleDraft(null);
  };
  const duplicateStyle = (style: IllustrationStyle) => setStyleDraft({
    name: style.name + " – kopia",
    genre: style.genre,
    promptText: style.promptText,
    previewImage: style.previewImage,
    supportedColorModes: style.supportedColorModes,
    modePromptText: style.modePromptText,
    decorativeSeals: style.decorativeSeals,
    linePreviewImage: style.linePreviewImage
  });
  const [saveFailure, setSaveFailure] = useState<ProjectSaveFailure | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRevision = useRef(0);
  const persistProjects = async (next: ComicProject[]): Promise<ProjectSaveFailure | null> => {
    const revision = ++saveRevision.current;
    setSaving(true);
    try {
      await saveProjectCollection(next);
      if (revision === saveRevision.current) setSaveFailure(null);
      return null;
    } catch (error) {
      const failure = error instanceof ProjectStorageError ? error.failure : classifyProjectSaveError(error, "storage", "indexedDB");
      if (revision === saveRevision.current) setSaveFailure(failure);
      return failure;
    } finally { if (revision === saveRevision.current) setSaving(false); }
  };
  const saveErrorMessage = saveFailure ? projectSaveErrorText(saveFailure, locale) : undefined;
  useEffect(() => {
    if (!saveFailure && !saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveFailure, saving]);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const loadRevision = useRef(0);
  const loadStoredProjects = async () => {
    const revision = ++loadRevision.current;
    setLoadFailure(null);
    try {
      const loaded = await loadProjectCollection();
      if (revision !== loadRevision.current) return;
      projectsRef.current = loaded;
      setProjects(loaded);
      setProjectsReady(true);
    } catch (error) {
      if (revision === loadRevision.current) setLoadFailure(error instanceof ProjectStorageError ? error.failure : classifyProjectSaveError(error, "storage", "indexedDB"));
    }
  };
  useEffect(() => {
    if (hasProjectDatabase()) void loadStoredProjects();
    return () => { loadRevision.current++; saveRevision.current++; };
  }, []);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const activeAdaptation = activeProject?.adaptations?.[0] ?? null;
  const updateActiveProject = (update: (project: ComicProject) => ComicProject) => {
    if (!activeProjectId) return;
    const next = projectsRef.current.map(project => project.id === activeProjectId ? { ...(panelEditor&&project.pages.some(p=>p.id===panelEditor.pageId&&p.background?.id===panelEditor.placementId)?editPageBackground(project,panelEditor.pageId,update):update(project)), updatedAt: new Date().toISOString() } : project);
    projectsRef.current = next;
    setProjects(next);
    persistProjects(next);
  };
  const updateStyleDraftImage = async (field: "previewImage" | "linePreviewImage", file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await optimizeStylePreview(file);
      setStyleDraft((current) => current ? { ...current, [field]: dataUrl } : current);
    } catch {}
  };
  const applyStyleToActiveProject = (style: IllustrationStyle) => {
    updateActiveProject((project) => ({ ...project, style: { ...style }, renderOptions: renderOptionsForStyle(style, project.renderOptions) }));
  };
  const replaceActiveAdaptation = (adaptation: StoryAdaptation) => {
    updateActiveProject(project => withAdaptation(project, adaptation));
  };
  const updateAdaptation = (update: (adaptation: StoryAdaptation) => StoryAdaptation) => {
    if (!activeAdaptation) return;
    replaceActiveAdaptation({ ...update(activeAdaptation), updatedAt: new Date().toISOString() });
  };
  const runPanelization = () => {
    if (!activeAdaptation) return;
    setAdaptationStep(3);
    updateAdaptation((adaptation) => ({
      ...adaptation,
      status: "panels-generated",
      panelPlans: [...adaptation.panelPlans, ...panelize(adaptation.beats.filter(beat => !adaptation.panelPlans.some(plan => plan.sourceBeatIds.includes(beat.id)))).map((plan,index) => ({...plan,order:adaptation.panelPlans.length+index+1}))]
    }));
  };
  const updatePanelPlan = (panelId: string, patch: Partial<StoryAdaptation["panelPlans"][number]>) => {
    updateAdaptation((adaptation) => ({
      ...adaptation,
      status: "panels-generated",
      panelPlans: adaptation.panelPlans.map((panel) => panel.id === panelId ? { ...panel, ...patch, status: "edited" } : panel)
    }));
  };
  const updatePanelDialogue = (panelId: string, dialogueId: string, text: string) => {
    updateAdaptation((adaptation) => ({
      ...adaptation,
      status: "panels-generated",
      panelPlans: adaptation.panelPlans.map((panel) => panel.id === panelId
        ? { ...panel, status: "edited", dialogue: panel.dialogue.map((item) => item.id === dialogueId ? { ...item, text } : item) }
        : panel)
    }));
  };
  const updatePanelCaption = (panelId: string, captionId: string, text: string) => {
    updateAdaptation((adaptation) => ({
      ...adaptation,
      status: "panels-generated",
      panelPlans: adaptation.panelPlans.map((panel) => panel.id === panelId
        ? { ...panel, status: "edited", captions: panel.captions.map((item) => item.id === captionId ? { ...item, text } : item) }
        : panel)
    }));
  };
  const runPromptGeneration = () => {
    if (!activeProject || !activeAdaptation?.panelPlans.length) return;
    setAdaptationStep(4);
    const prompts = generateImagePrompts(activeProject, activeAdaptation.panelPlans, "full").map(prompt => {
      const previous = activeAdaptation.imagePrompts.find(item => item.panelId === prompt.panelId);
      return previous ? { ...prompt, id: previous.id, createdAt: previous.createdAt } : prompt;
    });
    updateAdaptation((adaptation) => ({
      ...adaptation,
      status: "prompts-generated",
      imagePrompts: prompts,
      panelPlans: adaptation.panelPlans.map((panel, index) => ({ ...panel, imagePromptId: prompts[index]?.id }))
    }));
  };
  const copyAdaptationPrompt = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const materializeAdaptationPlan = () => {
    if (!activeProject || !activeAdaptation?.panelPlans.length) return;
    updateActiveProject(project => withAdaptation(project, activeAdaptation));
  };
  const copyPlannedText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };
  const saveBubbleSwatch = (overlay: NonNullable<ComicProject["pages"][number]["placements"][number]["overlays"][number]>) => {
    const name = window.prompt(tr("swatchName"));
    if (!name?.trim()) return;
    const swatch: BubbleSwatch = {
      id: "swatch-" + crypto.randomUUID(),
      name: name.trim(),
      strokeColor: overlay.strokeColor ?? "#171411",
      strokeWidth: overlay.strokeWidth ?? 2,
      fillColor: overlay.fillColor ?? "#fffdf7",
      fillOpacity: overlay.fillOpacity ?? 1
    };
    updateActiveProject((project) => ({ ...project, bubbleSwatches: [...(project.bubbleSwatches ?? []), swatch] }));
  };
  const applyBubbleSwatch = (pageId: string, placementId: string, overlayId: string, swatch: BubbleSwatch) => {
    updateOverlay(pageId, placementId, overlayId, {
      strokeColor: swatch.strokeColor,
      strokeWidth: swatch.strokeWidth,
      fillColor: swatch.fillColor,
      fillOpacity: swatch.fillOpacity,
      swatchId: swatch.id
    });
  };
  const setSwatchCharacter = (swatchId: string, characterId: string) => {
    updateActiveProject((project) => ({
      ...project,
      bubbleSwatches: (project.bubbleSwatches ?? []).map((swatch) => swatch.id === swatchId ? { ...swatch, characterId: characterId || undefined } : swatch)
    }));
  };
  const deleteBubbleSwatch = (swatchId: string) => {
    updateActiveProject((project) => ({ ...project, bubbleSwatches: (project.bubbleSwatches ?? []).filter((swatch) => swatch.id !== swatchId) }));
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
  const addPage = () => updateActiveProject((project) => ({ ...project, pages: [...project.pages, { id: "page-" + crypto.randomUUID(), number: project.pages.length + 1, gridColumns: project.pageDefaults.gridColumns, gridRows: project.pageDefaults.gridRows, gridMode: "preset", placements: [] }] }));
  const setPageGrid = (pageId:string, gridColumns:number, gridRows:number) => {
    gridColumns=Math.max(2,Math.min(6,Math.round(gridColumns)));
    gridRows=Math.max(2,Math.min(8,Math.round(gridRows)));
    const page = activeProject?.pages.find((item) => item.id === pageId);
    if(!page||!Number.isFinite(gridColumns)||!Number.isFinite(gridRows)||(page.gridColumns===gridColumns&&page.gridRows===gridRows))return;
    if (!spacingFitsAlbum(albumPageFormat(activeProject ?? {}), [{gridColumns,gridRows}])) { setPageLayoutError(true); return; }
    setPageLayoutError(false);
    if (page.placements.length && !window.confirm("Rutnätsändringen tar bort sidans nuvarande layout. Fortsätta?")) return;
    setLayoutStart(null);
    updateActiveProject((project) => ({...project,pages:project.pages.map((item)=>item.id===pageId?{...item,gridColumns,gridRows,gridMode:"custom",background:item.background?{...item.background,width:gridColumns,height:gridRows}:undefined,placements:[]}:item)}));
  };
  const updateAppGrid = (gridColumns:number, gridRows:number) => { const value={gridColumns,gridRows}; setAppPageGrid(value); savePageGridDefaults(value); };
  const libraryTargetAt=(event:React.DragEvent<HTMLDivElement>,pageId:string)=>{
    const source=libraryDragSource.current;
    const project=projectsRef.current.find(project=>project.id===activeProjectId);
    if(!source||!project||source.projectId!==project.id||!Array.from(event.dataTransfer.types).includes(LIBRARY_DRAG_TYPE))return null;
    const grid=event.currentTarget.querySelector<HTMLElement>(".layout-panels");if(!grid)return null;
    const box=grid.getBoundingClientRect(),page=project.pages.find(p=>p.id===pageId);if(!page)return null;
    const metrics=pageGridMetrics(page,albumPageFormat(project)),scale=box.width/metrics.width;
    return libraryDropTarget(project,pageId,event.clientX-box.left,event.clientY-box.top,{width:box.width,height:box.height,gapX:metrics.gapX*scale,gapY:metrics.gapY*scale,border:PANEL_BORDER*scale});
  };
  const hoverLibraryImage=(event:React.DragEvent<HTMLDivElement>,pageId:string)=>{
    const target=libraryTargetAt(event,pageId);
    if(libraryDragSource.current&&Array.from(event.dataTransfer.types).includes(LIBRARY_DRAG_TYPE)){
      event.preventDefault();event.dataTransfer.dropEffect=target?"copy":"none";
    }
    setLibraryHover(current=>JSON.stringify(current)===JSON.stringify(target?{pageId,target}:null)?current:target?{pageId,target}:null);
  };
  const dropLibraryImage=(event:React.DragEvent<HTMLDivElement>,pageId:string)=>{
    const source=libraryDragSource.current,target=libraryTargetAt(event,pageId);
    event.preventDefault();libraryDragSource.current=null;setLibraryHover(null);
    if(!source||!target)return;
    try{
      const payload=JSON.parse(event.dataTransfer.getData(LIBRARY_DRAG_TYPE));
      if(payload.projectId!==source.projectId||payload.panelId!==source.panelId)return;
    }catch{return;}
    updateActiveProject(project=>{
      if(project.id!==source.projectId)return project;
      const result=dropLibraryPanel(project,pageId,target,source.panelId);if(!result)return project;
      setSelectedLayoutPlacement({pageId,placementId:result.undo.placementId});setLibraryDropUndo(result.undo);
      return result.project;
    });
  };
  const undoLibraryImage=()=>{
    if(!libraryDropUndo)return;
    updateActiveProject(project=>undoLibraryDrop(project,libraryDropUndo));
    if(!libraryDropUndo.previous)setSelectedLayoutPlacement(null);
    setLibraryDropUndo(null);
  };
  const finishLayoutDrag = (pageId:string) => {
    if (!layoutStart || !layoutEnd) { setLayoutStart(null); setLayoutEnd(null); return; }
    const rect={x:Math.min(layoutStart.x,layoutEnd.x),y:Math.min(layoutStart.y,layoutEnd.y),width:Math.abs(layoutEnd.x-layoutStart.x)+1,height:Math.abs(layoutEnd.y-layoutStart.y)+1};
    setLayoutStart(null); setLayoutEnd(null);
    updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>{
      if(page.id!==pageId||page.placements.some((item)=>panelsOverlap(page,item,{id:"candidate",readingOrder:0,overlays:[],...rect},albumPageFormat(project),project.panelBorderDefaults))) return page;
      const id="placement-"+crypto.randomUUID();setSelectedLayoutPlacement({pageId,placementId:id});
      return {...page,placements:[...page.placements,{id,...rect,readingOrder:page.placements.length+1,overlays:[]}]};
    })}));
  };
  const setPlacementRect=(pageId:string,placementId:string,rect:{x:number;y:number;width:number;height:number})=>updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>{
    if(page.id!==pageId)return page;
    const next={...rect,width:Math.max(1,rect.width),height:Math.max(1,rect.height)};
    if(next.x<0||next.y<0||next.x+next.width>page.gridColumns||next.y+next.height>page.gridRows)return page;
    if(page.placements.some((p)=>p.id!==placementId&&panelsOverlap(page,p,{...page.placements.find(item=>item.id===placementId)!,...next},albumPageFormat(project),project.panelBorderDefaults)))return page;
    return {...page,placements:page.placements.map((p)=>p.id===placementId?{...p,...next}:p)};
  })}));
  const beginResize=(event:React.PointerEvent, pageId:string, placement:ComicProject["pages"][number]["placements"][number], corner:PanelCorner, columns:number, rows:number)=>{
    if(event.button!==0)return;
    event.stopPropagation();event.preventDefault();resizeCleanup.current?.();
    const canvas=(event.currentTarget as HTMLElement).closest(".layout-canvas");
    const grid=canvas?.querySelector<HTMLElement>(".layout-panels");if(!grid)return;
    const box=grid.getBoundingClientRect(),metrics=pageGridMetrics({gridColumns:columns,gridRows:rows},albumPageFormat(activeProject??{})),scale=box.width/metrics.width;
    const stepX=(box.width+metrics.gapX*scale)/columns,stepY=(box.height+metrics.gapY*scale)/rows;
    if(stepX<=0||stepY<=0)return;
    const sx=event.clientX,sy=event.clientY,original={x:placement.x,y:placement.y,width:placement.width,height:placement.height};let last="";
    const move=(ev:PointerEvent)=>{const next=resizeFromCorner(original,corner,(ev.clientX-sx)/stepX,(ev.clientY-sy)/stepY,columns,rows);const key=JSON.stringify(next);if(key!==last){last=key;setPlacementRect(pageId,placement.id,next);}};
    const cleanup=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",cleanup);window.removeEventListener("pointercancel",cancel);window.removeEventListener("keydown",key);resizeCleanup.current=null;};
    const cancel=()=>{cleanup();setPlacementRect(pageId,placement.id,original);};
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();cancel();}};
    resizeCleanup.current=cleanup;
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",cleanup);window.addEventListener("pointercancel",cancel);window.addEventListener("keydown",key);
  };
  const setPlacementShape=(pageId:string,placementId:string,points:ShapePoint[])=>{
    if(!validPanelShape(points))return;
    updateActiveProject(project=>({...project,pages:project.pages.map(page=>{
      if(page.id!==pageId)return page;
      const layer=page.placements.find(p=>p.id===placementId);if(!layer)return page;
      const candidate={...layer,shapePoints:points};
      if(page.placements.some(p=>p.id!==placementId&&panelsOverlap(page,p,candidate,albumPageFormat(project),project.panelBorderDefaults)))return page;
      return {...page,placements:page.placements.map(p=>p.id===placementId?candidate:p)};
    })}));
  };
  const fitPlacementEdge=(pageId:string,placementId:string,neighborId:string,side:PanelSide,margin:number)=>{
    const project=projectsRef.current.find(p=>p.id===activeProjectId),page=project?.pages.find(p=>p.id===pageId);
    const layer=page?.placements.find(p=>p.id===placementId),neighbor=page?.placements.find(p=>p.id===neighborId);
    if(!project||!page||!layer||!neighbor)return false;
    const fitted=fitPanelToNeighbor(page,layer,neighbor,side,margin,albumPageFormat(project),project.panelBorderDefaults);if(!fitted)return false;
    updateActiveProject(p=>({...p,pages:p.pages.map(pg=>pg.id===pageId?{...pg,placements:pg.placements.map(item=>item.id===placementId?fitted:item)}:pg)}));
    return true;
  };
  const setPlacementBorder=(pageId:string,placementId:string,panelBorder:PanelBorderStyle|undefined)=>updateActiveProject(project=>({...project,pages:project.pages.map(page=>page.id!==pageId?page:{...page,placements:page.placements.map(layer=>layer.id===placementId?{...layer,panelBorder}:layer)})}));
  const loadPlacementImage=(pageId:string,placementId:string,file:File,background=false)=>{
    if(!file.type.startsWith("image/"))return;
    const reader=new FileReader();
    reader.onload=()=>{
      if(typeof reader.result!=="string")return;
      const image={name:file.name,dataUrl:reader.result,zoom:1,offsetX:0,offsetY:0,positionMode:"frame" as const,fit:"cover" as const};
      updateActiveProject((project)=>{
        const source=background?ensurePageBackground(project,pageId):project;
        return {...source,pages:source.pages.map((page)=>page.id!==pageId?page:{
          ...page,
          background:page.background?.id===placementId?{...page.background,image}:page.background,
          placements:page.placements.map((p)=>p.id===placementId?{...p,image}:p)
        })};
      });
    };
    reader.readAsDataURL(file);
  };
  const updatePlacementImageView=(pageId:string,placementId:string,patch:{zoom?:number;offsetX?:number;offsetY?:number;fit?:"cover"|"contain";positionMode?:"frame"},restore=false)=>{
    const stage=document.querySelector<HTMLElement>(".panel-editor-stage");
    const img=stage?.querySelector<HTMLImageElement>(".panel-editor-image-layer img");
    const box=stage?.getBoundingClientRect();
    updateActiveProject(project=>({...project,pages:project.pages.map(page=>page.id!==pageId?page:{...page,placements:page.placements.map(placement=>placement.id!==placementId||!placement.image?placement:{...placement,image:restore?{...placement.image,...patch}:{...placement.image,...framePosition(placement.image,box?.width??0,box?.height??0,img?.naturalWidth??0,img?.naturalHeight??0),positionMode:"frame",...patch}})})}));
  };
  const resetPlacementImageView=(pageId:string,placementId:string)=>updatePlacementImageView(pageId,placementId,{zoom:1,offsetX:0,offsetY:0,fit:"cover"});
  const beginImagePan=(event:React.PointerEvent<HTMLDivElement>,pageId:string,placementId:string,image:NonNullable<ComicProject["pages"][number]["placements"][number]["image"]>)=>{
    if(imageEditPlacementId!==placementId||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const stage=event.currentTarget.closest(".panel-editor-stage") as HTMLElement|null;if(!stage)return;
    const box=stage.getBoundingClientRect(),img=event.currentTarget.querySelector<HTMLImageElement>("img");
    if(box.width<=0||box.height<=0||!img)return;
    imagePanCleanup.current?.();
    const sx=event.clientX,sy=event.clientY,start=framePosition(image,box.width,box.height,img.naturalWidth,img.naturalHeight);
    const move=(ev:PointerEvent)=>updatePlacementImageView(pageId,placementId,{...panFramePosition(start,ev.clientX-sx,ev.clientY-sy,box.width,box.height),positionMode:"frame"});
    const cleanup=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",cleanup);window.removeEventListener("pointercancel",cancel);window.removeEventListener("keydown",key);imagePanCleanup.current=null;};
    const cancel=()=>{cleanup();updatePlacementImageView(pageId,placementId,{offsetX:image.offsetX,offsetY:image.offsetY,positionMode:image.positionMode},true);};
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();cancel();}};
    imagePanCleanup.current=cleanup;window.addEventListener("pointermove",move);window.addEventListener("pointerup",cleanup);window.addEventListener("pointercancel",cancel);window.addEventListener("keydown",key);
  };
  const wheelImageZoom=(event:React.WheelEvent<HTMLDivElement>,pageId:string,placementId:string,image:NonNullable<ComicProject["pages"][number]["placements"][number]["image"]>)=>{
    if(imageEditPlacementId!==placementId)return;
    event.preventDefault();event.stopPropagation();
    const next=Math.max(1,Math.min(4,(image.zoom??1)+(event.deltaY<0?.1:-.1)));
    updatePlacementImageView(pageId,placementId,{zoom:Number(next.toFixed(2))});
  };
  const removePlacementImage=(pageId:string,placementId:string)=>{setContextPlacement(null);updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((p)=>p.id===placementId?{...p,image:undefined}:p)})}));};
  const addOverlay=(pageId:string,placementId:string,type:OverlayType,initialText?:string,speakerId?:string)=>{
    const newOverlayId="overlay-"+crypto.randomUUID();
    updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>{
    if(placement.id!==placementId)return placement;
    const overlays=placement.overlays??[];
    const previous=type==="speech"?[...overlays].reverse().find((overlay)=>overlay.type==="speech"):undefined;
    const width=previous?.width??42,height=previous?.height??24;
    const x=previous?Math.max(0,Math.min(100-width,previous.x+4)):10;
    const y=previous?Math.max(0,Math.min(100-height,previous.y+4)):10;
    const dx=x-(previous?.x??x),dy=y-(previous?.y??y);
    const characterSwatch=speakerId?(project.bubbleSwatches??[]).find((swatch)=>swatch.characterId===speakerId):undefined;
    const overlay={id:newOverlayId,type,text:initialText??(type==="sfx"?"BOOM!":"Text"),x,y,width,height,rotation:0,bubbleStyle:"organic" as const,tailEnabled:type==="speech"?(previous?.tailEnabled??true):false,tailCurve:previous?.tailCurve??0,tailRootWidth:previous?.tailRootWidth??50,...overlayDefaults(project,type),strokeColor:characterSwatch?.strokeColor??previous?.strokeColor??"#171411",strokeWidth:characterSwatch?.strokeWidth??previous?.strokeWidth??2,fillColor:characterSwatch?.fillColor??previous?.fillColor??"#fffdf7",fillOpacity:characterSwatch?.fillOpacity??previous?.fillOpacity??1,swatchId:characterSwatch?.id??previous?.swatchId,tailX:(type==="speech"||type==="thought")?(previous?.tailX!==undefined?previous.tailX+dx:x+width*.65):undefined,tailY:(type==="speech"||type==="thought")?(previous?.tailY!==undefined?previous.tailY+dy:y+height*(type==="thought"?1.55:1.15)):undefined};
    return {...placement,overlays:[...overlays,overlay]};
  })})}));
    setSelectedOverlayId(newOverlayId);
  };
  const updateOverlay=(pageId:string,placementId:string,overlayId:string,patch:any)=>updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>placement.id!==placementId?placement:{...placement,overlays:(placement.overlays??[]).map((overlay)=>overlay.id===overlayId?{...overlay,...patch}:overlay)})})}));
  const deleteOverlay=(pageId:string,placementId:string,overlayId:string)=>{updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>placement.id!==placementId?placement:{...placement,overlays:(placement.overlays??[]).filter((overlay)=>overlay.id!==overlayId)})})}));if(selectedOverlayId===overlayId)setSelectedOverlayId(null);};

  const beginOverlayDrag=(event:React.PointerEvent<SVGGElement>,pageId:string,placementId:string,overlay:any,mode:"move"|"resize"|"tail"|"tail-start")=>{
    event.stopPropagation();event.preventDefault();
    const svg=(event.currentTarget.ownerSVGElement);if(!svg)return;
    const box=svg.getBoundingClientRect(),sx=event.clientX,sy=event.clientY,start={...overlay,...(overlay.type==="thought"?{tailX:thoughtTailEndpoint(overlay).x,tailY:thoughtTailEndpoint(overlay).y}:{})};
    const move=(ev:PointerEvent)=>{const dx=(ev.clientX-sx)/box.width*100,dy=(ev.clientY-sy)/box.height*100;
      if(mode==="move"){const x=Math.max(0,Math.min(100-start.width,start.x+dx)),y=Math.max(0,Math.min(100-start.height,start.y+dy));updateOverlay(pageId,placementId,overlay.id,{x,y,tailX:start.tailX===undefined?undefined:start.tailX+dx,tailY:start.tailY===undefined?undefined:start.tailY+dy});}
      if(mode==="resize")updateOverlay(pageId,placementId,overlay.id,{width:Math.max(6,Math.min(100-start.x,start.width+dx)),height:Math.max(5,Math.min(100-start.y,start.height+dy))});
      if(mode==="tail-start"){const anchor=bubbleTailStart(start);updateOverlay(pageId,placementId,overlay.id,{tailStartAngle:bubbleTailStartAngle(start,anchor.x+dx,anchor.y+dy)});}
      if(mode==="tail")updateOverlay(pageId,placementId,overlay.id,{tailX:Math.max(0,Math.min(100,(start.tailX??start.x+start.width/2)+dx)),tailY:Math.max(0,Math.min(100,(start.tailY??start.y+start.height)+dy))});
    };
    const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);
  };
  const setPlacementPanel = (pageId:string, placementId:string, panelId:string) => updateActiveProject(project => panelId ? assignLibraryPanel(project,pageId,placementId,panelId) : {...project,pages:project.pages.map(page=>page.id!==pageId?page:{...page,placements:page.placements.map(p=>p.id!==placementId?p:{...p,panelId:undefined,adaptationPanelPlanId:undefined,sourceBeatIds:undefined})})});
  useEffect(()=>{
    if(projectTab!=="pages" || !activeProject)return;
    if(activeProject.adaptations.some(a=>a.panelPlans.some(plan=>!activeProject.panels.some(p=>p.adaptationPanelPlanId===plan.id))))
      updateActiveProject(project=>project.adaptations.reduce((result,a)=>withAdaptation(result,a),project));
  },[projectTab,activeProject]);
  const linkPlacementToPanelPlan = (pageId:string, placementId:string, planId:string) => updateActiveProject((project) => {
    const adaptation = project.adaptations.find((item) => item.panelPlans.some((plan) => plan.id === planId));
    const plan = adaptation?.panelPlans.find((item) => item.id === planId);
    return {
      ...project,
      pages: project.pages.map((page) => page.id === pageId ? {
        ...page,
        placements: page.placements.map((placement) => placement.id === placementId ? {
          ...placement,
          adaptationPanelPlanId: planId || undefined,
          image: placement.image ?? plan?.image,
          sourceBeatIds: plan?.sourceBeatIds ?? placement.sourceBeatIds
        } : placement)
      } : page)
    };
  });
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
    setSelectedPageId(null); setSelectedLayoutPlacement(null); setLayoutStart(null);
  };

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
    const next=[project,...projects];projectsRef.current=next;setProjects(next);persistProjects(next);setActiveProjectId(project.id);setStoryBookImport(null);setStoryBookCards(null);setImportError("");setPanel(null);setProjectMenuOpen(false);
  };
  const deleteProject = (projectId:string) => {
    const project=projects.find((item)=>item.id===projectId);
    if(!project || !window.confirm(`Radera projektet "${project.title}"? Detta tar bort ComicBook AI:s lokala kopia och kan inte ångras. StoryBook-filer påverkas inte.`)) return;
    const next=projects.filter((item)=>item.id!==projectId);
    projectsRef.current=next;setProjects(next); persistProjects(next);
    if(activeProjectId===projectId){setActiveProjectId(null);setSelectedSceneId(null);setSelectedPageId(null);setLayoutStart(null);setProjectTab("manus");}
    setProjectMenuOpen(false);
  };
  const createNewProject = () => {
    if (!newTitle.trim()) return;
    const style = allStyles.find((item) => item.id === newStyleId) ?? BUILTIN_STYLES[0];
    const project = createProject(newTitle, newSource, style);
    const next = [project, ...projects]; projectsRef.current=next;setProjects(next); persistProjects(next); setActiveProjectId(project.id);
    setNewTitle(""); setNewSource("blank"); setPanel(null); setProjectMenuOpen(false);
  };

  if (!projectsReady) return <div className="app-shell"><main className="home"><section className="workspace-card">{loadFailure ? <><p role="alert">{locale === "sv" ? "Albumen kunde inte läsas. Inga sparade album har skrivits över." : locale === "nb" ? "Albumene kunne ikke leses. Ingen lagrede album er overskrevet." : "Albums could not be loaded. No saved albums have been overwritten."} ({loadFailure.errorName})</p><button type="button" onClick={() => void loadStoredProjects()}>{locale === "sv" ? "Försök igen" : locale === "nb" ? "Prøv igjen" : "Retry"}</button></> : <p role="status">{locale === "sv" ? "Läser sparade album…" : locale === "nb" ? "Leser lagrede album…" : "Loading saved albums…"}</p>}</section></main></div>;
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={closePanel} aria-label={tr("goHome")}>
          <img className="brand-logo brand-logo-light" src="/logo.png" alt="ComicBook AI" />
          <img className="brand-logo brand-logo-dark" src="/logo-dark.png" alt="ComicBook AI" />
        </button>
        <div className="top-menu" ref={menuRef}>
          <button className="text-button" type="button" aria-expanded={projectMenuOpen} onClick={() => setProjectMenuOpen((open) => !open)}>{tr("project")}</button>
          {projectMenuOpen ? <div className="menu-panel" role="menu">
            <button role="menuitem" type="button" className="menu-item" onClick={() => { setPanel("new-project"); setProjectMenuOpen(false); }}>{tr("newAlbum")}</button>
            <button role="menuitem" type="button" className="menu-item" onClick={()=>{setAlbumTool("backup");setProjectMenuOpen(false);}}>{locale==="sv"?"Återställ albumbackup":"Restore album backup"}</button>
            {projects.length ? <><div className="menu-divider" />{projects.slice(0, 5).map((project) => <div className="menu-project-row" key={project.id}><button role="menuitem" type="button" className="menu-item" onClick={() => { setActiveProjectId(project.id); setProjectMenuOpen(false); }}>{project.title}</button><button type="button" className="menu-delete-project" aria-label={`Radera ${project.title}`} title={tr("deleteProject")} onClick={() => deleteProject(project.id)}>×</button></div>)}</> : <><div className="menu-divider" /><span className="menu-empty">{tr("noRecent")}</span></>}
            <div className="menu-divider" /><button role="menuitem" type="button" className="menu-item" onClick={() => { setActiveProjectId(null); setProjectMenuOpen(false); }}>{tr("showAll")}</button>
            <div className="menu-divider" /><button role="menuitem" type="button" className="menu-item" onClick={() => { setPanel("about"); setProjectMenuOpen(false); }}>{aboutLabel(locale)}</button>
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
      {saveErrorMessage ? <div role="alert" className="import-error"><p>{saveErrorMessage}</p><button type="button" className="text-button" onClick={() => persistProjects(projectsRef.current)}>{locale === "sv" ? "Försök spara igen" : locale === "nb" ? "Prøv å lagre igjen" : "Retry save"}</button>{activeProject ? <button type="button" className="text-button" onClick={() => setAlbumTool("backup")}>{locale === "sv" ? "Exportera albumbackup" : locale === "nb" ? "Eksporter albumbackup" : "Export album backup"}</button> : null}</div> : null}

      <AlbumMenu section={projectTab} onSection={setProjectTab} saveError={saveErrorMessage} saving={saving} onRetrySave={() => persistProjects(projectsRef.current)} project={activeProject} locale={locale} mode={albumTool} onMode={setAlbumTool} styles={[...BUILTIN_STYLES,...customStyles]} onUpdate={updateActiveProject} onClose={()=>{setActiveProjectId(null);setAlbumTool(null);}} onRestore={async project=>{const restored=restoredAlbumCopy(project),next=[restored,...projectsRef.current];const error=await persistProjects(next);if(error)throw new Error(projectSaveErrorText(error,locale));projectsRef.current=next;setProjects(next);setActiveProjectId(restored.id);setSaveFailure(null);setSelectedPageId(null);setSelectedLayoutPlacement(null);setPanelEditor(null);setProjectTab("manus");}} />
      <main className="home">
        {activeProject ? <section className="project-shell album-workspace-shell">
          <aside className="project-sidebar" aria-label={locale==="sv"?"Arbetsinställningar":"Workspace settings"}>


              {projectTab==="adaptation"?<div className="adaptation-side-nav" aria-label={tr("adaptation")}>
                <button type="button" className={adaptationStep===3?"is-active":""} onClick={()=>setAdaptationStep(3)} disabled={!activeAdaptation}><span>1</span>{tr("step3").replace(/^3 · /,"")}</button>
                <button type="button" className={adaptationStep===4?"is-active":""} onClick={()=>setAdaptationStep(4)} disabled={!activeAdaptation?.panelPlans.length}><span>2</span>{tr("step4").replace(/^4 · /,"")}</button>
              </div>:null}
            {projectTab==="pages"?(()=>{const page=activeProject.pages.find(item=>item.id===selectedPageId)??activeProject.pages[0];if(!page)return <p className="quiet">{tr("createFirstPage")}</p>;return <section className="page-context-settings" aria-label={locale==="sv"?"Sidinställningar":"Page settings"}><h3>{locale==="sv"?"Sidinställningar":"Page settings"}</h3>
                <PageGridControls columns={page.gridColumns} rows={page.gridRows} custom={page.gridMode==="custom"||(!page.gridMode&&(page.gridColumns!==activeProject.pageDefaults.gridColumns||page.gridRows!==activeProject.pageDefaults.gridRows))} locale={locale} onChange={(columns,rows)=>setPageGrid(page.id,columns,rows)}/>
                <details className="page-background-controls"><summary>{locale==="sv"?"Sidans bakgrund":"Page background"}</summary><PageBackgroundImagePicker image={page.background?.image} locale={locale} onUpload={file=>loadPlacementImage(page.id,page.background?.id??`background-${page.id}`,file,true)} onRemove={()=>updateActiveProject(p=>({...p,pages:p.pages.map(item=>item.id===page.id&&item.background?{...item,background:{...item.background,image:undefined}}:item)}))}/><div className="page-background-actions"><button type="button" className="page-background-action-button" onClick={()=>{updateActiveProject(p=>ensurePageBackground(p,page.id));setSelectedLayoutPlacement({pageId:page.id,placementId:page.background?.id??`background-${page.id}`});}}>{locale==="sv"?"Välj från bildbiblioteket":"Choose from image library"}</button><button type="button" className="page-background-action-button" onClick={()=>{updateActiveProject(p=>ensurePageBackground(p,page.id));setPanelEditor({pageId:page.id,placementId:page.background?.id??`background-${page.id}`});setSelectedOverlayId(page.background?.overlays[0]?.id??null);}}>{locale==="sv"?"Redigera bakgrund och text":"Edit background and text"}</button>{page.background?<button type="button" className="page-background-action-button danger-button" onClick={()=>{if(!window.confirm(locale==="sv"?"Ta bort bakgrundslagret och dess text? Bildrutorna ovanpå finns kvar.":"Remove background and its text? Foreground frames remain."))return;updateActiveProject(p=>({...p,pages:p.pages.map(item=>item.id===page.id?{...item,background:undefined}:item)}));setSelectedLayoutPlacement(null);}}>{locale==="sv"?"Ta bort bakgrund":"Remove background"}</button>:null}</div><p className="quiet">{locale==="sv"?"Bakgrunden är en stor bildruta under sidans vanliga rutor. Ladda upp bilden här. Öppna redigeraren för att beskära och lägga till bubblor.":"The background is a full-page layer behind the frames. Upload the image here. Open the editor to crop and add text."}</p></details>
                <PageFramePicker project={activeProject} pageId={page.id} placementId={selectedLayoutPlacement?.pageId===page.id?selectedLayoutPlacement.placementId:undefined} locale={locale} onSelect={placementId=>{const pageId=activeProject.pages.find(p=>p.id===selectedPageId)?.id??activeProject.pages[0]?.id;if(pageId&&placementId==="__background__"){updateActiveProject(project=>ensurePageBackground(project,pageId));setSelectedLayoutPlacement({pageId,placementId:activeProject.pages.find(p=>p.id===pageId)?.background?.id??`background-${pageId}`});}else setSelectedLayoutPlacement(pageId&&placementId?{pageId,placementId}:null);}}/>
                <PanelShapeModeSwitch locale={locale} editing={shapeEditing} onEditing={setShapeEditing}/>{(()=>{const layer=selectedLayoutPlacement?.pageId===page.id?page.placements.find(p=>p.id===selectedLayoutPlacement.placementId):undefined;return layer?<><PanelShapeControls layer={layer} locale={locale} editing={shapeEditing} onChange={points=>setPlacementShape(page.id,layer.id,points)}/><PanelBorderControls value={panelBorderStyle(activeProject,layer)} locale={locale} inherited={!layer.panelBorder} onInherit={inherit=>setPlacementBorder(page.id,layer.id,inherit?undefined:panelBorderStyle(activeProject,layer))} onChange={border=>setPlacementBorder(page.id,layer.id,border)}/><PanelEdgeFitControls key={layer.id} page={page} layer={layer} locale={locale} onFit={(neighborId,side,margin)=>fitPlacementEdge(page.id,layer.id,neighborId,side,margin)}/></>:null;})()}
            </section>;})():null}
            <button className="project-sidebar-style" type="button" onClick={()=>setPanel("styles")}>{tr("imageStyles")}</button>
          </aside>
          <section className="project-workspace">

          {projectTab === "manus" ? <ManuscriptWorkspace key={activeProject.id} project={activeProject} locale={locale} settings={localAiSettings} onUpdate={updateActiveProject} onSettings={()=>setPanel("settings")} /> : null}
          {projectTab === "adaptation" ? <section className="adaptation-workspace">
            <div className="section-heading adaptation-heading"><h2>{tr("adaptationTitle")}</h2><button className="text-button" type="button" onClick={()=>setProjectTab("manus")}>{tr("manuscript")}</button></div>
            {activeAdaptation ? <>
              <div className="adaptation-summary"><span>{activeAdaptation.beats.length} {tr("beatsFound")}</span><span>{activeAdaptation.panelPlans.length} {tr("panelsWanted")}</span><span>{activeAdaptation.imagePrompts.length} {tr("promptReady")}</span></div>
              {adaptationStep===3?<section className="adaptation-step">
                <div className="adaptation-step-head"><div><span className="adaptation-step-number">1</span><h3>{tr("step3").replace(/^3 · /,"")}</h3></div><div className="adaptation-step-actions"><button className="text-button" type="button" disabled={!activeAdaptation.panelPlans.length} onClick={materializeAdaptationPlan}>{tr("createPanelSources")}</button><button className="primary-button" type="button" disabled={!activeAdaptation.beats.some(beat=>beat.status!=="discarded"&&!activeAdaptation.panelPlans.some(plan=>plan.sourceBeatIds.includes(beat.id)))} onClick={runPanelization}>{activeAdaptation.beats.some(beat=>beat.status!=="discarded"&&!activeAdaptation.panelPlans.some(plan=>plan.sourceBeatIds.includes(beat.id))) ? manuscriptText(locale).remaining : manuscriptText(locale).ready}</button></div></div>
                {activeAdaptation.panelPlans.length ? <div className="panel-plan-grid">{activeAdaptation.panelPlans.map((panel) => {
                  const materializedPanel = activeProject.panels.find((item)=>item.adaptationPanelPlanId===panel.id);
                  const placement = activeProject.pages.flatMap((page)=>page.placements.map((placement)=>({page,placement}))).find(({placement}) =>
                    placement.adaptationPanelPlanId===panel.id ||
                    (materializedPanel ? placement.panelId===materializedPanel.id : false)
                  );
                  const image = placement?.placement.image ?? panel.image;
                  const characters = panel.characterIds.map((id)=>activeProject.characters.find((character)=>character.id===id)).filter(Boolean);
                  const location = panel.locationId ? activeProject.locations.find((item)=>item.id===panel.locationId) : undefined;
                  return <article className="adaptation-card panel-plan-card storyboard-card" key={panel.id}>
                    <div className="storyboard-thumb">{image?<img src={image.dataUrl} alt="" style={imageViewStyle(image)} />:<span>{tr("noImage")}</span>}</div>
                    <div className="adaptation-card-meta"><span>{panel.order}</span><span>{panel.shotType}</span><span>{panel.sizeHint}</span></div>
                    <h4>{panel.title}</h4>
                    <div className="storyboard-controls"><label>{tr("shotType")}<select value={panel.shotType??"medium"} onChange={(e)=>updatePanelPlan(panel.id,{shotType:e.target.value as any})}><option value="establishing-wide">Establishing wide</option><option value="wide">Wide</option><option value="medium">Medium</option><option value="medium-close">Medium close</option><option value="close-up">Close-up</option><option value="extreme-close-up">Extreme close-up</option><option value="over-shoulder">Over shoulder</option><option value="reaction">Reaction</option><option value="insert">Insert</option></select></label><label>{tr("panelSize")}<select value={panel.sizeHint??"medium"} onChange={(e)=>updatePanelPlan(panel.id,{sizeHint:e.target.value as any})}><option value="small">{tr("small")}</option><option value="medium">{tr("medium")}</option><option value="large">{tr("large")}</option><option value="full-width">{tr("fullWidth")}</option><option value="splash">{tr("splash")}</option></select></label></div>
                    {(characters.length||location)?<div className="storyboard-context">{characters.length?<span>{characters.map((character:any)=>character.name).join(", ")}</span>:null}{location?<span>{location.name}</span>:null}</div>:null}
                    {panel.dialogue.length?<div className="storyboard-text"><strong>{tr("originalDialogue")}</strong>{panel.dialogue.map((dialogue)=><q key={dialogue.id}>{dialogue.text}</q>)}</div>:null}
                    {panel.captions.length?<div className="storyboard-text"><strong>{tr("adaptedCaption")}</strong>{panel.captions.map((caption)=><span key={caption.id}>{caption.text}</span>)}</div>:null}
                    <details className="storyboard-direction"><summary>{tr("imageDirection")}</summary><textarea rows={4} value={panel.visualDescription} onChange={(e)=>updatePanelPlan(panel.id,{visualDescription:e.target.value})}/></details>
                    <details className="storyboard-source"><summary>{tr("sourceBeats")}</summary>{panel.sourceBeatIds.map((id)=>{const beat=activeAdaptation.beats.find((item)=>item.id===id);return beat?<p key={id}>{beat.order} – {beat.title}</p>:null})}</details>
                    <div className="storyboard-status">{placement?<span>{tr("onPage")}{placement.page.number ? ` · ${tr("page")} ${placement.page.number}`:""}</span>:<span>{tr("plannedOnly")}</span>}{image?<span>{tr("imageAdded")}</span>:null}</div>
                  </article>})}</div> : <p className="quiet">{tr("adaptationEmpty")}</p>}
                {activeProject.pages.some((page)=>page.placements.some((placement)=>placement.image && !placement.adaptationPanelPlanId && !activeProject.panels.find((panel)=>panel.id===placement.panelId)?.adaptationPanelPlanId)) ? <div className="unlinked-page-panels"><h4>{tr("unlinkedPagePanels")}</h4><p className="quiet">{tr("unlinkedPagePanelsHelp")}</p><div className="panel-plan-grid">{activeProject.pages.flatMap((page)=>page.placements.map((placement)=>({page,placement}))).filter(({placement})=>placement.image && !placement.adaptationPanelPlanId && !activeProject.panels.find((panel)=>panel.id===placement.panelId)?.adaptationPanelPlanId).map(({page,placement})=><article className="adaptation-card storyboard-card unlinked-storyboard-card" key={placement.id}><div className="storyboard-thumb"><img src={placement.image!.dataUrl} alt="" style={imageViewStyle(placement.image!)} /></div><div className="adaptation-card-meta"><span>{tr("page")} {page.number}</span><span>{tr("row")} {placement.readingOrder}</span><span>{tr("unlinked")}</span></div><label className="panel-plan-field">{tr("linkToSuggestion")}<select value="" onChange={(e)=>{if(e.target.value)linkPlacementToPanelPlan(page.id,placement.id,e.target.value)}}><option value="">{tr("chooseSuggestion")}</option>{activeAdaptation.panelPlans.map((plan)=><option key={plan.id} value={plan.id}>{plan.order} · {plan.title}</option>)}</select></label></article>)}</div></div> : null}
              </section>:null}
              {adaptationStep===4?<section className="adaptation-step">
                <div className="adaptation-step-head"><div><span className="adaptation-step-number">2</span><h3>{tr("step4").replace(/^4 · /,"")}</h3></div><button className="primary-button" type="button" disabled={!activeAdaptation.panelPlans.length} onClick={runPromptGeneration}>{activeAdaptation.imagePrompts.length ? tr("regeneratePrompts") : tr("createPrompts")}</button></div>
                {activeAdaptation.imagePrompts.length ? <div className="prompt-plan-list">{activeAdaptation.imagePrompts.map((prompt,index) => <article className="adaptation-card prompt-plan-card" key={prompt.id}><div className="prompt-plan-head"><strong>{tr("imagePrompt")} {index+1}</strong><button className="text-button" type="button" onClick={()=>copyAdaptationPrompt(prompt.prompt)}>{tr("copy")}</button></div><p>{prompt.prompt}</p></article>)}</div> : null}
              </section>:null}
            </> : <div className="adaptation-empty">{tr("adaptationEmpty")}</div>}
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
                <div className="panel-list">{panels.length ? panels.map((panel,index) => panel ? <article className="panel-editor" key={panel.id}><div className="panel-number">RUTA {index+1}<span className="panel-edit-actions">{panel.sourceBeatIds?.length?<button className="text-button" type="button" onClick={()=>setInspectSourcePanelId(panel.id)}>{tr("inspectSource")}</button>:null}<button className="text-button" disabled={index===0} onClick={()=>movePanel(scene.id,panel.id,-1)}>↑</button><button className="text-button" disabled={index===panels.length-1} onClick={()=>movePanel(scene.id,panel.id,1)}>↓</button><button className="text-button danger-button" onClick={()=>deletePanel(panel.id)}>{tr("delete")}</button></span></div>
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
            <aside className="page-sidebar" aria-label={locale==="sv"?"Bildbibliotek":"Image library"}>
              <PanelLibrary onDragStart={panelId=>{libraryDragSource.current={projectId:activeProject.id,panelId};setLibraryHover(null);setLayoutStart(null);setLayoutEnd(null);}} onDragEnd={()=>{libraryDragSource.current=null;setLibraryHover(null);}} project={activeProject} locale={locale} pageId={activeProject.pages.find(p=>p.id===selectedPageId)?.id??activeProject.pages[0]?.id} placementId={selectedLayoutPlacement?.pageId===(activeProject.pages.find(p=>p.id===selectedPageId)?.id??activeProject.pages[0]?.id)?selectedLayoutPlacement?.placementId:undefined} onAssign={panelId=>{if(selectedLayoutPlacement){const {pageId,placementId}=selectedLayoutPlacement;if(activeProject.pages.find(p=>p.id===pageId)?.background?.id===placementId)updateActiveProject(project=>editPageBackground(project,pageId,p=>assignLibraryPanel(p,pageId,placementId,panelId)));else setPlacementPanel(pageId,placementId,panelId);}}} />
            </aside>
            {(() => { const page = activeProject.pages.find((item) => item.id === selectedPageId) ?? activeProject.pages[0]; if (!page) return <div className="workspace-card"><h2>{tr("createFirstPage")}</h2><button className="primary-button" onClick={addPage}>{tr("newPage")}</button></div>;
              const pageIndex=activeProject.pages.findIndex(item=>item.id===page.id);
              const navigate=(direction:-1|1)=>{const target=activeProject.pages[pageIndex+direction];if(target){setSelectedPageId(target.id);setSelectedLayoutPlacement(null);setLayoutStart(null);setLayoutEnd(null);setContextPlacement(null);}};
              return <div className="page-planner">{pageLayoutError?<p role="alert">{locale==="sv"?"Rutnätet får inte plats med albumets marginaler och mellanrum. Minska dem i Albuminställningar först.":"The grid does not fit the album margins and spacing. Reduce them in Album settings first."}</p>:null}<PageCanvasHeader onNew={addPage} number={page.number} hasPrevious={pageIndex>0} hasNext={pageIndex<activeProject.pages.length-1} locale={locale} onPrevious={()=>navigate(-1)} onNext={()=>navigate(1)} onDelete={()=>deletePage(page.id)}/>

                {libraryDropUndo&&libraryDropUndo.pageId===page.id&&canUndoLibraryDrop(activeProject,libraryDropUndo)?<div className="library-drop-undo" role="status"><span>{locale==="sv"?"Bilden har placerats.":locale==="nb"?"Bildet er plassert.":"Image placed."}</span><button className="text-button" type="button" onClick={undoLibraryImage}>{locale==="sv"?"Ångra bildplacering":locale==="nb"?"Angre bildeplassering":"Undo image placement"}</button></div>:null}
                <div style={{aspectRatio:String(pageAspect(albumPageFormat(activeProject)))}} className={`layout-canvas${page.background?.image?" has-page-background":""}${layoutStart?" is-drawing":""}`} onDragOver={event=>hoverLibraryImage(event,page.id)} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setLibraryHover(null);}} onDrop={event=>dropLibraryImage(event,page.id)} onClick={(e)=>{if(!(e.target as HTMLElement).closest(".drawn-panel"))setSelectedLayoutPlacement(null);}}>
                  {page.background?<div className="page-background-layer">{page.background.image?<img src={page.background.image.dataUrl} alt="" style={imageViewStyle(page.background.image)}/>:null}<svg viewBox="0 0 100 100" preserveAspectRatio="none">{page.background.overlays.map(o=><SvgOverlay key={o.id} overlay={o} textMetrics={pageLayerTextMetrics(activeProject,page,page.background!)}/>)}</svg></div>:null}
                  {selectedLayoutPlacement?.pageId===page.id && page.placements.some(p=>p.id===selectedLayoutPlacement.placementId)?<div className="layout-snap-grid" aria-hidden="true" style={{...pageGridStyle(albumPageFormat(activeProject)),gridTemplateColumns:`repeat(${page.gridColumns},1fr)`,gridTemplateRows:`repeat(${page.gridRows},1fr)`}}>{Array.from({length:page.gridColumns*page.gridRows},(_,i)=><span key={i}/>)}</div>:null}
                  <div className="construction-grid" onClick={e=>e.stopPropagation()} onPointerLeave={()=>layoutStart&&setLayoutEnd(layoutEnd??layoutStart)} onPointerUp={()=>finishLayoutDrag(page.id)} style={{...pageGridStyle(albumPageFormat(activeProject)),gridTemplateColumns:`repeat(${page.gridColumns},1fr)`,gridTemplateRows:`repeat(${page.gridRows},1fr)`}}>{Array.from({length:page.gridColumns*page.gridRows},(_,i)=>{const x=i%page.gridColumns,y=Math.floor(i/page.gridColumns);const selected=layoutStart&&layoutEnd&&x>=Math.min(layoutStart.x,layoutEnd.x)&&x<=Math.max(layoutStart.x,layoutEnd.x)&&y>=Math.min(layoutStart.y,layoutEnd.y)&&y<=Math.max(layoutStart.y,layoutEnd.y);return <div key={i} className={selected?"grid-cell is-start":"grid-cell"} onPointerDown={(e)=>{if(e.button!==0||shapeEditing)return;e.preventDefault();setSelectedLayoutPlacement(null);setLayoutStart({x,y});setLayoutEnd({x,y});}} onPointerEnter={()=>layoutStart&&setLayoutEnd({x,y})} />;})}</div>
                  <div className="layout-panels" style={{...pageGridStyle(albumPageFormat(activeProject)),gridTemplateColumns:`repeat(${page.gridColumns},1fr)`,gridTemplateRows:`repeat(${page.gridRows},1fr)`}}>{page.placements.map((placement)=>{const panel=placement.panelId?activeProject.panels.find((item)=>item.id===placement.panelId):undefined;const shaped=shapedPanel(placement),clip=shaped?shapeClipPath(placement):undefined;return <div className={(shaped?"is-shaped ":"")+(selectedLayoutPlacement?.pageId===page.id&&selectedLayoutPlacement.placementId===placement.id?"drawn-panel is-layout-selected":"drawn-panel")} tabIndex={0} aria-label={`${tr("row")} ${placement.readingOrder}`} onClick={(e)=>{e.stopPropagation();setSelectedLayoutPlacement({pageId:page.id,placementId:placement.id});}} onFocus={()=>setSelectedLayoutPlacement({pageId:page.id,placementId:placement.id})} onKeyDown={(e)=>{if(e.key==="Escape"&&!shapeEditing)setSelectedLayoutPlacement(null);}} onContextMenu={(e)=>{e.preventDefault();e.stopPropagation();setContextPlacement({pageId:page.id,placementId:placement.id,x:e.clientX,y:e.clientY});}} onDoubleClick={()=>{setPanelEditor({pageId:page.id,placementId:placement.id});setSelectedOverlayId((placement.overlays??[])[0]?.id??null);}} key={placement.id} style={{gridColumn:`${placement.x+1} / span ${placement.width}`,gridRow:`${placement.y+1} / span ${placement.height}`}}>{shaped?<svg className="panel-shape-fill" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={shapePolygon(panelShapePoints(placement))} fill="#fffdf7"/></svg>:null}{placement.image?<div className="panel-image-frame" style={{clipPath:clip}}><img className="panel-image" src={placement.image.dataUrl} alt="" style={imageViewStyle(placement.image)} /></div>:null}<b>{placement.readingOrder}</b>{!placement.image?<span>{panel?.action || "Tom serieruta"}</span>:null}{selectedLayoutPlacement?.pageId===page.id&&selectedLayoutPlacement.placementId===placement.id&&!shapeEditing?PANEL_CORNERS.map((corner,index)=><button key={corner} type="button" className={`panel-corner-handle corner-${corner}`} aria-label={`${layoutControlsText(locale).resize} ${placement.readingOrder}: ${layoutControlsText(locale).corners[index]}`} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onPointerDown={e=>beginResize(e,page.id,placement,corner,page.gridColumns,page.gridRows)} onKeyDown={e=>{const dx=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0,dy=e.key==="ArrowDown"?1:e.key==="ArrowUp"?-1:0;if(dx||dy){e.preventDefault();e.stopPropagation();setPlacementRect(page.id,placement.id,resizeFromCorner(placement,corner,dx,dy,page.gridColumns,page.gridRows));}}}/>):null}<svg className="panel-overlays panel-overlays-preview" style={{clipPath:clip}} viewBox="0 0 100 100" preserveAspectRatio="none">{(placement.overlays??[]).map((overlay)=><SvgOverlay key={overlay.id} overlay={overlay} textMetrics={pageLayerTextMetrics(activeProject,page,placement)}/>)}</svg><PanelFrameOutline project={activeProject} page={page} layer={placement}/>{libraryHover?.pageId===page.id&&libraryHover.target.kind==="frame"&&libraryHover.target.placementId===placement.id?<svg className="library-drop-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={shapePolygon(panelShapePoints(placement))}/></svg>:null}{shapeEditing&&selectedLayoutPlacement?.pageId===page.id&&selectedLayoutPlacement.placementId===placement.id?<PanelShapeHandles layer={placement} locale={locale} onChange={points=>setPlacementShape(page.id,placement.id,points)}/>:null}</div>;})}</div>
                  {libraryHover?.pageId===page.id&&libraryHover.target.kind==="new"?<div className="library-drop-preview" aria-hidden="true" style={{...pageGridStyle(albumPageFormat(activeProject)),gridTemplateColumns:`repeat(${page.gridColumns},1fr)`,gridTemplateRows:`repeat(${page.gridRows},1fr)`}}><div className="library-drop-new" style={{gridColumn:libraryHover.target.x+1,gridRow:libraryHover.target.y+1}}>{locale==="sv"?"Ny bildruta":locale==="nb"?"Ny bilderute":"New frame"}</div></div>:null}
                </div>
                {contextPlacement?.pageId===page.id?<div className="panel-context-menu" style={{left:contextPlacement.x,top:contextPlacement.y}} onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>{(()=>{const p=page.placements.find((x)=>x.id===contextPlacement.placementId);if(!p)return null;return <><label className="context-file-action">{p.image?tr("changeImage"):tr("uploadImage")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{const file=e.target.files?.[0];if(file)loadPlacementImage(page.id,p.id,file);setContextPlacement(null);}} /></label>{p.image?<button className="danger-button" onClick={()=>removePlacementImage(page.id,p.id)}>{tr("deleteImage")}</button>:null}<div className="menu-divider"/><button className="danger-button" onClick={()=>{removePlacement(page.id,p.id);setContextPlacement(null);}}>{tr("deletePanel")}</button></>;})()}</div>:null}
                <div className="placement-list"><h3>{tr("panelsReadingOrder")}</h3>{page.placements.map((placement)=><div className="placement-row" key={placement.id}><strong>{placement.readingOrder}</strong><select value={placement.panelId??""} onChange={(e)=>setPlacementPanel(page.id,placement.id,e.target.value)}><option value="">{tr("noPanelSelected")}</option>{activeProject.panels.map((panel)=>{const usedElsewhere=activeProject.pages.some((candidatePage)=>candidatePage.placements.some((candidate)=>candidate.panelId===panel.id&&!(candidatePage.id===page.id&&candidate.id===placement.id)));return <option key={panel.id} value={panel.id} disabled={usedElsewhere}>{activeProject.scenes.find((s)=>s.id===panel.sceneId)?.title??"Scen"} — ruta {panel.order}{usedElsewhere?` · ${tr("panelAlreadyUsed")}`:""}</option>})}</select>{activeAdaptation?.panelPlans.length?<select className="storyboard-link-select" value={placement.adaptationPanelPlanId??""} onChange={(e)=>linkPlacementToPanelPlan(page.id,placement.id,e.target.value)}><option value="">{tr("noStoryboardSuggestion")}</option>{activeAdaptation.panelPlans.map((plan)=><option key={plan.id} value={plan.id}>{plan.order} · {plan.title}</option>)}</select>:null}<button className="text-button" disabled={placement.readingOrder===1} onClick={()=>moveReadingOrder(page.id,placement.id,-1)}>↑</button><button className="text-button" disabled={placement.readingOrder===page.placements.length} onClick={()=>moveReadingOrder(page.id,placement.id,1)}>↓</button><button className="text-button" onClick={()=>{setPanelEditor({pageId:page.id,placementId:placement.id});setSelectedOverlayId((placement.overlays??[])[0]?.id??null);}}>{tr("editText")}</button>{placement.panelId&&activeProject.panels.find((item)=>item.id===placement.panelId)?.sourceBeatIds?.length?<button className="text-button" onClick={()=>setInspectSourcePanelId(placement.panelId!)}>{tr("inspectSource")}</button>:null}<button className="text-button danger-button" onClick={()=>removePlacement(page.id,placement.id)}>{tr("remove")}</button></div>)}</div>
              </div>; })()}
          </section> : null}
          </section>
        </section> : <>
          <header className="home-brand"><p className="eyebrow">{tr("comicWorkspace")}</p><h1>{tr("fromStory")}<br />{tr("toComic")}</h1>
            <p className="lede">Planera bildrutor, bygg konsekventa bildprompter och skapa din serie utan att låsa projektet till en viss AI-tjänst.</p></header>
          <section className="workspace-card"><div className="card-heading"><div><p className="eyebrow">{tr("yourProjects")}</p><h2>{projects.length ? tr("continueWhere") : tr("createFirst")}</h2></div>
            <button className="primary-button" type="button" onClick={() => setPanel("new-project")}>{tr("newAlbum")}</button></div>
            {projects.length ? <div className="project-list">{projects.map((project) => <button key={project.id} type="button" onClick={() => setActiveProjectId(project.id)}><strong>{project.title}</strong><span>{project.style.name}</span></button>)}</div> : <p className="quiet">{tr("localIndependent")}</p>}
          </section>
        </>}
      </main>

      {panelEditor && activeProject ? (()=>{const pg=activeProject.pages.find(x=>x.id===panelEditor.pageId),pl=pg?.background?.id===panelEditor.placementId?pg.background:pg?.placements.find(x=>x.id===panelEditor.placementId);if(!pg||!pl)return null;const o=(pl.overlays??[]).find(item=>item.id===selectedOverlayId)??null;const projectPanel=pl.panelId?activeProject.panels.find((item)=>item.id===pl.panelId):undefined;const panelPlan=projectPanel?.adaptationPanelPlanId?activeAdaptation?.panelPlans.find((item)=>item.id===projectPanel.adaptationPanelPlanId):undefined;return <div className="panel-editor-backdrop" onPointerDown={(e)=>{if(e.target===e.currentTarget){setPanelEditor(null);setImageEditPlacementId(null);}}}><section className="panel-editor-modal"><header><div><p className="eyebrow">{tr("panelEditor")}</p><h2>{tr("page")} {pg.number} · {pl.id===pg.background?.id?(locale==="sv"?"Bakgrund":"Background"):`${tr("row")} ${pl.readingOrder}`}</h2></div><div className="panel-editor-header-actions"><label className="text-button background-image-upload">{pl.image?tr("changeImage"):tr("uploadImage")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)loadPlacementImage(pg.id,pl.id,file);e.currentTarget.value="";}}/></label>{projectPanel?.sourceBeatIds?.length?<button className="text-button" type="button" onClick={()=>setInspectSourcePanelId(projectPanel.id)}>{tr("inspectSource")}</button>:null}<button className="primary-button compact-button" type="button" onClick={()=>addOverlay(pg.id,pl.id,"speech")}>{tr("addTextBox")}</button><button className="text-button" type="button" onClick={()=>addOverlay(pg.id,pl.id,"sfx")}>{locale==="sv"?"Lägg till SFX":"Add SFX"}</button><button className="text-button" onClick={()=>{setPanelEditor(null);setImageEditPlacementId(null);}}>{tr("close")}</button></div></header><div className="panel-editor-layout"><div className="panel-editor-stage-shell"><div className={(pl.id!==pg.background?.id&&shapedPanel(pl)?"is-shaped ":"")+(imageEditPlacementId===pl.id?"panel-editor-stage is-image-editing":"panel-editor-stage")} style={{"--panel-aspect":String(panelAspectRatio(pg,pl))} as React.CSSProperties}>{pl.image?<div className="panel-editor-image-layer" style={{clipPath:pl.id!==pg.background?.id&&shapedPanel(pl)?shapeClipPath(pl):undefined}} onPointerDown={(e)=>beginImagePan(e,pg.id,pl.id,pl.image!)} onWheel={(e)=>wheelImageZoom(e,pg.id,pl.id,pl.image!)}><img src={pl.image.dataUrl} alt="" draggable={false} style={imageViewStyle(pl.image)} /></div>:<label className="panel-editor-dropzone" style={{clipPath:pl.id!==pg.background?.id&&shapedPanel(pl)?shapeClipPath(pl):undefined}} onDragOver={(e)=>{e.preventDefault();e.dataTransfer.dropEffect="copy";}} onDrop={(e)=>{e.preventDefault();const file=e.dataTransfer.files?.[0];if(file)loadPlacementImage(pg.id,pl.id,file);}}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{const file=e.target.files?.[0];if(file)loadPlacementImage(pg.id,pl.id,file);e.currentTarget.value="";}}/><span>{tr("dropImage")}</span><small>{tr("dropImageHint")}</small></label>}<svg style={{clipPath:pl.id!==pg.background?.id&&shapedPanel(pl)?shapeClipPath(pl):undefined}} viewBox="0 0 100 100" preserveAspectRatio="none">{(pl.overlays??[]).map((item)=>{const selected=item.id===selectedOverlayId;return <g key={item.id} className={selected?"editable-overlay is-selected":"editable-overlay"}><g className="overlay-drag-surface" onPointerDown={(e)=>{setSelectedOverlayId(item.id);beginOverlayDrag(e,pg.id,pl.id,item,"move");}}><SvgOverlay overlay={item} textMetrics={pageLayerTextMetrics(activeProject,pg,pl)}/></g>{selected?<><rect className="overlay-selection-frame" x={item.x} y={item.y} width={item.width} height={item.height} rx="1"/><rect className="overlay-resize-grip" x={item.x+item.width-1.5} y={item.y+item.height-1.5} width="3" height="3" rx=".5" onPointerDown={(e)=>beginOverlayDrag(e,pg.id,pl.id,item,"resize")}/>{(item.type==="thought"||item.type==="speech"&&item.tailEnabled!==false&&item.tailX!==undefined&&item.tailY!==undefined)?<><circle className="overlay-tail-start-grip" aria-label={locale==="sv"?"Svansens start":"Tail start"} cx={bubbleTailStart(item).x} cy={bubbleTailStart(item).y} r="1.6" fill="#fffdf7" stroke="#b06f52" strokeWidth="0.5" style={{cursor:"grab",pointerEvents:"all"}} onPointerDown={e=>beginOverlayDrag(e,pg.id,pl.id,item,"tail-start")}/><circle className="overlay-tail-grip" cx={item.type==="thought"?thoughtTailEndpoint(item).x:item.tailX} cy={item.type==="thought"?thoughtTailEndpoint(item).y:item.tailY} r="1.6" onPointerDown={(e)=>beginOverlayDrag(e,pg.id,pl.id,item,"tail")}/></>:null}</>:null}</g>})}</svg>{pl.id!==pg.background?.id?<PanelFrameOutline project={activeProject} page={pg} layer={pl}/>:null}</div></div><aside className="panel-editor-tools"><OverlayDefaultsEditor project={activeProject} locale={locale} onChange={(type,value)=>updateActiveProject(project=>({...project,overlayDefaults:{...project.overlayDefaults,[type]:value}}))}/><section className="panel-source-picker"><p className="eyebrow">{tr("panelSource")}</p><select value={pl.panelId??""} onChange={(e)=>setPlacementPanel(pg.id,pl.id,e.target.value)}><option value="">{tr("noPanelSource")}</option>{activeProject.panels.map((panel)=>{const scene=activeProject.scenes.find((item)=>item.id===panel.sceneId);const usedElsewhere=activeProject.pages.some((candidatePage)=>candidatePage.placements.some((candidate)=>candidate.panelId===panel.id&&!(candidatePage.id===pg.id&&candidate.id===pl.id)));return <option key={panel.id} value={panel.id} disabled={usedElsewhere}>{scene?.title??tr("panels")} · {tr("row")} {panel.order}{usedElsewhere?` · ${tr("panelAlreadyUsed")}`:""}</option>})}</select>{activeAdaptation?.panelPlans.length?<><p className="eyebrow storyboard-link-label">{tr("storyboardSuggestion")}</p><select value={pl.adaptationPanelPlanId??""} onChange={(e)=>linkPlacementToPanelPlan(pg.id,pl.id,e.target.value)}><option value="">{tr("noStoryboardSuggestion")}</option>{activeAdaptation.panelPlans.map((plan)=><option key={plan.id} value={plan.id}>{plan.order} · {plan.title}</option>)}</select></>:null}{!pl.panelId&&!pl.adaptationPanelPlanId?<p className="quiet">{tr("panelSourceHelp")}</p>:null}</section>{pl.image?<section className="panel-image-controls"><div className="panel-image-controls-head"><p className="eyebrow">{tr("imageControls")}</p><button className={imageEditPlacementId===pl.id?"primary-button compact-button":"text-button"} type="button" onClick={()=>setImageEditPlacementId(imageEditPlacementId===pl.id?null:pl.id)}>{imageEditPlacementId===pl.id?tr("finishImageEdit"):tr("editImage")}</button></div>{imageEditPlacementId===pl.id?<p className="quiet">{tr("dragImageHint")}</p>:null}<label>{tr("imageFit")}<select value={pl.image.fit??"cover"} onChange={(e)=>updatePlacementImageView(pg.id,pl.id,{fit:e.target.value as "cover"|"contain"})}><option value="cover">{tr("fitCover")}</option><option value="contain">{tr("fitContain")}</option></select></label><label>{tr("zoom")}<div className="image-range-row"><input type="range" min="100" max="400" step="5" value={Math.round((pl.image.zoom??1)*100)} onChange={(e)=>updatePlacementImageView(pg.id,pl.id,{zoom:Number(e.target.value)/100})}/><span>{Math.round((pl.image.zoom??1)*100)}%</span></div></label><div className="image-position-grid"><label>{tr("imageX")}<input className="numeric-field" type="number" min="-100" max="100" step="1" value={Math.round(pl.image.offsetX??0)} onChange={(e)=>updatePlacementImageView(pg.id,pl.id,{offsetX:Math.max(-100,Math.min(100,Number(e.target.value)||0))})}/></label><label>{tr("imageY")}<input className="numeric-field" type="number" min="-100" max="100" step="1" value={Math.round(pl.image.offsetY??0)} onChange={(e)=>updatePlacementImageView(pg.id,pl.id,{offsetY:Math.max(-100,Math.min(100,Number(e.target.value)||0))})}/></label></div><button className="text-button" type="button" onClick={()=>resetPlacementImageView(pg.id,pl.id)}>{tr("resetImageView")}</button></section>:null}{panelPlan&&(panelPlan.dialogue.length||panelPlan.captions.length)?<section className="planned-text-panel"><p className="eyebrow">{tr("plannedText")}</p>{panelPlan.dialogue.map((item)=>{const speaker=activeProject.characters.find((character)=>character.id===item.speaker);return <div className="planned-text-item" key={item.id}><div><strong>{speaker?.name??tr("dialogue")}</strong><span className="text-origin">{item.source==="original"?tr("original"):item.source==="adapted"?tr("adapted"):tr("aiSuggested")}</span></div><p>{item.text}</p><div className="planned-text-actions"><button className="text-button" type="button" onClick={()=>copyPlannedText(item.text)}>⧉ {tr("copyText")}</button><button className="text-button" type="button" onClick={()=>addOverlay(pg.id,pl.id,item.bubbleType,item.text,item.speaker)}>{tr("addSpeechFromPlan")}</button></div></div>})}{panelPlan.captions.map((item)=><div className="planned-text-item" key={item.id}><div><strong>{tr("caption")}</strong><span className="text-origin">{item.source==="original"?tr("original"):item.source==="adapted"?tr("adapted"):tr("aiSuggested")}</span></div><p>{item.text}</p><div className="planned-text-actions"><button className="text-button" type="button" onClick={()=>copyPlannedText(item.text)}>⧉ {tr("copyText")}</button><button className="text-button" type="button" onClick={()=>addOverlay(pg.id,pl.id,"caption",item.text)}>{tr("addCaptionFromPlan")}</button></div></div>)}</section>:null}<div className="panel-properties-heading"><p className="eyebrow">{o?tr("properties"):tr("textLayer")}</p>{o?<button className="text-button danger-text" type="button" onClick={()=>deleteOverlay(pg.id,pl.id,o.id)}>{tr("remove")}</button>:null}</div>{o?<div className="panel-tool-card selected-panel-tool"><label>{tr("type")}<select value={o.type} onChange={(e)=>{const type=e.target.value as OverlayType;updateOverlay(pg.id,pl.id,o.id,{type,...overlayDefaults(activeProject,type),tailEnabled:type==="speech",tailX:(type==="speech"||type==="thought")?(o.tailX??o.x+o.width*.65):undefined,tailY:(type==="speech"||type==="thought")?(o.tailY??o.y+o.height*(type==="thought"?1.55:1.15)):undefined});}}><option value="speech">{tr("speech")}</option><option value="caption">{tr("caption")}</option><option value="thought">{tr("thought")}</option><option value="sfx">{tr("sfx")}</option></select></label>{o.type==="sfx"?<><SfxPicker value={o.sfxShapeId??"none"} locale={locale} onChange={sfxShapeId=>updateOverlay(pg.id,pl.id,o.id,{sfxShapeId})}/><label><input type="checkbox" checked={!o.sfxTextHidden} onChange={e=>updateOverlay(pg.id,pl.id,o.id,{sfxTextHidden:!e.target.checked})}/>{locale==="sv"?"Visa text":"Show text"}</label><label>{locale==="sv"?"Rotation (grader)":"Rotation (degrees)"}<input type="number" min="-180" max="180" value={o.rotation} onChange={e=>updateOverlay(pg.id,pl.id,o.id,{rotation:Math.max(-180,Math.min(180,Number(e.target.value)||0))})}/></label><label>{locale==="sv"?"Textfärg":"Text color"}<input type="color" value={o.sfxTextColor??"#171411"} onChange={e=>updateOverlay(pg.id,pl.id,o.id,{sfxTextColor:e.target.value})}/></label></>:null}<label>{tr("roundness")}<input className="numeric-field" type="number" min="0" max="100" value={o.roundness??(o.type==="caption"?18:60)} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{roundness:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label><label>{tr("text")}<textarea rows={4} value={o.text} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{text:e.target.value})}/></label><FontPicker label={tr("font")} value={o.fontFamily??"Comic Neue, sans-serif"} onChange={fontFamily=>updateOverlay(pg.id,pl.id,o.id,{fontFamily})}/><div className="type-secondary-grid"><label>{tr("weight")}<select value={o.fontWeight??600} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fontWeight:Number(e.target.value)})}><option value="300">300 Light</option><option value="400">400 Normal</option><option value="500">500 Medium</option><option value="600">600 Semi-bold</option><option value="700">700 Bold</option><option value="800">800 Extra-bold</option><option value="900">900 Black</option></select></label><label>{tr("size")} (pt)<input className="numeric-field" type="number" min="0.1" max="600" step="0.5" value={o.fontSize??8} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fontSize:Math.max(.1,Math.min(600,Number(e.target.value)||.1))})}/></label></div><label>{locale==="sv"?"Textjustering":"Text alignment"}<select value={o.textAlign??"center"} onChange={e=>updateOverlay(pg.id,pl.id,o.id,{textAlign:e.target.value})}><option value="left">{locale==="sv"?"Vänster":"Left"}</option><option value="center">{locale==="sv"?"Centrerad":"Center"}</option><option value="right">{locale==="sv"?"Höger":"Right"}</option></select></label><label>{locale==="sv"?"Sidmarginal (%)":"Side padding (%)"}<input type="number" min="0" max="25" value={o.textPadding??4} onChange={e=>updateOverlay(pg.id,pl.id,o.id,{textPadding:Math.max(0,Math.min(25,Number(e.target.value)))})}/></label><><div className="bubble-style-heading"><p className="eyebrow">{tr("bubbleAppearance")}</p><button className="text-button" type="button" onClick={()=>saveBubbleSwatch(o)}>{tr("saveSwatch")}</button></div><div className="bubble-color-grid"><label>{tr("strokeColor")}<input type="color" value={o.strokeColor??"#171411"} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{strokeColor:e.target.value,swatchId:undefined})}/></label><label>{tr("fillColor")}<input type="color" value={o.fillColor??"#fffdf7"} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fillColor:e.target.value,swatchId:undefined})}/></label><label>{tr("strokeWidth")}<input className="numeric-field" type="number" min="0" max="8" step="0.25" value={o.strokeWidth??2} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{strokeWidth:Math.max(0,Math.min(8,Number(e.target.value)||0)),swatchId:undefined})}/></label><label>{tr("fillOpacity")}<div className="opacity-control"><input type="range" min="0" max="100" value={Math.round((o.fillOpacity??1)*100)} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fillOpacity:Number(e.target.value)/100,swatchId:undefined})}/><span>{Math.round((o.fillOpacity??1)*100)}%</span></div></label></div>{activeProject.bubbleSwatches?.length?<div className="bubble-swatches"><span className="field-caption">{tr("savedSwatches")}</span><div className="swatch-row">{activeProject.bubbleSwatches.map((swatch)=><button key={swatch.id} type="button" className={o.swatchId===swatch.id?"bubble-swatch is-active":"bubble-swatch"} title={swatch.name} onClick={()=>applyBubbleSwatch(pg.id,pl.id,o.id,swatch)}><span style={{backgroundColor:swatch.fillColor,opacity:swatch.fillOpacity,borderColor:swatch.strokeColor,borderWidth:Math.max(1,swatch.strokeWidth)+"px"}}/><small>{swatch.name}</small></button>)}</div><details className="swatch-manager"><summary>{tr("characterSwatch")}</summary>{activeProject.bubbleSwatches.map((swatch)=><div className="swatch-manager-row" key={swatch.id}><span className="swatch-mini" style={{backgroundColor:swatch.fillColor,opacity:swatch.fillOpacity,borderColor:swatch.strokeColor}}/><strong>{swatch.name}</strong><select value={swatch.characterId??""} onChange={(e)=>setSwatchCharacter(swatch.id,e.target.value)}><option value="">{tr("noCharacter")}</option>{activeProject.characters.map((character)=><option key={character.id} value={character.id}>{character.name}</option>)}</select><button className="text-button danger-text" type="button" title={tr("deleteSwatch")} onClick={()=>deleteBubbleSwatch(swatch.id)}>×</button></div>)}</details></div>:null}</>{o.type==="thought"?<div className="tail-settings-grid"><label>{locale==="sv"?"Startbredd":"Start width"}<input className="numeric-field" type="number" min="0" max="100" value={o.thoughtTailWidth??50} onChange={e=>updateOverlay(pg.id,pl.id,o.id,{thoughtTailWidth:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label><label>{locale==="sv"?"Böjning":"Bend"}<input className="numeric-field" type="number" min="-100" max="100" value={o.thoughtTailCurve??30} onChange={e=>updateOverlay(pg.id,pl.id,o.id,{thoughtTailCurve:Math.max(-100,Math.min(100,Number(e.target.value)||0))})}/></label></div>:null}{o.type==="speech"?<><label className="tail-toggle"><input type="checkbox" checked={o.tailEnabled!==false} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{tailEnabled:e.target.checked,tailX:e.target.checked?(o.tailX??o.x+o.width*.65):o.tailX,tailY:e.target.checked?(o.tailY??o.y+o.height*1.15):o.tailY})}/> <span>{tr("tail")}</span></label>{o.tailEnabled!==false?<div className="tail-settings-grid"><label>{tr("bend")}<input className="numeric-field" type="number" min="-100" max="100" value={o.tailCurve??0} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{tailCurve:Math.max(-100,Math.min(100,Number(e.target.value)||0))})}/></label><label>{tr("rootWidth")}<input className="numeric-field" type="number" min="0" max="100" value={o.tailRootWidth??50} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{tailRootWidth:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label></div>:null}</>:null}</div>:<div className="panel-editor-empty-properties"><p>{tr("chooseTextBox")}</p><p className="quiet">{tr("createTextHint")}</p></div>}</aside></div></section></div>})() : null}
      {inspectSourcePanelId && activeProject ? (()=>{const sourcePanel=activeProject.panels.find((item)=>item.id===inspectSourcePanelId);const sourceBeats=(sourcePanel?.sourceBeatIds??[]).map((id)=>activeAdaptation?.beats.find((beat)=>beat.id===id)).filter(Boolean);return <div className="source-inspector-backdrop" onPointerDown={(e)=>e.target===e.currentTarget&&setInspectSourcePanelId(null)}><section className="source-inspector"><header><div><p className="eyebrow">{tr("sourceForPanel")}</p><h2>{sourcePanel?.order ? `${tr("row")} ${sourcePanel.order}` : tr("inspectSource")}</h2></div><button className="text-button" type="button" onClick={()=>setInspectSourcePanelId(null)}>{tr("closeSource")}</button></header>{sourceBeats.length?<div className="source-beat-list">{sourceBeats.map((beat:any)=><article key={beat.id}><div className="adaptation-card-meta"><span>{tr("sourceBeats")} {beat.order}</span><span>{beat.beatType}</span></div><h3>{beat.title}</h3><p>{beat.sourceTextExcerpt}</p>{beat.dialogueCandidates?.length?<div className="adaptation-snippet"><strong>{tr("originalDialogue")}</strong>{beat.dialogueCandidates.map((dialogue:any)=><q key={dialogue.id}>{dialogue.text}</q>)}</div>:null}</article>)}</div>:<p className="quiet">{tr("sourceUnavailable")}</p>}</section></div>})() : null}
      {panel === "about" ? <AboutDialog locale={locale} onClose={closePanel} returnFocus={menuRef.current?.querySelector("button")} /> : null}
      {panel && panel !== "about" ? <div className="overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closePanel()}>
        <article className="guide-card" role="dialog" aria-modal="true">
          <div className="guide-actions"><button className="text-button" type="button" onClick={closePanel}>{tr("close")}</button></div>
          {panel === "new-project" ? <><p className="eyebrow">{tr("newProject")}</p><h1>{tr("newAlbum")}</h1>
            <div className="new-project-form"><label>{tr("projectName")}<input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="T.ex. Mysteriet på Svartön" /></label>
              <fieldset><legend>{tr("sourceMaterial")}</legend>
                <label><input type="radio" checked={newSource === "blank"} onChange={() => setNewSource("blank")} /> {tr("blankProject")}</label>
                <label className="disabled-choice"><input type="radio" disabled /> {tr("importText")} <small>{tr("nextStep")}</small></label>
                <label><input type="radio" checked={newSource === "storybook"} onChange={() => { setNewSource("storybook"); setStoryBookImport(null); setImportError(""); }} /> {tr("importStoryBook")}</label>
              </fieldset>
              {newSource === "storybook" ? <div className="storybook-import"><div className="storybook-export-picker"><p className="quiet">{tr("storybookExportHelp")}</p><label className="file-picker">{tr("storybookExportFile")}<input type="file" accept=".json,application/json" onChange={(e)=>{const file=e.target.files?.[0];if(file)void readStoryBookFile(file);}} /></label></div>{storyBookImport ? <label className="file-picker">{tr("storybookCardsOptional")}<input type="file" accept=".json,application/json" onChange={(e)=>{const file=e.target.files?.[0];if(file)void readStoryBookCardsFile(file);}} /></label> : null}{importError ? <p className="import-error">{importError}</p> : null}{storyBookImport ? <div className="import-review"><p className="eyebrow">{tr("reviewImport")}</p><strong>{storyBookImport.title}</strong><span>{storyBookImport.text.length} tecken · {storyBookImport.chapters.length} kapitel · {storyBookImport.characters.length} karaktärer · {storyBookImport.locations.length} platser</span>{storyBookCards ? <span>{storyBookCards.characters.filter((card)=>!storyBookImport.sourceBookId||cardMatchesBook(card,storyBookImport.sourceBookId)).length} Cards-karaktärer hittade · porträtt kopieras lokalt</span> : <span className="quiet">{tr("storybookCardsHelp")}</span>}<label><input type="checkbox" checked={importCharacters} onChange={(e)=>setImportCharacters(e.target.checked)} /> {tr("copyCharacters")}</label><label><input type="checkbox" checked={importLocations} onChange={(e)=>setImportLocations(e.target.checked)} /> {tr("copyLocations")}</label><p className="quiet">{tr("importIndependent")}</p></div> : null}</div> : null}
              <label>{tr("styleTemplate")}<select value={newStyleId} onChange={(e) => setNewStyleId(e.target.value)}>{allStyles.map((style) => <option key={style.id} value={style.id}>{style.genre} — {style.name}</option>)}</select></label>
              <div className="style-preview"><span className="style-genre">{tr("projectSnapshot")}</span><p>{allStyles.find((style) => style.id === newStyleId)?.promptText}</p></div>
              <div className="style-editor-actions"><button className="text-button" type="button" onClick={closePanel}>{tr("cancel")}</button><button className="primary-button" type="button" disabled={!newTitle.trim() || (newSource==="storybook" && !storyBookImport)} onClick={newSource==="storybook" ? createFromStoryBook : createNewProject}>{newSource==="storybook" ? tr("importCreate") : tr("createProject")}</button></div>
            </div></> : null}
          {panel === "guide" ? <><p className="eyebrow">{tr("guide").toUpperCase()}</p><h1>ComicBook AI {tr("guide")}</h1><p className="lede">{tr("guidePlaceholder")}</p></> : null}
          {panel === "styles" ? <div className="style-library">
              <div className="style-library-head">
                <div><p className="eyebrow">{tr("styleTemplates")}</p><p className="style-library-subtitle">{activeProject ? `${activeProject.title} · ${activeProject.style.name}` : tr("styleTemplatesLead")}</p></div>
                <div className="style-library-head-actions">
                  {activeProject ? <ColorModeSelect style={activeProject.style} options={activeProject.renderOptions} locale={locale} onChange={renderOptions => updateActiveProject(project => ({ ...project, renderOptions }))} /> : null}
                  <button className="text-button" type="button" onClick={() => {
                    const source = activeProject?.style;
                    setStyleDraft(source ? { ...source, id: undefined, name: source.name + " – kopia" } : { name: "", genre: "Custom", promptText: "" });
                  }}>{tr("saveCurrentStyleAsNew")}</button>
                </div>
              </div>
              <div className="style-library-search">
                <input value={styleQuery} onChange={(e) => setStyleQuery(e.target.value)} placeholder={tr("searchStyle")} aria-label={tr("searchStyle")} autoFocus />
              </div>
              <div className="style-library-body">
                <aside className="style-category-list" aria-label={tr("genre")}>
                  <button type="button" className={styleGenre==="__all__"?"is-active":""} onClick={()=>setStyleGenre("__all__")}><span>{tr("all")}</span><span>{allStyles.length}</span></button>
                  {styleCategories.map((genre)=><button key={genre} type="button" className={styleGenre===genre?"is-active":""} onClick={()=>setStyleGenre(genre)}><span>{genre}</span><span>{allStyles.filter((style)=>style.genre===genre).length}</span></button>)}
                </aside>
                <div className="style-library-results">
                  {styleDraft ? <div className="style-editor">
                    <label>{tr("name")}<input value={styleDraft.name} onChange={(e) => setStyleDraft({ ...styleDraft, name: e.target.value })} /></label>
                    <label>{tr("genre")}<input value={styleDraft.genre} onChange={(e) => setStyleDraft({ ...styleDraft, genre: e.target.value })} /></label>
                    <label>{tr("prompt")}<textarea rows={6} value={styleDraft.promptText} onChange={(e) => setStyleDraft({ ...styleDraft, promptText: e.target.value })} /></label>
                    <label>{locale === "sv" ? "Tillåtna färglägen" : "Supported color modes"}<select value={styleDraft.supportedColorModes?.join(",") ?? "color,grayscale,line-art"} onChange={e => setStyleDraft({ ...styleDraft, supportedColorModes: e.target.value.split(",") as IllustrationStyle["supportedColorModes"] })}><option value="color,grayscale,line-art">{locale === "sv" ? "Alla lägen" : "All modes"}</option><option value="color,grayscale">{locale === "sv" ? "Färg och gråskala" : "Color and grayscale"}</option><option value="color">{locale === "sv" ? "Endast färg" : "Color only"}</option><option value="grayscale">{locale === "sv" ? "Endast gråskala" : "Grayscale only"}</option><option value="line-art">{locale === "sv" ? "Enbart linjer" : "Lines only"}</option></select></label>
                    {(["color", "grayscale", "line-art"] as const).filter(mode => styleDraft.modePromptText?.[mode] !== undefined).map(mode => <label key={mode}>{locale === "sv" ? "Promptvariant" : "Prompt variant"}: {mode}<textarea rows={6} value={styleDraft.modePromptText?.[mode] ?? ""} onChange={e => setStyleDraft({ ...styleDraft, modePromptText: { ...styleDraft.modePromptText, [mode]: e.target.value } })}/></label>)}
                    <div className="style-editor-images">
                      <div className="style-editor-image-slot"><span>Color preview</span>{styleDraft.previewImage?<div className="style-editor-image-preview"><img src={styleDraft.previewImage} alt="" /></div>:<div className="style-editor-image-empty">{tr("noImage")}</div>}<div className="style-editor-image-actions"><label className="text-button style-image-upload">{styleDraft.previewImage?tr("changeImage"):tr("uploadImage")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{const file=e.target.files?.[0];if(file)void updateStyleDraftImage("previewImage",file);e.currentTarget.value="";}} /></label>{styleDraft.previewImage?<button className="text-button danger-button" type="button" onClick={()=>setStyleDraft({...styleDraft,previewImage:undefined})}>{tr("deleteImage")}</button>:null}</div></div>
                      <div className="style-editor-image-slot"><span>Black and white preview</span>{styleDraft.linePreviewImage?<div className="style-editor-image-preview"><img src={styleDraft.linePreviewImage} alt="" /></div>:<div className="style-editor-image-empty">{tr("noImage")}</div>}<div className="style-editor-image-actions"><label className="text-button style-image-upload">{styleDraft.linePreviewImage?tr("changeImage"):tr("uploadImage")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{const file=e.target.files?.[0];if(file)void updateStyleDraftImage("linePreviewImage",file);e.currentTarget.value="";}} /></label>{styleDraft.linePreviewImage?<button className="text-button danger-button" type="button" onClick={()=>setStyleDraft({...styleDraft,linePreviewImage:undefined})}>{tr("deleteImage")}</button>:null}</div></div>
                    </div>
                    <div className="style-editor-actions"><button className="text-button" type="button" onClick={() => setStyleDraft(null)}>{tr("cancel")}</button><button className="primary-button" type="button" onClick={saveDraft}>{tr("save")}</button></div>
                  </div> : null}
                  <div className="style-grid">{visibleStyles.map((style) => {
                    const custom = style.id.startsWith("custom-");
                    const active = activeProject?.style.id===style.id;
                    const colorMode = resolveColorMode(style, activeProject?.renderOptions);
                    const linesOnly = colorMode !== "color";
                    const previewImage = linesOnly ? (style.linePreviewImage ?? style.previewImage) : style.previewImage;
                    const resolvedPreviewImage = previewImage;
                    const lineFallback = linesOnly && !style.linePreviewImage && Boolean(style.previewImage);
                    return <article className={active?"style-card is-active":"style-card"} key={style.id} onClick={()=>activeProject&&applyStyleToActiveProject(style)}>
                      <div className={lineFallback?"style-card-preview is-line-fallback":"style-card-preview"}>{resolvedPreviewImage?<img key={resolvedPreviewImage} src={resolvedPreviewImage} alt="" loading="lazy" decoding="async" />:<span>{tr("noImage")}</span>}<span className="style-preview-mode-badge">{supportedColorModes(style).map(mode => mode === "color" ? (locale === "sv" ? "FÄRG" : "COLOR") : mode === "grayscale" ? (locale === "sv" ? "GRÅSKALA" : "GRAYSCALE") : (locale === "sv" ? "LINJER" : "LINES")).join(" / ")}</span></div>
                      <button className="style-card-edit" type="button" title={custom?tr("edit"):tr("duplicate")} onClick={(e)=>{e.stopPropagation(); custom?setStyleDraft({...style}):duplicateStyle(style);}}>✎</button>
                      <div className="style-card-copy"><h2>{style.name}</h2><p>{stylePromptForMode(style, colorMode)}</p><span className="style-genre">{style.genre}{active?` · ${tr("activeStyle")}`:""}</span></div>
                    </article>;
                  })}</div>
                  {!visibleStyles.length?<p className="style-empty">{tr("noStylesFound")}</p>:null}
                </div>
              </div>
            </div> : null}
          {panel === "settings" ? <><p className="eyebrow">{tr("system")}</p><h1>{tr("settings")}</h1><p className="lede">{tr("settingsLead")}</p>
            <LocalAiSettings settings={localAiSettings} locale={locale} onChange={updateLocalAiSettings} />
            <h3>{aiText.imageHeading}</h3>
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

