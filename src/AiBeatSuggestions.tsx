import { BeatAnalysisDialog } from "./BeatAnalysisDialog";
import { useEffect, useRef, useState } from "react";
import { adaptationFromAiBeats, splitBeatSource, suggestAiBeats } from "./adaptation/aiBeats";
import type { AdaptationBeat, StoryAdaptation } from "./adaptation/types";
import type { ComicProject } from "./project";
import { type LocalAiSettings } from "./localAi";
import { localAiText } from "./localAiText";
import type { Locale } from "./settings";

export function AiBeatSuggestions({ project, adaptation, settings, locale, onApply, onSettings }: {
  project: ComicProject; adaptation: StoryAdaptation | null; settings: LocalAiSettings; locale: Locale;
  onApply: (adaptation: StoryAdaptation) => void; onSettings: () => void;
}) {
  const t = localAiText(locale);
  const fullSource = project.source.textSnapshot ?? "";
  const [range, setRange] = useState({ start: 0, end: fullSource.length });
  const [highlighted, setHighlighted] = useState<{ start: number; end: number } | null>(null);
  const [draft, setDraft] = useState<{ source: string; beats: AdaptationBeat[] } | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  useEffect(() => {
    setRange({ start: 0, end: fullSource.length }); setHighlighted(null); setBusy(false);
    ++requestNumber.current; controller.current?.abort();
    return () => { ++requestNumber.current; controller.current?.abort(); };
  }, [fullSource]);
  const source = fullSource.slice(range.start, range.end);
  const analysisRange = highlighted ?? range;
  const analysisSource = fullSource.slice(analysisRange.start, analysisRange.end);
  const server = settings.servers[settings.engine];
  const configured = Boolean(server.baseUrl.trim() && server.model.trim());
  const stale = draft && draft.source !== fullSource;
  const analyse = async () => {
    // A visible selection is the user's current scope, even without the
    // optional "Use highlighted text" button.
    const selectedSource = analysisSource;
    const selectedOffset = analysisRange.start;
    setRange(analysisRange); setHighlighted(null);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const request = ++requestNumber.current;
    setBusy(true); setMessage(""); setDraft(null); setExcluded([]);
    // A local model may need several minutes per passage; progress refreshes the timeout.
    let timeout = window.setTimeout(() => abort.abort(), 300000);
    try {
      const beats = await suggestAiBeats({
        source: selectedSource, sourceOffset: selectedOffset, context: { characters: project.characters, locations: project.locations },
        settings, signal: abort.signal, onProgress: (done, total) => {
          if (request !== requestNumber.current) return;
          setProgress({ done, total });
          window.clearTimeout(timeout); timeout = window.setTimeout(() => abort.abort(), 300000);
        }
      });
      if (request === requestNumber.current && !abort.signal.aborted) setDraft({ source: fullSource, beats });
    } catch (error) {
      if (request === requestNumber.current) setMessage(abort.signal.aborted ? t.cancelled : t.failed + " " + (error instanceof Error ? error.message : String(error)));
    } finally {
      window.clearTimeout(timeout);
      if (request === requestNumber.current) setBusy(false);
    }
  };
  const editBeat = (beatId: string, patch: Partial<AdaptationBeat>) => {
    setDraft(current => current ? { ...current, beats: current.beats.map(beat => beat.id === beatId ? { ...beat, ...patch } : beat) } : null);
  };
  const apply = () => {
    if (!draft || draft.source !== fullSource) { setMessage(t.stale); return; }
    const beats = draft.beats.filter(beat => !excluded.includes(beat.id));
    if (!beats.length) { setMessage(t.empty); return; }
    onApply(adaptationFromAiBeats(project.title + " – adaptation", fullSource, beats, adaptation));
    setDraft(null); setMessage("");
  };
  return <details className="ai-beat-tool">
    <summary>{t.show}</summary>
    <div className="ai-beat-content">
      <div className="section-heading"><h3>{t.propose}</h3><button className="text-button" type="button" onClick={onSettings}>{t.settings}</button></div>
      {!configured ? <p className="quiet">{t.configure}</p> : <p>{settings.engine === "ollama" ? "Ollama" : "LM Studio / llama.cpp"} · {server.baseUrl} · <strong>{server.model}</strong></p>}
      <p className="quiet">{t.sourceHelp}</p>
      <label>{t.source}<textarea rows={7} readOnly value={source} disabled={busy} onSelect={e => {
        const textarea = e.currentTarget;
        setHighlighted(textarea.selectionEnd > textarea.selectionStart ? { start: range.start + textarea.selectionStart, end: range.start + textarea.selectionEnd } : null);
      }} /></label>
      <div className="adaptation-step-actions">
        <button className="text-button" type="button" disabled={busy || !highlighted} onClick={() => { if (highlighted) setRange(highlighted); setHighlighted(null); }}>{t.selection}</button>
        <button className="text-button" type="button" disabled={busy || (!highlighted && range.start === 0 && range.end === fullSource.length)} onClick={() => { setRange({ start: 0, end: fullSource.length }); setHighlighted(null); }}>{t.whole}</button>
      </div>
      <p className="quiet" role="status">{analysisRange.start !== 0 || analysisRange.end !== fullSource.length ? t.selected : t.whole} · {t.preview} · {analysisSource.length} {t.chars} · {splitBeatSource(analysisSource, settings.contextWindow).length} {t.parts}</p>
      <div className="adaptation-step-actions">
        <button className="primary-button" type="button" disabled={busy || !configured || !analysisSource.trim()} onClick={() => void analyse()}>{busy ? t.analysing + " " + Math.min(progress.done + 1, progress.total) + " / " + progress.total : t.analyse}</button>
      </div>
      {busy ? <BeatAnalysisDialog locale={locale} progress={progress.total ? `${Math.min(progress.done + 1, progress.total)} / ${progress.total}` : ""} onCancel={() => { requestNumber.current++; controller.current?.abort(); setBusy(false); setMessage(t.cancelled); }} /> : null}
      {message ? <p className="import-error" role="alert">{message}</p> : null}
      {draft ? <section className="ai-beat-review">
        <h3>{t.review} · {draft.beats.length}</h3>
        {stale ? <p className="import-error" role="alert">{t.stale}</p> : null}
        <p className="quiet">{t.replace}</p>
        <div className="beat-grid">{draft.beats.map(beat => <article className="adaptation-card" key={beat.id}>
          <div className="adaptation-card-meta"><span>{beat.order} · {t.generated}</span><span>{beat.beatType}</span></div>
          <label className="ai-beat-checkbox"><input type="checkbox" checked={!excluded.includes(beat.id)} onChange={e => setExcluded(current => e.target.checked ? current.filter(id => id !== beat.id) : [...current, beat.id])} />{t.include}</label>
          <input aria-label={t.generated} value={beat.title} onChange={e => editBeat(beat.id, { title: e.target.value })} />
          <label>{t.summary}<textarea rows={3} value={beat.summary} onChange={e => editBeat(beat.id, { summary: e.target.value })} /></label>
          <label>{t.visual}<textarea rows={3} value={beat.visualCandidates[0]?.description ?? ""} onChange={e => editBeat(beat.id, { visualCandidates: [{ ...beat.visualCandidates[0], description: e.target.value }] })} /></label>
          {beat.dialogueCandidates.length ? <div className="adaptation-snippet"><strong>{t.dialogue}</strong>{beat.dialogueCandidates.map(item => <q key={item.id}>{item.text}</q>)}</div> : null}
          {beat.captionCandidates.length ? <div className="adaptation-snippet"><strong>{t.caption}</strong>{beat.captionCandidates.map(item => <p key={item.id}>{item.text}</p>)}</div> : null}
          <details><summary>{t.original}</summary><p>{beat.sourceTextExcerpt}</p></details>
        </article>)}</div>
        <div className="adaptation-step-actions">
          <button className="primary-button" type="button" disabled={Boolean(stale) || draft.beats.every(beat => excluded.includes(beat.id) || !beat.title.trim() || !beat.summary.trim()) || draft.beats.some(beat => !excluded.includes(beat.id) && (!beat.title.trim() || !beat.summary.trim() || !beat.visualCandidates[0]?.description.trim()))} onClick={apply}>{t.apply}</button>
          <button className="text-button" type="button" onClick={() => setDraft(null)}>{t.discard}</button>
        </div>
      </section> : null}
    </div>
  </details>;
}

