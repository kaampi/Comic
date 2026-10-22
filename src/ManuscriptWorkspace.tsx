import { ManuscriptContext } from "./ManuscriptContext";
import { mergeBeatProposals } from "./mergeBeatProposals";
import { ManuscriptSceneList, ManuscriptSceneNavigation } from "./ManuscriptSceneList";
import { SCENE_ADAPTATION_PROMPT, prepareManuscriptScenes, createManuscriptScene, sceneRange, applySceneBeats } from "./manuscriptScenes";
import { ChapterBeatPilot } from "./ChapterBeatPilot";
import { manuscriptHtml } from "./manuscriptFormatting";
import { manuscriptChapters } from "./manuscriptChapters";
import { BeatAnalysisDialog } from "./BeatAnalysisDialog";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import type { LocalAiSettings, LocalChatDiagnostics } from "./localAi";
import type { AdaptationBeat, BeatType, PanelPlan } from "./adaptation/types";
import { suggestAiBeats, type SceneCoverage } from "./adaptation/aiBeats";
import {
  activeManuscriptAdaptation,
  addManualBeat,
  addBeatPanel,
  ensureBeatPanels,
  appendAiBeats,
  editManuscript,
  editManuscriptChapter,
  generateBeatPanelPrompt,
  patchBeatPanel,
  patchManuscriptBeat,
  removeManuscriptBeat,
  withAdaptation,
  type TextRange,
} from "./manuscriptModel";
import { manuscriptText } from "./manuscriptText";
import "./manuscript.css";
import { ImagePromptEditor } from "./ImagePromptEditor";
const beatTypes: BeatType[] = [
  "establishing",
  "introduction",
  "action",
  "dialogue",
  "reaction",
  "transition",
  "atmosphere",
  "climax",
  "resolution",
];
function PanelGroup({
  multiple,
  title,
  count,
  children,
}: {
  multiple: boolean;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return multiple ? (
    <details className="beat-panels-section beat-section" open>
      <summary>
        {title}
        <span className="beat-section-count">{count}</span>
      </summary>
      {children}
    </details>
  ) : (
    <section className="beat-inline-panel-group">{children}</section>
  );
}
function PanelCard({
  multiple,
  title,
  warning,
  children,
}: {
  multiple: boolean;
  title: string;
  warning: boolean;
  children: React.ReactNode;
}) {
  return multiple ? (
    <details className="beat-panel-card">
      <summary>
        <span>
          {title}
          {warning ? " ⚠" : ""}
        </span>
      </summary>
      {children}
    </details>
  ) : (
    <section className="beat-panel-card beat-inline-panel">{children}</section>
  );
}
export function ManuscriptWorkspace({
  project,
  locale,
  settings,
  onUpdate: updateProject,
  onSettings,
  selectedChapterId,
  onChapterChange,
}: {
  selectedChapterId?: string | null;
  onChapterChange?: (id: string | null) => void;
  project: ComicProject;
  locale: Locale;
  settings: LocalAiSettings;
  onUpdate: (update: (project: ComicProject) => ComicProject) => void;
  onSettings: () => void;
}) {
  const t = manuscriptText(locale),
    source = project.source.textSnapshot ?? "",
    adaptation = activeManuscriptAdaptation(project);
  const chapters=manuscriptChapters(project);
  const [localChapterId,setLocalChapterId]=useState<string|null>(chapters[0]?.id??null);
  const chapterId=selectedChapterId===undefined?localChapterId:selectedChapterId;
  const setChapterId=(id:string|null)=>{setLocalChapterId(id);onChapterChange?.(id);};
  const chapter=chapters.find(c=>c.id===chapterId)??chapters[0];
  const [activeSceneId,setActiveSceneId]=useState<string|null>(null);
  const [documentMode,setDocumentMode]=useState<'source'|'proposals'|'context'|'advanced'>('source');
  const [inspectorMode,setInspectorMode]=useState<'scene'|'beat'>((project.manuscriptScenes??[]).some(s=>chapter?s.chapterId===chapter.id:!s.chapterId)?'scene':'beat');
  const chapterSceneList=(project.manuscriptScenes??[]).filter(s=>chapter?s.chapterId===chapter.id:!s.chapterId).sort((a,b)=>(a.start??Infinity)-(b.start??Infinity));
  const activeScene=chapterSceneList.find(s=>s.id===activeSceneId)??chapterSceneList[0];
  const viewStart=chapter?.start??0,viewEnd=chapter?.end??source.length;
  const scopedBeats=chapter?adaptation.beats.filter(b=>b.chapterId===chapter.id||(b.sourceStart!==undefined&&b.sourceEnd!==undefined&&b.sourceStart<viewEnd&&b.sourceEnd>viewStart)):adaptation.beats;
  const ct=locale==="sv"?{chapter:"Kapitel",previous:"Föregående kapitel",next:"Nästa kapitel",analyse:"Föreslå beats för kapitlet",copy:"Lokal arbetskopia från StoryBook. Ändringar här påverkar inte originalet.",original:"Importerad originaltext (skrivskyddad)"}:locale==="nb"?{chapter:"Kapittel",previous:"Forrige kapittel",next:"Neste kapittel",analyse:"Foreslå beats for kapittelet",copy:"Lokal arbeidskopi fra StoryBook. Endringer her påvirker ikke originalen.",original:"Importert originaltekst (skrivebeskyttet)"}:{chapter:"Chapter",previous:"Previous chapter",next:"Next chapter",analyse:"Suggest beats for chapter",copy:"Local working copy from StoryBook. Changes here do not affect the original.",original:"Imported original text (read-only)"};
  const [selected, setSelected] = useState<string | null>(
      adaptation.beats[0]?.id ?? null,
    ),
    [range, setRange] = useState<TextRange | null>(null),
    [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [promptPanelId, setPromptPanelId] = useState<string | null>(null);
  const promptPanel = adaptation.panelPlans.find(p => p.id === promptPanelId);
  const [deletedBeat, setDeletedBeat] = useState<{
    project: ComicProject;
    beatId: string;
  } | null>(null);
  const onUpdate = (update: (project: ComicProject) => ComicProject) => {
    setDeletedBeat(null);
    updateProject(update);
  };
  const [width, setWidth] = useState(
    () =>
      Number(localStorage.getItem("comicbook-ai.manuscript-sidebar-width")) ||
      340,
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState(""),
    [draft, setDraft] = useState<{
      source: string;
      beats: AdaptationBeat[];
      sourceSceneId?:string;
      sceneSnapshot?:string;
      coverage?: SceneCoverage[];
    } | null>(null),
    [excluded, setExcluded] = useState<string[]>([]);
  useEffect(()=>{const next=prepareManuscriptScenes(project);if(next!==project)onUpdate(prepareManuscriptScenes);},[project]);
  const [mergeIds,setMergeIds]=useState<string[]>([]);
  const [mergeEdit,setMergeEdit]=useState<{base:string;beats:AdaptationBeat[];id:string;title:string;summary:string;reason:string}|null>(null);
  const [mergeUndo,setMergeUndo]=useState<{beats:AdaptationBeat[];after:string}|null>(null);
  useEffect(()=>{setMergeIds(ids=>ids.filter(id=>!excluded.includes(id)));},[excluded]);
  const proposalStale=!!draft&&(draft.source!==source||!!draft.sourceSceneId&&draft.sceneSnapshot!==JSON.stringify(project.manuscriptScenes?.find(s=>s.id===draft.sourceSceneId)));
  const mergeIndices=draft?.beats.flatMap((b,i)=>mergeIds.includes(b.id)?[i]:[])??[];
  const canMerge=!!draft&&!proposalStale&&mergeIndices.length>=2&&mergeIndices.at(-1)!-mergeIndices[0]+1===mergeIndices.length&&!mergeIds.some(id=>excluded.includes(id));
  useEffect(()=>{if(!draft){setDocumentMode('source');setMergeIds([]);setMergeEdit(null);setMergeUndo(null);}},[draft===null]);
  const [sceneDiagnostics,setSceneDiagnostics]=useState<{title:string;trace:LocalChatDiagnostics}|null>(null);
  const [sceneDraft,setSceneDraft]=useState<{range:TextRange;source:string;title:string;purpose:string;preserve:string}|null>(null);
  useEffect(() => {
    if (
      project.adaptations[0]?.beats.some(
        (beat) =>
          beat.status !== "discarded" && !beat.scenePlaceholder &&
          !project.adaptations[0].panelPlans.some((panel) =>
            panel.sourceBeatIds.includes(beat.id),
          ),
      )
    )
      onUpdate(ensureBeatPanels);
  }, [project]);
  const editor = useRef<HTMLDivElement>(null),
    caret = useRef<TextRange | null>(null),
    abort = useRef<AbortController | null>(null),
    request = useRef(0);
  useEffect(() => {
    request.current++;
    abort.current?.abort();
    setBusy(false);
    setRange(null);
    return () => {
      request.current++;
      abort.current?.abort();
    };
  }, [source]);
  const switchChapter=(id:string)=>{caret.current=null;setChapterId(id);};
  useEffect(()=>{
    request.current++;abort.current?.abort();setBusy(false);setRange(null);setMenu(null);setDraft(null);setSceneDraft(null);setSceneDiagnostics(null);setMessage("");caret.current=null;
    if(chapter)setSelected(scopedBeats[0]?.id??null);
  },[chapter?.id]);
  const updateSource=(p:ComicProject,value:string)=>chapter?editManuscriptChapter(p,chapter.id,value):editManuscript(p,value);
  useEffect(() => {
    try {
      localStorage.setItem(
        "comicbook-ai.manuscript-sidebar-width",
        String(width),
      );
    } catch {}
  }, [width]);
  const readRange = (): TextRange | null => {
    const s = window.getSelection(),
      root = editor.current;
    if (!s?.rangeCount || !root) return null;
    const r = s.getRangeAt(0);
    if (!root.contains(r.startContainer) || !root.contains(r.endContainer))
      return null;
    const prefix = r.cloneRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(r.startContainer, r.startOffset);
    const start = viewStart + prefix.toString().length;
    return { start, end: start + r.toString().length };
  };
  useLayoutEffect(() => {
    if (!caret.current || !editor.current) return;
    const desired = {start:caret.current.start-viewStart,end:caret.current.end-viewStart};
    caret.current = null;
    const walker = document.createTreeWalker(
      editor.current,
      NodeFilter.SHOW_TEXT,
    );
    const r = document.createRange();
    let node: Node | null,
      total = 0,
      startDone = false;
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length ?? 0;
      if (!startDone && desired.start <= total + length) {
        r.setStart(node, Math.max(0, desired.start - total));
        startDone = true;
      }
      if (startDone && desired.end <= total + length) {
        r.setEnd(node, Math.max(0, desired.end - total));
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
        break;
      }
      total += length;
    }
  }, [source, selected, chapter?.id]);
  useLayoutEffect(()=>{if(selected&&documentMode==='source')editor.current?.querySelector(`[data-beat-ids~="${selected}"]`)?.scrollIntoView?.({block:'nearest'});},[selected,documentMode]);
  const capture = () => {
    const next = readRange();
    setRange(next && next.end > next.start ? next : null);
  };
  const choose = (id: string) => {
    setDocumentMode('source');
    setInspectorMode('beat');
    const chosen=adaptation.beats.find(b=>b.id===id);if(chosen?.sourceSceneId)setActiveSceneId(chosen.sourceSceneId);
    setSelected(id);
    editor.current
      ?.querySelector(`[data-beat-ids~="${id}"]`)
      ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };
  const create = () => {
    if (!range) return;
    setInspectorMode('beat');
    onUpdate((p) => {
      const result = addManualBeat(p, range);
      setSelected(result.beatId);
      return result.project;
    });
    setMenu(null);
  };
  const analyse = async (chapterRange?:TextRange,sourceSceneId?:string) => {
    setMenu(null);
    setDocumentMode('source');
    const target=chapterRange??range;
    if (!target) return;
    if (!settings.servers[settings.engine].model.trim()) {
      setMessage(t.noModel);
      return;
    }
    const scene=sourceSceneId?project.manuscriptScenes?.find(s=>s.id===sourceSceneId):undefined;
    if(sourceSceneId&&(!scene||scene.omitted||!sceneRange(project,scene)||!scene.purpose.trim()))return;
    const approvedChapter=scene?.chapterId?chapters.find(c=>c.id===scene.chapterId):undefined;
    const contextChapter=project.adaptationContext?.chapters.find(c=>c.sourceId===approvedChapter?.sourceId);
    const scope = { ...target },
      snapshot = source;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const token = ++request.current;
    setBusy(true);
    setProgress("");
    setMessage("");
    setDraft(null);
    setMergeIds([]);setMergeEdit(null);setMergeUndo(null);
    setSceneDiagnostics(null);
    setExcluded([]);
    let timedOut = false;
    const timeout = () => {
      timedOut = true;
      controller.abort();
    };
    let timer = window.setTimeout(timeout, 300000);
    try {
      const coverage: SceneCoverage[] | undefined = undefined;
      const beats = await suggestAiBeats({
        source: snapshot.slice(scope.start, scope.end),
        sourceOffset: scope.start,
        context: {
          characters: project.characters,
          locations: project.locations,
        },
        settings,
        signal: controller.signal,
        ...(scene?{onDiagnostics:(trace:LocalChatDiagnostics)=>{if(token===request.current&&!controller.signal.aborted)setSceneDiagnostics({title:scene.title,trace});}}:{}),
        ...(scene?{singleRequest:true,selectionOnly:true,allowUnknownCharacters:true,taskPrompt:SCENE_ADAPTATION_PROMPT,narrativeContext:{synopsis:project.adaptationContext?.synopsis.approved?project.adaptationContext.synopsis.text:'',brief:contextChapter?.brief.approved?contextChapter.brief.text:'',sceneInstructions:scene.purpose,mustPreserve:scene.preserve}}:{}),
        onProgress: (done, total) => {
          if (token !== request.current) return;
          setProgress(`${Math.min(done + 1, total)} / ${total}`);
          window.clearTimeout(timer);
          timer = window.setTimeout(timeout, 300000);
        },
      });
      if (token === request.current && !controller.signal.aborted) {
        setDocumentMode('proposals');setDraft({ source: snapshot, coverage, sourceSceneId, sceneSnapshot:scene?JSON.stringify(scene):undefined, beats:beats.map(b=>({...b,...(sourceSceneId?{sourceSceneId}:{} )})) });}
    } catch (error) {
      if (token === request.current)
        setMessage(
          controller.signal.aborted
            ? timedOut
              ? t.timeout
              : t.cancelled
            : t.failed +
                " " +
                (error instanceof Error ? error.message : String(error)),
        );
    } finally {
      window.clearTimeout(timer);
      if (token === request.current) setBusy(false);
    }
  };
  const createScene=()=>{if(!range)return;setMenu(null);setSceneDraft({range:{...range},source,title:'',purpose:'',preserve:''});};
  const analyseScene=(id:string)=>{const scene=project.manuscriptScenes?.find(s=>s.id===id),target=scene&&sceneRange(project,scene);if(target)void analyse(target,id);};
  const beat = scopedBeats.find((b) => b.id === selected),
    index = scopedBeats.findIndex((b) => b.id === selected);
  const beatPanels = adaptation.panelPlans.filter((plan) =>
    !plan.archived && plan.sourceBeatIds.includes(beat?.id ?? ""),
  );
  const multiplePanels = beatPanels.length > 1;
  const patch = (change: Partial<AdaptationBeat>) => {
    if (beat) onUpdate((p) => patchManuscriptBeat(p, beat.id, change));
  };
  const markedSource=manuscriptHtml(source,scopedBeats,selected,viewStart,viewEnd);
  const editPrompt = (plan: PanelPlan, value: string) =>
    onUpdate((p) => {
      const a = activeManuscriptAdaptation(p),
        previous = a.imagePrompts.find((x) => x.panelId === plan.id),
        now = new Date().toISOString(),
        prompt = {
          ...previous,
          id: previous?.id ?? crypto.randomUUID(),
          panelId: plan.id,
          mode: previous?.mode ?? ("full" as const),
          prompt: value,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        };
      return withAdaptation(p, {
        ...a,
        imagePrompts: [
          ...a.imagePrompts.filter((x) => x.panelId !== plan.id),
          prompt,
        ],
        panelPlans: a.panelPlans.map((x) =>
          x.id === plan.id ? { ...x, imagePromptId: prompt.id } : x,
        ),
      });
    });
  const loadImage = (planId: string, file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setMessage(t.readError);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setMessage(t.readError);
    reader.onload = () => {
      if (typeof reader.result === "string")
        onUpdate((p) =>
          patchBeatPanel(p, planId, {
            image: { name: file.name, dataUrl: reader.result as string },
          }),
        );
    };
    reader.readAsDataURL(file);
  };
  const insertText = (text: string) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.current) return;
    const target = selection.getRangeAt(0);
    if (!editor.current.contains(target.commonAncestorContainer)) return;
    target.deleteContents();
    const node = document.createTextNode(text);
    target.insertNode(node);
    target.setStartAfter(node);
    target.collapse(true);
    selection.removeAllRanges();
    selection.addRange(target);
    caret.current = readRange();
    const value = editor.current.textContent ?? "";
    onUpdate((p) => updateSource(p, value));
  };
  return (
    <section
      className="manuscript-studio"
      style={
        {
          "--beat-sidebar": `${Math.max(320, Math.min(700, width))}px`,
        } as React.CSSProperties
      }
    >
      <aside className="manuscript-navigation" aria-label={locale==='sv'?'Kapitel och scener':'Chapters and scenes'}>
        {chapter?<nav className="manuscript-chapters" aria-label={ct.chapter}><button type="button" className="text-button" aria-label={ct.previous} disabled={chapter.order===1} onClick={()=>switchChapter(chapters[chapter.order-2].id)}>←</button><label>{ct.chapter}<select value={chapter.id} onChange={e=>switchChapter(e.target.value)}>{chapters.map(c=><option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}</select></label><span>{chapter.order} / {chapters.length}</span><button type="button" className="text-button" aria-label={ct.next} disabled={chapter.order===chapters.length} onClick={()=>switchChapter(chapters[chapter.order].id)}>→</button></nav>:null}
        <ManuscriptSceneNavigation project={project} chapterId={chapter?.id} locale={locale} selectedSceneId={activeScene?.id} onSelect={id=>{setActiveSceneId(id);setInspectorMode('scene');setDocumentMode('source');const first=adaptation.beats.find(b=>b.sourceSceneId===id);if(first)setSelected(first.id);}}/>
        <details><summary>Beats · {scopedBeats.length}</summary><div className="manuscript-navigation-beats">{scopedBeats.map(b=><button type="button" key={b.id} onClick={()=>choose(b.id)}>{b.order}. {b.title}</button>)}</div></details>
        <div className="manuscript-view-links">{draft?<button type="button" aria-pressed={documentMode==='proposals'} onClick={()=>setDocumentMode('proposals')}>{locale==='sv'?'Beatförslag':'Beat proposals'}</button>:null}<button type="button" aria-pressed={documentMode==='source'} onClick={()=>setDocumentMode('source')}>{locale==='sv'?'Manustext':'Source text'}</button><button type="button" aria-pressed={documentMode==='context'} onClick={()=>setDocumentMode('context')}>{locale==='sv'?'Berättelseunderlag':'Story context'}</button>{chapter?<button type="button" aria-pressed={documentMode==='advanced'} onClick={()=>setDocumentMode('advanced')}>{locale==='sv'?'Avancerat':'Advanced'}</button>:null}</div>
      </aside>
      <div className="manuscript-document">
        <p className="manuscript-context-line">{chapter?.title??project.title}{activeScene?` · ${activeScene.title}`:''}</p>

        <div className="manuscript-context-workspace" hidden={documentMode!=='context'}><ManuscriptContext project={project} chapterSourceId={chapter?.sourceId} locale={locale} onUpdate={onUpdate}/></div>
        {chapter?<div className="manuscript-advanced-workspace" hidden={documentMode!=='advanced'}><ChapterBeatPilot key={chapter.id} project={project} chapterId={chapter.id} locale={locale} settings={settings} onUpdate={onUpdate}/></div>:null}
        <div className="manuscript-source-area" hidden={documentMode!=='source'}>
        <div className="section-heading">
          <h2>{chapter?.title??t.zoom}</h2>
          <span>
            {scopedBeats.length} {t.count}
          </span>
        </div>
        <p className="quiet">{t.hint}</p>
        <div className="manuscript-toolbar">
          <button type="button" disabled={!range||busy} onMouseDown={e=>e.preventDefault()} onClick={createScene}>{locale==='sv'?'Skapa scen':'Create scene'}</button>
          <button
            type="button"
            className="primary-button"
            disabled={!range}
            onMouseDown={(e) => e.preventDefault()}
            onClick={create}
          >
            {t.create}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={!range || busy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void analyse()}
          >
            {t.ai}
          </button>
          {chapter?<button type="button" className="text-button" disabled={busy||!source.slice(viewStart,viewEnd).trim()} onClick={()=>void analyse({start:viewStart,end:viewEnd})}>{ct.analyse}</button>:null}
          {range ? (
            <small>
              {t.mark}: {range.end - range.start} {t.chars}
            </small>
          ) : null}
        </div>
        <div
          ref={editor}
          role="textbox"
          aria-label="Manus"
          aria-multiline="true"
          className="manuscript-source"
          contentEditable
          suppressContentEditableWarning
          onMouseUp={capture}
          onKeyUp={capture}
          onInput={(e) => {
            caret.current = readRange();
            const value = e.currentTarget.textContent ?? "";
            onUpdate((p) => updateSource(p, value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              insertText("\n");
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            insertText(e.clipboardData.getData("text/plain"));
          }}
          onClick={(e) => {
            const currentRange = readRange();
            if (currentRange && currentRange.end > currentRange.start) return;
            caret.current = currentRange;
            const node = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-beat-ids]",
            );
            if (node?.dataset.beatIds) {setInspectorMode('beat');setSelected(node.dataset.beatIds.split(" ")[0]);}
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            capture();
            setMenu({
              x: Math.max(8, Math.min(e.clientX, window.innerWidth - 280)),
              y: Math.max(8, Math.min(e.clientY, window.innerHeight - 180)),
            });
          }}
          dangerouslySetInnerHTML={{ __html: markedSource }}
        />
        {chapter?<details className="manuscript-original"><summary>{ct.original}</summary><pre>{chapter.originalText}</pre></details>:null}
        </div>
{busy ? <BeatAnalysisDialog locale={locale} progress={progress} returnFocus={editor.current} onCancel={() => { request.current++; abort.current?.abort(); setBusy(false); setMessage(t.cancelled); }} /> : null}
{message ? (
          <p role="alert">
            {message}
            <button type="button" className="text-button" onClick={onSettings}>
              {t.settings}
            </button>
          </p>
        ) : null}
{draft && documentMode==='proposals' ? (
          <section className="beat-ai-review">
            <h3>{t.aiReview}</h3>
            {(draft.source !== source || (!!draft.sourceSceneId&&draft.sceneSnapshot!==JSON.stringify(project.manuscriptScenes?.find(s=>s.id===draft.sourceSceneId)))) ? <p role="alert">{t.stale}</p> : null}
            {draft.sourceSceneId?<p>{locale==='sv'?'Granska urvalet och källstödet först. Bildregi, karaktärer och plats väljs senare. Beattypen Reaktion är ett lokalt startvärde.':'Review selection and source support first. Visual staging, characters and location are chosen later. Reaction is a local default beat type.'}</p>:null}
            {draft.coverage ? <section aria-label={locale==='sv'?'Scenens täckning':'Scene coverage'} className="beat-review-warning">
              <h4>{locale==='sv'?'Scenens täckning':'Scene coverage'}</h4>
              <p>{draft.coverage.some(row=>!row.verified||row.missing||!row.beatIds.length||row.beatIds.some(id=>excluded.includes(id))) ? (locale==='sv'?'Ofullständigt – innehåll saknas eller är inte redovisat.':'Incomplete – content is missing or unreported.') : (locale==='sv'?'AI:n uppger täckning. Granska att hela syftet verkligen syns i beatsen.':'AI reports coverage. Check that the beats convey the entire purpose.')}</p>
              <p>{locale==='sv'?'Detta är modellens egen bedömning, inte en verifiering av berättelsens innehåll.':'This is the model’s own assessment, not verification of story content.'}</p>
              {draft.coverage.map((row,i)=><div key={i}><strong>{row.requirement}</strong><p>{row.beatIds.filter(id=>!excluded.includes(id)).map(id=>`${locale==='sv'?'Beat':'Beat'} ${draft.beats.findIndex(b=>b.id===id)+1}`).join(', ') || (locale==='sv'?'Inga valda beats redovisade.':'No selected beats reported.')}</p>{row.missing?<p>{locale==='sv'?'Saknas: ':'Missing: '}{row.missing}</p>:null}{!row.verified?<p>{locale==='sv'?'Saknad eller ogiltig täckningsredovisning.':'Missing or invalid coverage report.'}</p>:null}{row.beatIds.some(id=>excluded.includes(id))?<p>{locale==='sv'?'Ett stödjande beat har valts bort; granska täckningen igen.':'A supporting beat was excluded; review coverage again.'}</p>:null}</div>)}
            </section>:null}
            <div className="beat-merge-controls">
              <p>{locale==='sv'?'Markera intilliggande förslag för sammanslagning. Ta med avgör vilka beats som läggs till i albumet.':'Mark consecutive proposals to merge. Include controls which beats are added to the album.'}</p>
              <button type="button" disabled={!canMerge||!!mergeEdit} onClick={()=>{try{const beats=mergeBeatProposals(draft.beats,mergeIds,draft.source);const merged=beats.find(b=>b.id===draft.beats.find(b=>mergeIds.includes(b.id))?.id)!;setMergeEdit({base:JSON.stringify(draft.beats),beats,id:merged.id,title:merged.title,summary:merged.summary,reason:merged.adaptationReason??''});}catch(error){setMessage(error instanceof Error?error.message:String(error));}}}>{locale==='sv'?'Slå ihop markerade förslag':'Merge marked proposals'}</button>
              <button type="button" disabled={!mergeUndo||proposalStale||!!mergeEdit||JSON.stringify(draft.beats)!==mergeUndo.after} onClick={()=>{if(!mergeUndo)return;setDraft({...draft,beats:mergeUndo.beats});setExcluded(excluded.filter(id=>mergeUndo.beats.some(b=>b.id===id)));setMergeUndo(null);setMergeIds([]);}}>{locale==='sv'?'Ångra sammanslagning':'Undo merge'}</button>
            </div>
            {mergeEdit?<section className="beat-merge-preview" aria-label={locale==='sv'?'Granska sammanslagning':'Review merge'}>
              <h4>{locale==='sv'?'Granska sammanslagning':'Review merge'}</h4>
              <p>{locale==='sv'?'Källan omfattar hela intervallet från första till sista markerade beatet, inklusive eventuell text däremellan. Redigera sammanfattningen före sammanslagning.':'The source covers the full range from the first to the last marked beat, including any text between them. Edit the summary before merging.'}</p>
              <label>{locale==='sv'?'Sammanslagen titel':'Merged title'}<input value={mergeEdit.title} onChange={e=>setMergeEdit({...mergeEdit,title:e.target.value})}/></label>
              <label>{locale==='sv'?'Sammanslagen sammanfattning':'Merged summary'}<textarea rows={5} value={mergeEdit.summary} onChange={e=>setMergeEdit({...mergeEdit,summary:e.target.value})}/></label>
              <label>{locale==='sv'?'Berättelsefunktion':'Story function'}<textarea rows={3} value={mergeEdit.reason} onChange={e=>setMergeEdit({...mergeEdit,reason:e.target.value})}/></label>
              <blockquote>{mergeEdit.beats.find(b=>b.id===mergeEdit.id)?.sourceTextExcerpt}</blockquote>
              <button type="button" disabled={proposalStale||!canMerge||mergeEdit.base!==JSON.stringify(draft.beats)||!mergeEdit.title.trim()||!mergeEdit.summary.trim()} onClick={()=>{if(proposalStale||!canMerge||mergeEdit.base!==JSON.stringify(draft.beats))return;const beats=mergeEdit.beats.map(b=>b.id===mergeEdit.id?{...b,title:mergeEdit.title.trim(),summary:mergeEdit.summary.trim(),adaptationReason:mergeEdit.reason.trim()}:b);setMergeUndo({beats:draft.beats,after:JSON.stringify(beats)});setDraft({...draft,beats,coverage:undefined});setExcluded(excluded.filter(id=>beats.some(b=>b.id===id)));setMergeIds([]);setMergeEdit(null);}}>{locale==='sv'?'Spara sammanslagning':'Save merge'}</button>
              <button type="button" onClick={()=>setMergeEdit(null)}>{locale==='sv'?'Avbryt':'Cancel merge'}</button>
            </section>:null}
            {draft.beats.map((b) => (
              <article key={b.id}>
                <label><input type="checkbox" aria-label={`${locale==='sv'?'Markera för sammanslagning':'Mark for merge'}: ${b.title}`} checked={mergeIds.includes(b.id)} disabled={excluded.includes(b.id)||proposalStale||!!mergeEdit} onChange={e=>setMergeIds(ids=>e.target.checked?[...ids,b.id]:ids.filter(id=>id!==b.id))}/>{locale==='sv'?'Markera för sammanslagning':'Mark for merge'}</label>
                <label>
                  <input
                    type="checkbox"
                    disabled={!!mergeEdit}
                    checked={!excluded.includes(b.id)}
                    onChange={(e) =>
                      setExcluded((ids) =>
                        e.target.checked
                          ? ids.filter((id) => id !== b.id)
                          : [...ids, b.id],
                      )
                    }
                  />
                  {t.include}
                </label>
                <input
                  aria-label={t.title}
                  value={b.title}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            coverage:d.coverage?.map(row=>({...row,verified:false})),
                            beats: d.beats.map((x) =>
                              x.id === b.id
                                ? { ...x, title: e.target.value }
                                : x,
                            ),
                          }
                        : d,
                    )
                  }
                />
                <textarea
                  aria-label={t.summary}
                  value={b.summary}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            coverage:d.coverage?.map(row=>({...row,verified:false})),
                            beats: d.beats.map((x) =>
                              x.id === b.id
                                ? {
                                    ...x,
                                    summary: e.target.value,
                                    visualCandidates: x.visualCandidates.map(
                                      (v) =>
                                        v.description === x.summary
                                          ? {
                                              ...v,
                                              description: e.target.value,
                                            }
                                          : v,
                                    ),
                                  }
                                : x,
                            ),
                          }
                        : d,
                    )
                  }
                />
                {!draft.sourceSceneId?<label>{locale === "sv" ? "Föreslagen bildscen" : "Suggested visual scene"}<textarea rows={3} value={b.visualCandidates[0]?.description ?? ""} onChange={e => setDraft(d => d ? { ...d, coverage:d.coverage?.map(row=>({...row,verified:false})), beats: d.beats.map(x => x.id === b.id ? { ...x, visualCandidates: x.visualCandidates.map((v, i) => i === 0 ? { ...v, description: e.target.value } : v) } : x) } : d)} /></label>:null}
                {b.adaptationReason?<p>{b.adaptationReason}</p>:null}
                <blockquote>{b.sourceTextExcerpt}</blockquote>
              </article>
            ))}
            <button
              type="button"
              className="primary-button"
              disabled={
                (draft.source !== source || (!!draft.sourceSceneId&&draft.sceneSnapshot!==JSON.stringify(project.manuscriptScenes?.find(s=>s.id===draft.sourceSceneId)))) ||
                !!mergeEdit || draft.beats.every((b) => excluded.includes(b.id))
              }
              onClick={() => {
                const proposals = draft.beats.filter(
                  (b) => !excluded.includes(b.id),
                );
                onUpdate((p) => {if(draft.source!==p.source.textSnapshot||(draft.sourceSceneId&&draft.sceneSnapshot!==JSON.stringify(p.manuscriptScenes?.find(s=>s.id===draft.sourceSceneId))))return p;return draft.sourceSceneId?applySceneBeats(p,draft.sourceSceneId,proposals):appendAiBeats(p,proposals);});
                setInspectorMode('beat');setSelected(proposals[0]?.id ?? selected);
                setDraft(null);
              }}
            >
              {t.apply}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setDraft(null)}
            >
              {t.discard}
            </button>
          </section>
        ) : null}
{sceneDiagnostics && !busy ? <details className="beat-ai-review">
          <summary>{locale==='sv'?'Visa AI-diagnostik':'Show AI diagnostics'} · {sceneDiagnostics.title}</summary>
          <p>{locale==='sv'?'Senaste scenanalysen i denna vy. Ingen ny AI-förfrågan görs när du öppnar diagnostiken. Uppgifterna försvinner när vyn stängs eller en ny analys startas.':'Latest scene analysis in this view. Opening diagnostics makes no AI request. This information is cleared when the view closes or a new analysis starts.'}</p>
          <p>{locale==='sv'?'Svarsgräns':'Output limit'}: {sceneDiagnostics.trace.maxOutputTokens} tokens · {locale==='sv'?'Kontext':'Context'}: {sceneDiagnostics.trace.contextWindow} · {locale==='sv'?'Avslutsorsak':'Finish reason'}: {sceneDiagnostics.trace.finishReason??'—'}</p>
          <label>{locale==='sv'?'Hela anropet (inklusive systeminstruktioner och numrerade segment)':'Full request (including system instructions and numbered segments)'}<textarea readOnly rows={12} value={JSON.stringify(JSON.parse(sceneDiagnostics.trace.requestBody),null,2)}/></label>
          <label>{locale==='sv'?'Modellens råsvar före bearbetning':'Raw model reply before processing'}<textarea readOnly rows={10} value={sceneDiagnostics.trace.rawReply??(locale==='sv'?'Inget textsvar mottaget.':'No text reply received.')}/></label>
          <details><summary>{locale==='sv'?'Hela serversvaret och metadata':'Full server response and metadata'}</summary><textarea aria-label={locale==='sv'?'Hela serversvaret och metadata':'Full server response and metadata'} readOnly rows={10} value={sceneDiagnostics.trace.responseBody??(locale==='sv'?'Inget serversvar mottaget.':'No server response received.')}/></details>
        </details>:null}
      </div>
      <div
        className="beat-resizer"
        role="separator"
        aria-label={t.resize}
        aria-orientation="vertical"
        aria-valuemin={320}
        aria-valuemax={700}
        aria-valuenow={width}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setWidth((w) =>
              Math.max(
                320,
                Math.min(700, w + (e.key === "ArrowLeft" ? 20 : -20)),
              ),
            );
          }
        }}
        onPointerDown={(e) => {
          const initial = e.clientX,
            original = width;
          const move = (event: PointerEvent) =>
            setWidth(
              Math.max(320, Math.min(700, original + initial - event.clientX)),
            );
          const end = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", end);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", end);
        }}
      />
      <aside className="beat-inspector">
        <div className="workspace-tabs" role="group" aria-label={locale==='sv'?'Egenskapsvy':'Property view'}><button type="button" aria-pressed={inspectorMode==='scene'} onClick={()=>setInspectorMode('scene')}>{locale==='sv'?'Scen':'Scene'}</button><button type="button" aria-pressed={inspectorMode==='beat'} onClick={()=>setInspectorMode('beat')}>Beat</button></div>
        {activeScene?<button type="button" className="primary-button scene-analyse-action" disabled={busy||activeScene.omitted||!sceneRange(project,activeScene)||!activeScene.title.trim()||!activeScene.purpose.trim()} onClick={()=>analyseScene(activeScene.id)}>{locale==='sv'?'Föreslå seriebeats för scenen':'Suggest comic beats for scene'}</button>:null}
        <div hidden={inspectorMode!=='scene'}><ManuscriptSceneList project={project} chapterId={chapter?.id} selectedSceneId={activeScene?.id} locale={locale} selection={range} busy={busy} onUpdate={onUpdate} onChoose={choose} onAnalyse={analyseScene}/></div>
        <div hidden={inspectorMode!=='beat'}>

        {deletedBeat ? (
          <div className="beat-review-warning" role="status">
            <p>{t.deleted}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                updateProject(() => deletedBeat.project);
                setSelected(deletedBeat.beatId);
                setDeletedBeat(null);
              }}
            >
              {t.undoDelete}
            </button>
          </div>
        ) : null}

        {beat ? (
          <>
            {beat.scenePlaceholder?<p className="beat-review-warning">{locale==='sv'?'Startbeat för en scen. Utveckla gestaltningen eller lägg till en panel när du är redo.':'Starting beat for a scene. Develop its adaptation or add a panel when ready.'}</p>:null}
            <div className="beat-navigation">
              <button
                type="button"
                aria-label={t.previous}
                disabled={index <= 0}
                onClick={() => choose(scopedBeats[index - 1].id)}
              >
                ←
              </button>
              <strong>
                {t.beat} {index + 1} {t.of} {scopedBeats.length}
              </strong>
              <button
                type="button"
                aria-label={t.next}
                disabled={index >= scopedBeats.length - 1}
                onClick={() => choose(scopedBeats[index + 1].id)}
              >
                →
              </button>
            </div>
            <button
              type="button"
              className="text-button danger-text"
              onClick={() => {
                updateProject((p) => {
                  setDeletedBeat({ project: p, beatId: beat.id });
                  return removeManuscriptBeat(p, beat.id);
                });
                setSelected(
                  scopedBeats[index + 1]?.id ??
                    scopedBeats[index - 1]?.id ??
                    null,
                );
              }}
            >
              {t.deleteBeat}
            </button>
            <label>
              {t.title}
              <input
                value={beat.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <details
              className="beat-section beat-details-section"
              key={beat.id + "-details"}
            >
              <summary>{t.details}</summary>
              <div className="beat-section-body">
                <label>
                  {t.summary}
                  <textarea
                    rows={3}
                    value={beat.summary}
                    onChange={(e) => patch({ summary: e.target.value })}
                  />
                </label>

                <label>
                  {t.type}
                  <select
                    value={beat.beatType}
                    onChange={(e) =>
                      patch({ beatType: e.target.value as BeatType })
                    }
                  >
                    {beatTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <fieldset>
                  <legend>{t.characters}</legend>
                  {project.characters.map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={beat.characterIds.includes(c.id)}
                        onChange={(e) =>
                          patch({
                            characterIds: e.target.checked
                              ? [...beat.characterIds, c.id]
                              : beat.characterIds.filter((id) => id !== c.id),
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </fieldset>

                <label>
                  {t.location}
                  <select
                    value={beat.locationId ?? ""}
                    onChange={(e) =>
                      patch({ locationId: e.target.value || undefined })
                    }
                  >
                    <option value="">{t.none}</option>
                    {project.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>

                {beat.dialogueCandidates.map((item, i) => (
                  <label key={item.id}>
                    {t.dialogue}
                    <textarea
                      value={item.text}
                      onChange={(e) =>
                        patch({
                          dialogueCandidates: beat.dialogueCandidates.map(
                            (x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    text: e.target.value,
                                    source: "adapted",
                                  }
                                : x,
                          ),
                        })
                      }
                    />
                  </label>
                ))}

                {beat.captionCandidates.map((item, i) => (
                  <label key={item.id}>
                    {t.narration}
                    <textarea
                      value={item.text}
                      onChange={(e) =>
                        patch({
                          captionCandidates: beat.captionCandidates.map(
                            (x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    text: e.target.value,
                                    source: "adapted",
                                  }
                                : x,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
            <details>
              <summary>{t.source}</summary>
              <blockquote>{beat.sourceTextExcerpt}</blockquote>
            </details>
            {beat.sourceNeedsReview ? (
              <div className="beat-review-warning">
                <p>
                  {beat.sourceStart === undefined ||
                  beat.sourceEnd === beat.sourceStart
                    ? t.missing
                    : t.review}
                </p>
                {beat.sourceStart !== undefined &&
                beat.sourceEnd !== beat.sourceStart ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      patch({
                        sourceTextExcerpt: source.slice(
                          beat.sourceStart,
                          beat.sourceEnd,
                        ),
                        sourceNeedsReview: false,
                        status: "approved",
                      })
                    }
                  >
                    {t.reviewed}
                  </button>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="text-button"
              disabled={!range}
              onClick={() => {
                if (range)
                  patch({
                    sourceStart: range.start,
                    sourceEnd: range.end,
                    sourceTextExcerpt: source.slice(range.start, range.end),
                    sourceNeedsReview: false,
                  });
              }}
            >
              {t.relink}
            </button>
            <PanelGroup
              multiple={multiplePanels}
              title={t.panels}
              count={beatPanels.length}
              key={beat.id + "-panels"}
            >
              <div className="section-heading">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onUpdate((p) => addBeatPanel(p, beat.id))}
                >
                  {t.addPanel}
                </button>
              </div>
              {beatPanels.map((plan) => {
                const prompt = adaptation.imagePrompts.find(
                  (x) => x.panelId === plan.id,
                );
                const update = (patch: Partial<PanelPlan>) =>
                  onUpdate((p) => patchBeatPanel(p, plan.id, patch));
                const projectedId = project.panels.find(
                  (p) => p.adaptationPanelPlanId === plan.id,
                )?.id;
                const image =
                  plan.image ??
                  project.pages
                    .flatMap((p) => p.placements)
                    .find(
                      (p) =>
                        p.adaptationPanelPlanId === plan.id ||
                        (projectedId && p.panelId === projectedId),
                    )?.image;
                return (
                  <PanelCard
                    key={plan.id}
                    multiple={multiplePanels}
                    title={`${plan.order} · ${plan.title}`}
                    warning={Boolean(plan.sourceNeedsReview)}
                  >
                    <div className="beat-panel-body">
                      {plan.sourceNeedsReview ? (
                        <div className="beat-review-warning">
                          <p>{t.dirtyPanel}</p>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => update({ sourceNeedsReview: false })}
                          >
                            {t.reviewed}
                          </button>
                        </div>
                      ) : null}
                      <label>
                        {t.direction}
                        <textarea
                          rows={3}
                          value={plan.visualDescription}
                          onChange={(e) =>
                            update({ visualDescription: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        {t.shot}
                        <select
                          value={plan.shotType ?? ""}
                          onChange={(e) =>
                            update({
                              shotType: e.target.value as PanelPlan["shotType"] || undefined,
                            })
                          }
                        >
                          <option value="">{locale === "sv" ? "Automatiskt / ospecificerat" : "Automatic / unspecified"}</option>
                          {[
                            "wide",
                            "establishing-wide",
                            "medium",
                            "medium-close",
                            "close-up",
                            "extreme-close-up",
                            "over-shoulder",
                            "reaction",
                            "insert",
                            "full-shot",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t.size}
                        <select
                          value={plan.sizeHint ?? "medium"}
                          onChange={(e) =>
                            update({
                              sizeHint: e.target.value as PanelPlan["sizeHint"],
                            })
                          }
                        >
                          {[
                            "small",
                            "medium",
                            "large",
                            "full-width",
                            "splash",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      {plan.dialogue.map((item) => (
                        <label key={item.id}>
                          {t.dialogue}
                          <textarea
                            value={item.text}
                            onChange={(e) =>
                              update({
                                dialogue: plan.dialogue.map((x) =>
                                  x.id === item.id
                                    ? {
                                        ...x,
                                        text: e.target.value,
                                        source: "adapted",
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                      {plan.captions.map((item) => (
                        <label key={item.id}>
                          {t.narration}
                          <textarea
                            value={item.text}
                            onChange={(e) =>
                              update({
                                captions: plan.captions.map((x) =>
                                  x.id === item.id
                                    ? {
                                        ...x,
                                        text: e.target.value,
                                        source: "adapted",
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                      <div className="beat-text-actions">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            update({
                              dialogue: [
                                ...plan.dialogue,
                                {
                                  id: crypto.randomUUID(),
                                  text: "",
                                  source: "adapted",
                                  bubbleType: "speech",
                                },
                              ],
                            })
                          }
                        >
                          {t.addDialogue}
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            update({
                              captions: [
                                ...plan.captions,
                                {
                                  id: crypto.randomUUID(),
                                  text: "",
                                  source: "adapted",
                                  style: "narration",
                                },
                              ],
                            })
                          }
                        >
                          {t.addNarration}
                        </button>
                      </div>
                      <div className="image-prompt-quick-actions"><button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          onUpdate((p) => generateBeatPanelPrompt(p, plan.id))
                        }
                      >
                        {t.generate}
                      </button>
                      <button type="button" className="text-button" onClick={() => setPromptPanelId(plan.id)}>{locale === "sv" ? "Justera bildprompt" : "Adjust image prompt"}</button></div>
                      <p className="image-prompt-quick-summary">{project.style.name} · {plan.shotType || (locale === "sv" ? "Automatiskt utsnitt" : "Automatic shot")} · {plan.promptDirection?.effects?.length ? `${plan.promptDirection.effects.length} ${locale === "sv" ? "effekter" : "effects"}` : locale === "sv" ? "Inga specialeffekter" : "No special effects"}</p>
                      {prompt ? (
                        <>
                          <label>
                            {t.prompt}
                            <textarea
                              rows={6}
                              value={prompt.prompt}
                              onChange={(e) => editPrompt(plan, e.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                              void navigator.clipboard
                                .writeText(prompt.prompt)
                                .then(
                                  () => setMessage(t.copied),
                                  () => setMessage(t.failed),
                                );
                            }}
                          >
                            {t.copy}
                          </button>
                        </>
                      ) : null}
                      <label
                        className="beat-image-drop"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files[0])
                            loadImage(plan.id, e.dataTransfer.files[0]);
                        }}
                      >
                        {image ? (
                          <img src={image.dataUrl} alt={image.name} />
                        ) : (
                          <span>{t.drop}</span>
                        )}
                        <span>{image ? t.changeImage : t.image}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            if (e.target.files?.[0])
                              loadImage(plan.id, e.target.files[0]);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {plan.image ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => update({ image: undefined })}
                        >
                          {t.removeImage}
                        </button>
                      ) : null}
                      {plan.imageVersions?.length ? (
                        <details className="beat-image-history">
                          <summary>{t.imageHistory}</summary>
                          {plan.imageVersions.map((previous, index) => (
                            <button
                              type="button"
                              className="text-button"
                              key={index}
                              onClick={() => update({ image: previous })}
                            >
                              <img src={previous.dataUrl} alt="" />
                              {previous.name} · {t.restore}
                            </button>
                          ))}
                        </details>
                      ) : null}
                    </div>
                  </PanelCard>
                );
              })}
            </PanelGroup>
          </>
        ) : (
          <p>{t.select}</p>
        )}
        <details className="manuscript-beat-list" open>
          <summary>{t.beatList}</summary>
          {scopedBeats.map((b) => (
            <button
              type="button"
              className={selected === b.id ? "is-active" : ""}
              key={b.id}
              onClick={() => choose(b.id)}
            >
              {b.order} · {b.title}
              {b.sourceNeedsReview ? " ⚠" : ""}
            </button>
          ))}
        </details>
        </div>
      </aside>
      {menu ? (
        <>
          <div className="beat-menu-dismiss" onClick={() => setMenu(null)} />
          <div
            className="beat-context-menu"
            role="menu"
            onKeyDown={(e) => {
              if (e.key === "Escape") setMenu(null);
            }}
            style={{ left: menu.x, top: menu.y }}
          >
            <button type="button" role="menuitem" disabled={!range||busy} onClick={createScene}>{locale==='sv'?'Skapa scen':'Create scene'}</button>
            <button
              type="button"
              role="menuitem"
              disabled={!range}
              onClick={create}
            >
              {t.create}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!range || busy}
              onClick={() => void analyse()}
            >
              {t.ai}
            </button>
          </div>
        </>
      ) : null}
      {sceneDraft?<div className="scene-dialog-backdrop"><form role="dialog" aria-modal="true" aria-label={locale==='sv'?'Skapa scen':'Create scene'} className="scene-dialog" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setSceneDraft(null);}}} onSubmit={e=>{e.preventDefault();if(sceneDraft.source!==source)return;try{onUpdate(p=>{if((p.source.textSnapshot??'')!==sceneDraft.source)return p;const result=createManuscriptScene(p,sceneDraft.range,sceneDraft.title,sceneDraft.purpose,sceneDraft.preserve);setActiveSceneId(result.sceneId);setInspectorMode('scene');setSelected(activeManuscriptAdaptation(result.project).beats.find(b=>b.sourceSceneId===result.sceneId)?.id??null);return result.project;});setSceneDraft(null);}catch(error){setMessage(error instanceof Error?error.message:String(error));}}}>
        <h3>{locale==='sv'?'Skapa scen från markeringen':'Create scene from selection'}</h3>
        <label>{locale==='sv'?'Scennamn':'Scene name'}<input autoFocus required value={sceneDraft.title} onChange={e=>setSceneDraft({...sceneDraft,title:e.target.value})}/></label>
        <label>{locale==='sv'?'Vad ska scenen åstadkomma?':'What should the scene accomplish?'}<textarea required rows={3} value={sceneDraft.purpose} onChange={e=>setSceneDraft({...sceneDraft,purpose:e.target.value})}/></label>
        <label>{locale==='sv'?'Viktigt att bevara (valfritt)':'Important to preserve (optional)'}<textarea rows={2} value={sceneDraft.preserve} onChange={e=>setSceneDraft({...sceneDraft,preserve:e.target.value})}/></label>
        <details><summary>{locale==='sv'?'Markerad text':'Selected text'}</summary><pre>{sceneDraft.source.slice(sceneDraft.range.start,sceneDraft.range.end)}</pre></details>
        {sceneDraft.source!==source?<p role="alert">{t.stale}</p>:null}
        <button type="submit" disabled={sceneDraft.source!==source||!sceneDraft.title.trim()||!sceneDraft.purpose.trim()}>{locale==='sv'?'Spara scen':'Save scene'}</button>
        <button type="button" onClick={()=>setSceneDraft(null)}>{locale==='sv'?'Avbryt':'Cancel'}</button>
      </form></div>:null}
      {promptPanel ? <ImagePromptEditor key={project.id + promptPanel.id} project={project} panel={promptPanel} locale={locale} settings={settings} onClose={() => setPromptPanelId(null)} onSave={patch => {
        onUpdate(p => generateBeatPanelPrompt(patchBeatPanel(p, promptPanel.id, patch), promptPanel.id));
        setPromptPanelId(null);
      }} /> : null}
    </section>
  );
}


