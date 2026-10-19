import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import type { LocalAiSettings } from "./localAi";
import type { PanelPlan, ShotType } from "./adaptation/types";
import { manuscriptChapters } from "./manuscriptChapters";
import { activeManuscriptAdaptation, ensureBeatPanels, generateBeatPanelPrompt, patchBeatPanel, patchManuscriptBeat } from "./manuscriptModel";
import { archiveStoryboardPanel, insertStoryboardPanel, moveStoryboardPanel, orderedStoryboard } from "./storyboardModel";
import { ImagePromptEditor } from "./ImagePromptEditor";
import "./storyWorkflow.css";

type Stage = "beats" | "storyboard" | "images";
type Props = {
  project: ComicProject; locale: Locale; settings: LocalAiSettings; stage: Stage;
  chapterId: string | null; onChapterChange: (id: string | null) => void;
  onUpdate: (update: (p: ComicProject) => ComicProject) => void;
  onStage: (stage: "manus" | Stage | "pages") => void;
};
function SequenceReader({ panels, locale, onClose }: { panels: PanelPlan[]; locale: Locale; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const box = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const sv = locale === "sv", panel = panels[Math.min(index, panels.length - 1)];
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); }
      if (e.key === "ArrowRight") setIndex(i => Math.min(panels.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex(i => Math.max(0, i - 1));
      if (e.key === "Tab") {
        const buttons = Array.from(box.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === box.current)) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); active?.focus(); };
  }, [panels.length]);
  if (!panel) return null;
  return createPortal(<div className="workflow-reader-backdrop"><section className="workflow-reader" ref={box} role="dialog" aria-modal="true" aria-labelledby="sequence-reader-title" tabIndex={-1}>
    <header><h2 id="sequence-reader-title">{sv ? "Läs sekvensen" : "Read sequence"}</h2><button onClick={onClose}>{sv ? "Stäng" : "Close"}</button></header>
    <p className="eyebrow">{index + 1} / {panels.length} · {panel.shotType}</p><h3>{panel.title}</h3>
    <div className="workflow-reader-frame">{panel.image ? <img src={panel.image.dataUrl} alt={panel.visualDescription || panel.title} /> : <p>{panel.visualDescription || (sv ? "Beskriv vad som syns i bilden." : "Describe what is visible in the panel.")}</p>}</div>
    {panel.dialogue.map(d => <p key={d.id} className="workflow-reader-dialogue">{d.speaker && <strong>{d.speaker}: </strong>}{d.text}</p>)}
    {panel.captions.map(c => <p key={c.id} className="workflow-reader-caption">{c.text}</p>)}
    <footer><button disabled={index === 0} onClick={() => setIndex(i => i - 1)}>← {sv ? "Föregående" : "Previous"}</button><button disabled={index >= panels.length - 1} onClick={() => setIndex(i => i + 1)}>{sv ? "Nästa" : "Next"} →</button></footer>
  </section></div>, document.body);
}

