import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "./settings";
import "./beatAnalysisDialog.css";

const labels = (locale: Locale) => locale === 'sv' ? {
  title: 'Föreslår beats', analysing: 'Analyserar avsnitt', preparing: 'Förbereder analysen…', cancel: 'Avbryt',
  help: 'Den lokala AI:n letar efter bildögonblick i din text. Första anropet kan ta lite längre tid medan modellen laddas. Du får granska förslagen när analysen är klar.',
} : locale === 'nb' ? {
  title: 'Foreslår beats', analysing: 'Analyserer avsnitt', preparing: 'Forbereder analysen…', cancel: 'Avbryt',
  help: 'Den lokale AI-en leter etter bildemomenter i teksten. Første forespørsel kan ta litt lengre tid mens modellen lastes. Du får gjennomgå forslagene når analysen er ferdig.',
} : {
  title: 'Suggesting beats', analysing: 'Analysing passage', preparing: 'Preparing analysis…', cancel: 'Cancel',
  help: 'Your local AI is looking for visual moments in the text. The first request may take longer while the model loads. You can review the suggestions when the analysis is complete.',
};
const dots = [[12,3],[16.5,4.21],[19.79,7.5],[21,12],[19.79,16.5],[16.5,19.79],[12,21],[7.5,19.79],[4.21,16.5],[3,12],[4.21,7.5],[7.5,4.21]];
export function BeatAnalysisDialog({ locale, progress, onCancel, returnFocus }: { locale: Locale; progress: string; onCancel: () => void; returnFocus?: HTMLElement | null }) {
  const t = labels(locale), id = useId(), backdrop = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel); cancel.current = onCancel;
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children).filter(node => node !== backdrop.current);
    const original = siblings.map(node => ({ node, inert: node.getAttribute('inert'), hidden: node.getAttribute('aria-hidden') }));
    siblings.forEach(node => { node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true'); });
    document.body.style.overflow = 'hidden'; button.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel.current(); }
      if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); button.current?.focus(); }
    };
    const focus = (event: FocusEvent) => { if (!backdrop.current?.contains(event.target as Node)) button.current?.focus(); };
    document.addEventListener('keydown', key, true); document.addEventListener('focusin', focus);
    return () => {
      document.removeEventListener('keydown', key, true); document.removeEventListener('focusin', focus);
      document.body.style.overflow = overflow;
      original.forEach(({ node, inert, hidden }) => {
        if (inert === null) node.removeAttribute('inert'); else node.setAttribute('inert', inert);
        if (hidden === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', hidden);
      });
      if (active?.isConnected && active !== document.body && !active.matches(':disabled')) active.focus();
      else if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);
  return createPortal(<div className="beat-analysis-backdrop" ref={backdrop}>
    <section className="beat-analysis-dialog" role="dialog" aria-modal="true" aria-labelledby={id + '-title'} aria-describedby={id + '-help'}>
      <svg className="beat-analysis-spinner" width="64" height="64" viewBox="0 0 24 24" aria-hidden="true"><g>{dots.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1" fill="currentColor" style={{ animationDelay: `${i * .1}s` }}/>)}</g></svg>
      <h2 id={id + '-title'}>{t.title}</h2>
      <p className="beat-analysis-status" role="status" aria-live="polite">{progress ? `${t.analysing} ${progress}` : t.preparing}</p>
      <p id={id + '-help'} className="quiet">{t.help}</p>
      <button ref={button} type="button" className="secondary-button" onClick={onCancel}>{t.cancel}</button>
    </section>
  </div>, document.body);
}
