import { useEffect, useId, useRef } from "react";
import { GUIDE } from "./guideContent";
import "./guide.css";

export function GuideDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); onClose();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? []);
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault(); controls.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        event.preventDefault(); controls[0]?.focus();
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => { window.removeEventListener("keydown", keydown, true); previous?.focus(); };
  }, [onClose]);
  return <div className="overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="guide-card getting-started-guide" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} lang="en">
      <header className="getting-started-header">
        <p className="eyebrow">GUIDE · BETA</p>
        <button className="text-button" type="button" ref={close} onClick={onClose}>Close guide</button>
      </header>
      <h1 id={titleId}>{GUIDE.title}</h1>
      <p className="guide-intro">{GUIDE.intro}</p>
      <p className="quiet">{GUIDE.beta}</p>
      <nav className="guide-contents" aria-label="Guide topics">
        {(["start", "more"] as const).map(group => <div key={group}>
          <h2>{group === "start" ? "Make your first page" : "When you are ready for more"}</h2>
          <ul>{GUIDE.topics.filter(topic => topic.group === group).map(topic => <li key={topic.id}>
            <a href={`#guide-${topic.id}`} onClick={event => {
              event.preventDefault();
              const target = dialog.current?.querySelector<HTMLElement>(`#guide-${topic.id}`);
              target?.scrollIntoView?.({ block: "start" }); target?.focus({ preventScroll: true });
            }}>{topic.title}</a>
          </li>)}</ul>
        </div>)}
      </nav>
      {GUIDE.topics.map(topic => <section className="guide-topic" key={topic.id} aria-labelledby={`guide-${topic.id}`}>
        <h2 id={`guide-${topic.id}`} tabIndex={-1}>{topic.title}</h2>
        {topic.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        <ol>{topic.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <p className="guide-tip">{topic.tip}</p>
        <a href="#guide-top" onClick={event => {
          event.preventDefault(); dialog.current?.scrollTo?.({ top: 0 }); close.current?.focus();
        }}>Back to guide contents</a>
      </section>)}
    </section>
  </div>;
}
