import { readLocalAiSettings, type LocalAiSettings } from "./localAi";
import { suggestVisualScene } from "./visualSceneAi";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComicProject } from "./project";
import type { PanelPlan, PromptDirection, ShotType } from "./adaptation/types";
import type { Locale } from "./settings";
import { buildImagePrompt, CAMERA_ANGLES, DEPTHS, EFFECTS, LENSES } from "./adaptation/prompts";
import "./imagePromptEditor.css";

export function ImagePromptEditor({ project, panel, locale, settings, onClose, onSave }: {
  project: ComicProject; panel: PanelPlan; locale: Locale; settings?: LocalAiSettings; onClose: () => void;
  onSave: (patch: Pick<PanelPlan, "visualDescription" | "shotType" | "promptDirection">) => void;
}) {
  const sv = locale === "sv", tr = (swedish: string, english: string) => sv ? swedish : english;
  const [draft, setDraft] = useState<PanelPlan>(() => ({ ...panel, promptDirection: { ...panel.promptDirection, characterActions: { ...panel.promptDirection?.characterActions }, effects: [...(panel.promptDirection?.effects ?? [])] } }));
  const [notice, setNotice] = useState("");
  const [sceneBusy, setSceneBusy] = useState(false);
  const [sceneSuggestion, setSceneSuggestion] = useState<string | null>(null);
  const [sceneError, setSceneError] = useState("");
  const sceneRequest = useRef<AbortController | null>(null);
  const sceneTimer = useRef<number | null>(null);
  useEffect(() => () => { sceneRequest.current?.abort(); sceneRequest.current = null; if (sceneTimer.current !== null) window.clearTimeout(sceneTimer.current); }, []);
  const aiSettings = settings ?? readLocalAiSettings();
  const hasModel = Boolean(aiSettings.servers[aiSettings.engine].model.trim());
  const rewriteScene = async () => {
    if (!hasModel) return;
    sceneRequest.current?.abort();
    const controller = new AbortController(); sceneRequest.current = controller;
    setSceneBusy(true); setSceneError(""); setSceneSuggestion(null); setNotice("");
    const timer = window.setTimeout(() => controller.abort(), 180000); sceneTimer.current = timer;
    try {
      const suggestion = await suggestVisualScene({ project, panel: draft, settings: aiSettings, signal: controller.signal });
      if (sceneRequest.current === controller && !controller.signal.aborted) setSceneSuggestion(suggestion);
    } catch (error) {
      if (sceneRequest.current === controller) setSceneError(controller.signal.aborted
        ? tr("Omskrivningen avbröts. Din beskrivning behölls.", "Rewrite cancelled. Your description was kept.")
        : tr("Kunde inte skriva om scenen. ", "Could not rewrite the scene. ") + (error instanceof Error ? error.message : String(error)));
    } finally {
      window.clearTimeout(timer); if (sceneTimer.current === timer) sceneTimer.current = null;
      if (sceneRequest.current === controller) { sceneRequest.current = null; setSceneBusy(false); }
    }
  };
  const modal = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const d = draft.promptDirection!;
  const patch = (change: Partial<PromptDirection>) => setDraft(p => ({ ...p, promptDirection: { ...p.promptDirection, ...change, ...(p.promptDirection?.styleDefaultKeys ? { styleDefaultKeys: p.promptDirection.styleDefaultKeys.filter(key => !Object.keys(change).includes(key)) } : {}) } }));
  const origin = (key: string) => d.styleDefaultKeys?.includes(key) ? <span className="image-prompt-origin" aria-hidden="true">{tr("Från stil", "From style")}</span> : null;
  const category = (keys: (keyof PromptDirection)[]) => {
    const active = keys.filter(key => Array.isArray(d[key]) ? (d[key] as string[]).length : Boolean(d[key]));
    if (!active.length) return <span className="quiet"> · {tr("Inga val", "No settings")}</span>;
    const inheritedCount = active.filter(key => d.styleDefaultKeys?.includes(key)).length;
    const parts = active.map(key => key === "effects" ? `${d.effects!.length} ${tr("aktiva", "active")}` : key === "lens" ? d.lens?.replace("mm", "") + " mm" : key === "depthOfField" ? (d.depthOfField === "shallow" ? tr("Oskarp bakgrund", "Soft background") : d.depthOfField === "deep" ? tr("Hela scenen skarp", "Deep focus") : tr("Detaljfokus", "Detail focus")) : tr("Ifyllt", "Filled"));
    return <span className="image-prompt-summary"> · {parts.join(" · ")} <span className="image-prompt-origin">{inheritedCount === active.length ? tr("Från stil", "From style") : inheritedCount ? tr("Från stil + anpassat", "From style + custom") : tr("Anpassat", "Custom")}</span></span>;
  };
  const prompt = buildImagePrompt(project, draft);
  const previous = project.adaptations.flatMap(a => a.imagePrompts).find(p => p.panelId === panel.id);
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    modal.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close.current(); }
      if (e.key !== "Tab") return;
      const nodes = Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, summary, a[href]') ?? []).filter(el => !el.closest("details:not([open])") || el.tagName === "SUMMARY");
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key, true); active?.focus(); };
  }, []);
  const shots: [ShotType, string][] = [
    ["extreme-close-up", tr("Extrem närbild", "Extreme close-up")], ["close-up", tr("Närbild", "Close-up")],
    ["medium-close", tr("Tät halvbild", "Medium close-up")], ["medium", tr("Halvbild", "Medium shot")],
    ["full-shot", tr("Helbild", "Full shot")], ["wide", tr("Vid bild", "Wide shot")], ["establishing-wide", tr("Etableringsbild", "Establishing shot")],
    ["over-shoulder", tr("Över axeln", "Over the shoulder")], ["reaction", tr("Reaktionsbild", "Reaction shot")], ["insert", tr("Detaljbild", "Detail shot")],
  ];
  const select = (key: "cameraAngle" | "lens" | "depthOfField", label: string, options: Record<string, string>, labels: string[], empty: string) => <label><span>{label} {origin(key)}</span><select value={d[key] ?? ""} onChange={e => patch({ [key]: e.target.value || undefined })}><option value="">{empty}</option>{Object.keys(options).map((value, i) => <option key={value} value={value}>{sv ? labels[i] : options[value]}</option>)}</select></label>;
  const suggest = () => {
    const beats = project.adaptations.flatMap(a => a.beats).filter(b => panel.sourceBeatIds.includes(b.id));
    if (!beats.length) { setNotice(tr("Rutan saknar ett länkat beat.", "This panel has no linked beat.")); return; }
    const visual = beats.flatMap(b => b.visualCandidates).find(v => v.selected) ?? beats.flatMap(b => b.visualCandidates)[0];
    const shot = visual?.shotType ?? (beats[0].beatType === "establishing" ? "establishing-wide" : beats[0].beatType === "reaction" ? "close-up" : "medium");
    setDraft(p => ({ ...p, visualDescription: visual?.description || beats.map(b => b.summary).join(" "), shotType: d.lockShot ? p.shotType : shot, promptDirection: { ...p.promptDirection, cameraAngle: d.lockAngle ? d.cameraAngle : undefined } }));
    setNotice(tr("Lokalt förslag från beatet. Låsta kameraval och övriga detaljer behölls.", "Local suggestion from the beat. Locked camera choices and other details were retained."));
  };
  return createPortal(<div className="image-prompt-backdrop"><div className="image-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="image-prompt-title" ref={modal}>
    <header className="image-prompt-header"><div><h2 id="image-prompt-title">{tr("Justera bildprompt", "Adjust image prompt")}</h2><p className="quiet">{panel.order} · {panel.title}</p></div><button type="button" className="text-button" onClick={onClose}>{tr("Stäng", "Close")}</button></header>
    <div className="image-prompt-body"><div className="image-prompt-fields">
      <div className="image-prompt-style"><strong>{tr("Albumstil", "Album style")} · {project.style.name}</strong><span className="quiet">{tr("Ärvs från albuminställningarna", "Inherited from album settings")}</span></div>
      <h3>{tr("Motiv & handling", "Subject & action")}</h3>
      <label>{tr("Handling & placering", "Action & staging")}<textarea rows={3} value={draft.visualDescription} onChange={e => setDraft(p => ({ ...p, visualDescription: e.target.value }))} /></label>
      <div className="image-prompt-ai-actions"><button type="button" className="secondary-button" disabled={!hasModel || sceneBusy} onClick={() => void rewriteScene()}>{sceneBusy?tr("Skriver bildscen…", "Writing visual scene…"):tr("Skriv om till bildscen med lokal AI", "Rewrite as visual scene with local AI")}</button>{sceneBusy?<button type="button" className="text-button" onClick={() => sceneRequest.current?.abort()}>{tr("Avbryt AI", "Cancel AI")}</button>:null}</div>
      <p className="quiet">{hasModel?tr("Skickar rutans källavsnitt och regi till din valda lokala modell. Du granskar förslaget före användning.", "Sends this panel's source passage and direction to your selected local model. Review the suggestion before applying it."):tr("Välj en lokal textmodell i Inställningar för att få en AI-omskriven bildscen.", "Choose a local text model in Settings to get an AI-written visual scene.")}</p>
      {sceneError?<p role="alert">{sceneError}</p>:null}
      {sceneSuggestion?<section className="image-prompt-ai-suggestion" aria-label={tr("Föreslagen bildscen", "Suggested visual scene")}><h4>{tr("Föreslagen bildscen", "Suggested visual scene")}</h4><p>{sceneSuggestion}</p><button type="button" className="secondary-button" onClick={() => { setDraft(p => ({ ...p, visualDescription: sceneSuggestion })); setSceneSuggestion(null); setNotice(tr("Förslaget används i utkastet. Granska och spara bildprompten när du är nöjd.", "Suggestion applied to the draft. Review it and save the image prompt when ready.")); }}>{tr("Använd bildscenen", "Use visual scene")}</button><button type="button" className="text-button" onClick={() => setSceneSuggestion(null)}>{tr("Förkasta förslag", "Discard suggestion")}</button></section>:null}
      {project.characters.filter(c => draft.characterIds.includes(c.id)).map(c => <div className="image-prompt-character" key={c.id}><strong>{c.name}</strong><p className="quiet">{c.visualIdentity || c.description}</p><label>{tr("Handling, pose & uttryck", "Action, pose & expression")}<textarea rows={2} value={d.characterActions?.[c.id] ?? ""} onChange={e => patch({ characterActions: { ...d.characterActions, [c.id]: e.target.value } })} /></label></div>)}
      <label>{tr("Miljö", "Environment")}<textarea rows={2} value={d.setting ?? ""} placeholder={project.locations.find(l => l.id === panel.locationId)?.visualIdentity || project.locations.find(l => l.id === panel.locationId)?.description || tr("Valfritt — använd rutans miljö", "Optional — use the panel location")} onChange={e => patch({ setting: e.target.value })} /></label>
      <label>{tr("Ljussättning & tid", "Lighting & time")}<input value={d.lighting ?? ""} placeholder={tr("Exempel: skymning, varmt ljus från lyktan", "Example: dusk, warm lantern light")} onChange={e => patch({ lighting: e.target.value })} /></label>
      <h3>{tr("Utsnitt & kameravinkel", "Framing & camera angle")}</h3><div className="image-prompt-pair"><div><label>{tr("Utsnitt", "Shot type")}<select value={draft.shotType ?? ""} onChange={e => setDraft(p => ({ ...p, shotType: e.target.value as ShotType || undefined }))}><option value="">{tr("Automatiskt / ospecificerat", "Automatic / unspecified")}</option>{shots.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="image-prompt-check"><input type="checkbox" checked={Boolean(d.lockShot)} onChange={e => patch({ lockShot: e.target.checked })} />{tr("Lås utsnitt vid nytt förslag", "Lock shot for new suggestions")}</label></div><div>{select("cameraAngle", tr("Kameravinkel", "Camera angle"), CAMERA_ANGLES, ["Ögonhöjd", "Låg vinkel", "Hög vinkel", "Grodperspektiv", "Fågelperspektiv", "Sned vinkel", "Rakt ovanifrån"], tr("Automatiskt / ospecificerat", "Automatic / unspecified"))}<label className="image-prompt-check"><input type="checkbox" checked={Boolean(d.lockAngle)} onChange={e => patch({ lockAngle: e.target.checked })} />{tr("Lås vinkel vid nytt förslag", "Lock angle for new suggestions")}</label></div></div>
      <details><summary>{tr("Optik & fokus", "Optics & focus")} {category(["lens", "depthOfField", "focalPoint"])}</summary><div className="image-prompt-pair">{select("lens", tr("Perspektiv", "Perspective"), LENSES, ["Dramatisk vidvinkel · 14 mm", "Vidvinkel · 24 mm", "Naturligt · 50 mm", "Komprimerat · 85 mm", "Kraftigt komprimerat · 200 mm", "Naturlig vidvinkel · 35 mm"], tr("Ospecificerat", "Unspecified"))}{select("depthOfField", tr("Skärpedjup", "Depth of field"), DEPTHS, ["Hela scenen skarp", "Oskarp bakgrund", "Isolerad detalj"], tr("Ospecificerat", "Unspecified"))}</div><label>{tr("Visuell fokuspunkt", "Visual focal point")}<input value={d.focalPoint ?? ""} onChange={e => patch({ focalPoint: e.target.value })} placeholder={tr("Exempel: karaktärens ansikte", "Example: the character's face")} /></label></details>
      <details><summary>{tr("Specialeffekter", "Special effects")} {category(["effects"])}</summary><div className="image-prompt-effects">{Object.entries(EFFECTS).map(([key, label], i) => <label className="image-prompt-check" key={key}><input type="checkbox" checked={d.effects?.includes(key) ?? false} onChange={e => patch({ effects: e.target.checked ? [...(d.effects ?? []), key] : d.effects?.filter(x => x !== key) })} />{sv ? ["Fartstreck", "Rörelseoskärpa", "Zoomoskärpa", "Rasterpunkter", "Ljusöverstrålning", "Färgseparation", "Rörelsespår", "Glitch"][i] : label} {d.effects?.includes(key) ? origin("effects") : null}</label>)}</div><div className="image-prompt-pair"><label>{tr("Styrka", "Strength")}<select value={d.effectStrength ?? "normal"} onChange={e => patch({ effectStrength: e.target.value as PromptDirection["effectStrength"] })}><option value="subtle">{tr("Subtil", "Subtle")}</option><option value="normal">{tr("Normal", "Normal")}</option><option value="strong">{tr("Kraftig", "Strong")}</option></select></label><label>{tr("Omfattning", "Scope")}<select value={d.effectScope ?? "background"} onChange={e => patch({ effectScope: e.target.value as PromptDirection["effectScope"] })}><option value="background">{tr("Bakgrund", "Background")}</option><option value="subjects">{tr("Motiv", "Subjects")}</option><option value="whole-image">{tr("Hela bilden", "Whole image")}</option></select></label></div></details>
      <details><summary>{tr("Kontinuitet", "Continuity")} {category(["continuity"])}</summary><label>{tr("Detaljer att behålla mellan rutorna", "Details to retain between panels")}<textarea rows={3} value={d.continuity ?? ""} onChange={e => patch({ continuity: e.target.value })} placeholder={tr("Kläder, skador, rekvisita…", "Clothing, injuries, props…")} /></label></details>
    </div><aside className="image-prompt-preview"><h3>{tr("Slutlig prompt", "Final prompt")}</h3><p className="quiet">{tr("Uppdateras när du ändrar valen. Sparas först när du klickar på Spara bildprompt.", "Updates as you edit. Saved only when you click Save image prompt.")}</p><pre aria-label={tr("Promptförhandsvisning", "Prompt preview")}>{prompt}</pre>{previous && <details><summary>{tr("Nuvarande sparad prompt", "Current saved prompt")}</summary><pre>{previous.prompt}</pre></details>}<p className="quiet" role="status">{notice}</p></aside></div>
    <footer className="image-prompt-footer"><button type="button" className="text-button" onClick={suggest}>{tr("Nytt förslag från beat", "New suggestion from beat")}</button><div><button type="button" className="text-button" onClick={onClose}>{tr("Avbryt", "Cancel")}</button><button type="button" className="primary-button" onClick={() => onSave({ visualDescription: draft.visualDescription, shotType: draft.shotType, promptDirection: draft.promptDirection })}>{tr("Spara bildprompt", "Save image prompt")}</button></div></footer>
  </div></div>, document.body);
}