export function StoryWorkflow({ project, locale, settings, stage, chapterId, onChapterChange, onUpdate, onStage }: Props) {
  const sv = locale === "sv", tr = (a: string, b: string) => sv ? a : b;
  const chapters = manuscriptChapters(project), chapter = chapterId === "__all__" ? undefined : chapters.find(c => c.id === chapterId) ?? chapters[0];
  const scopeId = chapter?.id ?? null;
  const adaptation = activeManuscriptAdaptation(project);
  const beats = adaptation.beats.filter(b => !scopeId || b.chapterId === scopeId).sort((a, b) => a.order - b.order);
  const panels = orderedStoryboard(project, scopeId), archived = orderedStoryboard(project, scopeId, true);
  const [selected, setSelected] = useState<string | null>(null);
  const panel = panels.find(p => p.id === selected) ?? panels[0];
  const [reader, setReader] = useState(false), [promptId, setPromptId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [removedId,setRemovedId] = useState<string|null>(null);
  const drag = useRef<string | null>(null), requests = useRef(new Set<FileReader>());
  const promptPanel = panels.find(p => p.id === promptId);
  useEffect(() => { setSelected(null); setPromptId(null); setReader(false); setNotice(""); setRemovedId(null); drag.current = null; }, [scopeId]);
  useEffect(() => () => { for (const r of requests.current) r.abort(); requests.current.clear(); }, []);
  const patch = (change: Partial<PanelPlan>) => { if (panel) onUpdate(p => patchBeatPanel(p, panel.id, change)); };
  const insert = (reaction = false) => {
    const panelId = `panel-plan-${crypto.randomUUID()}`;
    onUpdate(p => insertStoryboardPanel(p, panel?.id ?? null, scopeId, reaction, panelId).project);
    setSelected(panelId);
    setNotice(reaction ? tr("En ny reaktionsruta har lagts efter originalet. Fördela handling och repliker mellan rutorna.", "A reaction panel was added after the original. Distribute action and dialogue between them.") : "");
  };
  const move = (id: string, target: string) => onUpdate(p => moveStoryboardPanel(p, id, target, scopeId));
  const upload = (file: File, id: string) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setNotice(tr("Välj en PNG-, JPEG- eller WebP-bild.", "Choose a PNG, JPEG or WebP image.")); return; }
    const r = new FileReader(); requests.current.add(r);
    r.onload = () => { requests.current.delete(r); onUpdate(p => patchBeatPanel(p, id, { image: { name: file.name, dataUrl: String(r.result) } })); setNotice(""); };
    r.onerror = () => { requests.current.delete(r); setNotice(tr("Bilden kunde inte läsas. Försök igen.", "Could not read image. Try again.")); };
    r.onabort = () => requests.current.delete(r);
    r.readAsDataURL(file);
  };
  const shotOptions: [ShotType, string][] = [["establishing-wide", tr("Etableringsbild", "Establishing shot")], ["wide", tr("Vid bild", "Wide")], ["full-shot", tr("Helbild", "Full shot")], ["medium", tr("Halvbild", "Medium")], ["medium-close", tr("Tät halvbild", "Medium close-up")], ["close-up", tr("Närbild", "Close-up")], ["extreme-close-up", tr("Extrem närbild", "Extreme close-up")], ["over-shoulder", tr("Över axeln", "Over shoulder")], ["reaction", tr("Reaktion", "Reaction")], ["insert", tr("Detaljbild", "Insert")]];
  const next = () => { if (stage === "beats") { onUpdate(p => ensureBeatPanels(p, scopeId)); onStage("storyboard"); } else onStage(stage === "storyboard" ? "images" : "pages"); };
  const linkedBeats = adaptation.beats.filter(b => panel?.sourceBeatIds.includes(b.id));
  return <section className="story-workflow" aria-label={tr("Från manus till sidor", "From manuscript to pages")}>
    <aside className="workflow-chapters"><p className="eyebrow">{tr("Berättelsen", "The story")}</p><h2>{tr("Kapitel", "Chapters")}</h2>
      {chapters.length ? chapters.map(c => <button key={c.id} className={c.id === scopeId ? "is-active" : ""} onClick={() => onChapterChange(c.id)}><strong>{c.order}. {c.title}</strong><small>{orderedStoryboard(project, c.id).length} {tr("bildrutor", "panels")}</small></button>) : <p>{tr("Hela manuset", "Full manuscript")}</p>}
      {chapters.length > 0 && <button className={chapterId === "__all__" ? "is-active" : ""} onClick={() => onChapterChange("__all__")}>{tr("Alla bildrutor", "All panels")}</button>}
      <p className="quiet">{tr("Arbetet sparas i albumet när du redigerar. Du kan gå tillbaka mellan stegen.", "Edits are saved in the album. You can return between steps.")}</p>
    </aside>
    <div className="workflow-content"><header className="workflow-heading"><div><p className="eyebrow">{chapter?.title ?? project.title}</p><h2>{stage === "beats" ? tr("Berättelsens beats", "Story beats") : stage === "storyboard" ? tr("Bygg bildmanuset", "Build the storyboard") : tr("Ge berättelsen bilder", "Illustrate the story")}</h2><p>{stage === "beats" ? tr("Välj ögonblicken som ska bli bildrutor. Källtexten finns kvar i Manus.", "Choose the moments to turn into panels. The source remains in Manuscript.") : stage === "storyboard" ? tr("Ordna bilderna och läs berättelsens rytm innan du bygger sidorna.", "Arrange panels and read the story's rhythm before building pages.") : tr("Justera bildprompter och välj bilder. Dina bildversioner sparas.", "Adjust image prompts and select images. Image versions are retained.")}</p></div>
      <div className="workflow-actions">{stage !== "beats" && <button disabled={!panels.length} onClick={() => setReader(true)}>{tr("Läs sekvensen", "Read sequence")}</button>}<button className="primary-button" onClick={next}>{stage === "beats" ? tr("Till bildmanus", "To storyboard") : stage === "storyboard" ? tr("Till bilder", "To images") : tr("Till sidor", "To pages")} →</button></div>
    </header>
    {removedId && archived.some(p=>p.id===removedId) && <div className="workflow-notice" role="status">{tr("Bildrutan togs bort från sekvensen.", "Panel removed from sequence.")} <button onClick={()=>{onUpdate(p=>archiveStoryboardPanel(p,removedId,false));setSelected(removedId);setRemovedId(null);}}>{tr("Ångra borttagning", "Undo removal")}</button></div>}
    {notice && <p className="workflow-notice" role="status">{notice}</p>}
    {stage === "beats" ? <div className="workflow-beats">
      {!beats.length && <div className="workflow-empty"><h3>{tr("Välj berättelsens ögonblick", "Choose the story's moments")}</h3><p>{tr("Markera ett stycke i Manus och skapa beats manuellt eller med din valda AI-modell.", "Select a passage in Manuscript and create beats manually or using your chosen AI model.")}</p><button onClick={() => onStage("manus")}>{tr("Öppna manus", "Open manuscript")}</button></div>}
      {beats.map(b => <article key={b.id} className={`workflow-beat ${b.status === "discarded" ? "is-excluded" : ""}`}>
        <label className="workflow-include"><input type="checkbox" checked={b.status !== "discarded"} onChange={e => onUpdate(p => patchManuscriptBeat(p, b.id, { status: e.target.checked ? "approved" : "discarded" }))} />{tr("Ta med", "Include")} · Beat {b.order}</label>
        <label>{tr("Rubrik", "Title")}<input value={b.title} onChange={e => onUpdate(p => patchManuscriptBeat(p, b.id, { title: e.target.value }))} /></label>
        <label>{tr("Vad händer?", "What happens?")}<textarea rows={3} value={b.summary} onChange={e => onUpdate(p => patchManuscriptBeat(p, b.id, { summary: e.target.value }))} /></label>
        <details><summary>{tr("Visa källtext", "Show source text")}{b.sourceNeedsReview ? " ⚠" : ""}</summary><blockquote>{b.sourceTextExcerpt}</blockquote></details>
        <small>{panels.filter(p => p.sourceBeatIds.includes(b.id)).length} {tr("bildrutor. Befintliga rutor behålls även om beatet väljs bort.", "panels. Existing panels are retained if the beat is excluded.")}</small>
      </article>)}
      {beats.length > 0 && <button onClick={() => onStage("manus")}>← {tr("Till manus och fler beats", "To manuscript and more beats")}</button>}
    </div> : <div className="workflow-board">
      <div className="workflow-sequence"><div className="workflow-list-heading"><strong>{panels.length} {tr("bildrutor", "panels")}</strong><button onClick={() => insert()}>{tr("Infoga bildruta", "Insert panel")}</button></div>
        {!panels.length && <div className="workflow-empty"><h3>{tr("Här börjar bildmanuset", "Start the storyboard here")}</h3><p>{tr("Skapa bildrutor från dina beats, eller infoga en egen ruta.", "Create panels from beats or insert your own panel.")}</p><button onClick={() => onUpdate(p => ensureBeatPanels(p, scopeId))}>{tr("Skapa saknade bildrutor från beats", "Create missing panels from beats")}</button></div>}
        {panels.map((p, index) => <article className={`workflow-panel ${p.id === panel?.id ? "is-selected" : ""}`} key={p.id} data-storyboard-panel={p.id}
          onDragOver={e => { if (drag.current) e.preventDefault(); }} onDrop={e => { e.preventDefault(); const id = drag.current; drag.current = null; if (id) move(id, p.id); }}>
          <div className="workflow-panel-order"><span>{String(index + 1).padStart(2, "0")}</span><button className="workflow-drag-handle" draggable aria-label={tr("Dra bildruta", "Drag panel")} onDragStart={e => { drag.current = p.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); }} onDragEnd={() => { drag.current = null; }}>⠿</button></div>
          <button className="workflow-panel-preview" onClick={() => setSelected(p.id)} aria-label={`${tr("Välj bildruta", "Select panel")} ${index + 1}: ${p.title}`}>
            {p.image ? <img src={p.image.dataUrl} alt="" draggable={false} /> : <span className="workflow-sketch">{p.shotType === "close-up" || p.shotType === "reaction" ? "◯" : "▱"}</span>}
            <div><small>{shotOptions.find(([shot]) => shot === p.shotType)?.[1] ?? tr("Välj bildutsnitt", "Choose framing")} {p.sourceNeedsReview ? "· ⚠" : ""}</small><h3>{p.title}</h3><p>{p.visualDescription || tr("Beskriv det synliga ögonblicket…", "Describe the visible moment…")}</p><small>{p.dialogue.length} {tr("repliker", "lines")} · {p.image ? tr("Bild vald", "Image selected") : tr("Ingen bild ännu", "No image yet")}</small></div>
          </button><div className="workflow-reorder"><button aria-label={tr("Flytta upp", "Move up")} disabled={index === 0} onClick={() => move(p.id, panels[index - 1].id)}>↑</button><button aria-label={tr("Flytta ned", "Move down")} disabled={index === panels.length - 1} onClick={() => move(p.id, panels[index + 1].id)}>↓</button></div>
        </article>)}
        {archived.length > 0 && <details className="workflow-archive"><summary>{tr("Borttagna bildrutor", "Removed panels")} ({archived.length})</summary><p>{tr("Bilder, texter och rutor på färdiga sidor finns kvar.", "Images, text and panels on existing pages are retained.")}</p>{archived.map(p => <div key={p.id}><span>{p.title}</span><button onClick={() => { onUpdate(project => archiveStoryboardPanel(project, p.id, false)); setSelected(p.id); }}>{tr("Återställ", "Restore")}</button></div>)}</details>}
      </div>
      {panel && <aside className="workflow-inspector" aria-label={tr("Bildrutans detaljer", "Panel details")}>
        <p className="eyebrow">{tr("Bildruta", "Panel")} {panels.findIndex(p => p.id === panel.id) + 1}</p>
        {stage === "storyboard" ? <>
          <label>{tr("Rubrik", "Title")}<input value={panel.title} onChange={e => patch({ title: e.target.value })} /></label>
          <label>{tr("Läsaren ska förstå", "The reader should understand")}<textarea rows={2} value={panel.purpose ?? ""} onChange={e => patch({ purpose: e.target.value })} /></label>
          <label>{tr("Det som syns i bilden", "What is visible in the panel")}<textarea rows={5} value={panel.visualDescription} onChange={e => patch({ visualDescription: e.target.value })} /></label>
          <label>{tr("Bildutsnitt", "Framing")}<select value={panel.shotType ?? ""} onChange={e => patch({ shotType: e.target.value as ShotType || undefined })}><option value="">{tr("Välj…", "Choose…")}</option>{shotOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <h3>{tr("Dialog", "Dialogue")}</h3>
          {panel.dialogue.map(d => <div className="workflow-text-entry" key={d.id}><label>{tr("Talare", "Speaker")}<input value={d.speaker ?? ""} onChange={e => patch({ dialogue: panel.dialogue.map(item => item.id === d.id ? { ...item, speaker: e.target.value, source: "adapted" } : item) })} /></label><label>{tr("Replik", "Line")}<textarea rows={2} value={d.text} onChange={e => patch({ dialogue: panel.dialogue.map(item => item.id === d.id ? { ...item, text: e.target.value, source: "adapted" } : item) })} /></label><label>{tr("Bubbla", "Bubble")}<select value={d.bubbleType} onChange={e => patch({ dialogue: panel.dialogue.map(item => item.id === d.id ? { ...item, bubbleType: e.target.value as "speech" | "thought" } : item) })}><option value="speech">{tr("Tal", "Speech")}</option><option value="thought">{tr("Tanke", "Thought")}</option></select></label><button onClick={() => patch({ dialogue: panel.dialogue.filter(item => item.id !== d.id) })}>{tr("Ta bort replik", "Remove line")}</button></div>)}
          <button onClick={() => patch({ dialogue: [...panel.dialogue, { id: `dialogue-${crypto.randomUUID()}`, text: "", source: "adapted", bubbleType: "speech" }] })}>+ {tr("Replik", "Line")}</button>
          <h3>{tr("Berättartext", "Captions")}</h3>{panel.captions.map(c => <div className="workflow-text-entry" key={c.id}><label>{tr("Berättartext", "Caption")}<textarea rows={2} value={c.text} onChange={e => patch({ captions: panel.captions.map(item => item.id === c.id ? { ...item, text: e.target.value, source: "adapted" } : item) })} /></label><button onClick={() => patch({ captions: panel.captions.filter(item => item.id !== c.id) })}>{tr("Ta bort berättartext", "Remove caption")}</button></div>)}
          <button onClick={() => patch({ captions: [...panel.captions, { id: `caption-${crypto.randomUUID()}`, text: "", source: "adapted", style: "narration" }] })}>+ {tr("Berättartext", "Caption")}</button>
          <div className="workflow-actions workflow-edit-actions"><button onClick={() => insert(true)}>{tr("Dela bildruta", "Split panel")}</button><button onClick={() => { onUpdate(p => archiveStoryboardPanel(p, panel.id, true)); setRemovedId(panel.id); setSelected(null); }}>{tr("Ta bort bildruta", "Remove panel")}</button></div>
        </> : <>
          <h3>{panel.title}</h3>{panel.image ? <img className="workflow-chosen-image" src={panel.image.dataUrl} alt={panel.visualDescription || panel.title} /> : <div className="workflow-no-image">{tr("Ingen bild vald", "No image selected")}</div>}
          <button onClick={() => setPromptId(panel.id)}>{tr("Justera bildprompt", "Adjust image prompt")}</button>
          <p className="quiet">{tr("Använd prompten i ditt bildverktyg och lägg in den valda bilden här.", "Use the prompt in your image tool and add the chosen image here.")}</p>
          <label className="workflow-upload">{tr("Välj bild", "Choose image")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) upload(file, panel.id); e.target.value = ""; }} /></label>
          {panel.image && <button onClick={() => patch({ image: undefined })}>{tr("Avmarkera bild", "Deselect image")}</button>}
          {(panel.imageVersions?.length ?? 0) > 0 && <details><summary>{tr("Tidigare bildversioner", "Previous image versions")} ({panel.imageVersions!.length})</summary><div className="workflow-image-history">{panel.imageVersions!.map((image, i) => <button key={i} title={image.name} aria-label={`${tr("Välj version", "Select version")} ${i + 1}`} onClick={() => patch({ image })}><img src={image.dataUrl} alt={image.name} /></button>)}</div></details>}
          <label>{tr("Sparad bildprompt", "Saved image prompt")}<textarea readOnly rows={7} value={adaptation.imagePrompts.find(p => p.panelId === panel.id)?.prompt ?? ""} /></label>
          <button onClick={() => onUpdate(p => generateBeatPanelPrompt(p, panel.id))}>{tr("Bygg prompt från bildrutan", "Build prompt from panel")}</button>
        </>}
        <details className="workflow-source"><summary>{tr("Källa & koppling", "Source & link")}{panel.sourceNeedsReview ? " ⚠" : ""}</summary>
          <p className="quiet">{tr("Koppla bildrutan till ett eller flera beats.", "Link the panel to one or more beats.")}</p>
          {beats.map(b => <label className="workflow-include" key={b.id}><input type="checkbox" checked={panel.sourceBeatIds.includes(b.id)} onChange={e => patch({ sourceBeatIds: e.target.checked ? [...panel.sourceBeatIds, b.id] : panel.sourceBeatIds.filter(id => id !== b.id) })} />Beat {b.order} · {b.title}</label>)}
          {linkedBeats.map(b => <blockquote key={b.id}><strong>{b.title}</strong><p>{b.sourceTextExcerpt}</p></blockquote>)}
        </details>
      </aside>}
    </div>}
    </div>
    {reader && <SequenceReader panels={panels} locale={locale} onClose={() => setReader(false)} />}
    {promptPanel && <ImagePromptEditor key={promptPanel.id} project={project} panel={promptPanel} locale={locale} settings={settings} onClose={() => setPromptId(null)} onSave={change => { onUpdate(p => generateBeatPanelPrompt(patchBeatPanel(p, promptPanel.id, change), promptPanel.id)); setPromptId(null); }} />}
  </section>;
}
