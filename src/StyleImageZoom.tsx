import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "./settings";
import "./styleImageZoom.css";

function StyleImageLightbox({ src, name, locale, grayscale, onClose }: {
  src: string; name: string; locale: Locale; grayscale?: boolean; onClose: () => void;
}) {
  const sv = locale === "sv", tr = (s: string, e: string) => sv ? s : e;
  const titleId = useId(), box = useRef<HTMLElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const [original, setOriginal] = useState(false), [failed, setFailed] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const background = trigger?.closest<HTMLElement>(".app-shell") ?? trigger?.closest<HTMLElement>('[role="dialog"]') ?? trigger?.closest<HTMLElement>(".new-album-style-picker");
    const inert = background?.getAttribute("inert"), hidden = background?.getAttribute("aria-hidden"), overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    background?.setAttribute("inert", ""); background?.setAttribute("aria-hidden", "true");
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close.current(); return; }
      if (event.key !== "Tab") return;
      event.preventDefault(); event.stopImmediatePropagation();
      const buttons = Array.from(box.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const index = buttons.findIndex(button => button === document.activeElement);
      const next = index < 0 ? (event.shiftKey ? buttons.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    };
    // Capture Escape/Tab before the underlying album dialog handles them.
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true); document.body.style.overflow = overflow;
      if (background) {
        if (inert == null) background.removeAttribute("inert"); else background.setAttribute("inert", inert);
        if (hidden == null) background.removeAttribute("aria-hidden"); else background.setAttribute("aria-hidden", hidden);
      }
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return createPortal(<div className="style-image-lightbox-backdrop" onMouseDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }} onClick={event => event.stopPropagation()}>
    <section className="style-image-lightbox" ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header><h2 id={titleId}>{name}</h2><div className="style-image-lightbox-actions">
        <button type="button" className="text-button" disabled={failed} aria-pressed={original} onClick={() => setOriginal(value => !value)}>{original ? tr("Anpassa till fönstret", "Fit to window") : tr("Originalstorlek", "Original size")}</button>
        <button type="button" className="text-button" ref={closeButton} onClick={onClose}>{tr("Stäng bild", "Close image")} ×</button>
      </div></header>
      <div className={`style-image-lightbox-stage${original ? " is-original" : ""}`} onClick={event => { if(event.target === event.currentTarget) onClose(); }}>
        {failed ? <p role="alert">{tr("Bilden kunde inte läsas.", "Could not load the image.")}</p> : <img src={src} alt={name} style={grayscale ? { filter: "grayscale(1) contrast(1.15)" } : undefined} onError={() => setFailed(true)} onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />}
      </div>
      <footer><span>{dimensions ? `${dimensions.width} × ${dimensions.height} px` : ""}</span><span>{tr("Escape eller klick utanför bilden för att stänga", "Escape or click outside the image to close")}</span></footer>
    </section>
  </div>, document.body);
}

export function StyleImageZoom({ src, name, locale, grayscale, compact = false }: {
  src?: string; name: string; locale: Locale; grayscale?: boolean; compact?: boolean;
}) {
  const [open, setOpen] = useState(false), sv = locale === "sv";
  if (!src) return null;
  return <>
    <button type="button" className={`style-image-zoom-button${compact ? " is-compact" : ""}`} aria-label={`${sv ? "Förstora" : "Enlarge"}: ${name}`} onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6M7 10h6M10 7v6" /></svg>{!compact && <span>{sv ? "Förstora" : "Enlarge"}</span>}
    </button>
    {open && <StyleImageLightbox key={src} src={src} name={name} locale={locale} grayscale={grayscale} onClose={() => setOpen(false)} />}
  </>;
}
