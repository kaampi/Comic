import { createContext, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import type { Locale } from "./settings";

export const EditorViewScale = createContext(1);

export type EditorView = { scale: number; x: number; y: number };
export const fittedView: EditorView = { scale: 1, x: 0, y: 0 };
// point is relative to the viewport centre. Keep its document position fixed.
export function zoomEditorView(view: EditorView, scale: number, point = { x: 0, y: 0 }): EditorView {
  scale = Math.max(.25, Math.min(8, scale));
  const ratio = scale / view.scale;
  return { scale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio };
}
const zoomStops = [.25, .5, .75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
const typing = (target: EventTarget | null) => target instanceof window.Element && !!target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]');

// Local view state only: unmounting the editor restores Fit automatically.
export function EditorViewport({ children, locale, imageEditing }: { children: ReactNode; locale: Locale; imageEditing: boolean }) {
  const [view, setView] = useState(fittedView), [space, setSpace] = useState(false), [panning, setPanning] = useState(false);
  const viewport = useRef<HTMLDivElement>(null), spaceHeld = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; view: EditorView }>();
  const sv = locale === 'sv', nb = locale === 'nb';
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !typing(e.target)) { e.preventDefault(); spaceHeld.current = true; setSpace(true); } };
    const release = () => { spaceHeld.current = false; setSpace(false); drag.current = undefined; setPanning(false); };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') release(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', release);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', release); };
  }, []);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || imageEditing || e.defaultPrevented) return;
      e.preventDefault();
      const box = element.getBoundingClientRect();
      setView(v => zoomEditorView(v, v.scale * Math.exp(-e.deltaY * .002), { x: e.clientX - box.left - box.width / 2, y: e.clientY - box.top - box.height / 2 }));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [imageEditing]);
  return <>
    <div className="editor-view-controls" role="group" aria-label={sv ? 'Visningszoom' : nb ? 'Visningszoom' : 'Editor view zoom'}>
      <span>{sv || nb ? 'Visningszoom' : 'View zoom'}</span>
      <button type="button" aria-label={sv ? 'Zooma ut' : nb ? 'Zoom ut' : 'Zoom out'} disabled={view.scale <= .25} onClick={() => setView(v => zoomEditorView(v, [...zoomStops].reverse().find(s => s < v.scale - .001) ?? .25))}>−</button>
      <output aria-live="polite">{Math.round(view.scale * 100)}%</output>
      <button type="button" aria-label={sv ? 'Zooma in' : nb ? 'Zoom inn' : 'Zoom in'} disabled={view.scale >= 8} onClick={() => setView(v => zoomEditorView(v, zoomStops.find(s => s > v.scale + .001) ?? 8))}>+</button>
      <button type="button" onClick={() => setView(fittedView)}>{sv ? 'Anpassa' : nb ? 'Tilpass' : 'Fit'}</button>
      <small>{sv ? 'Ctrl/⌘ + scroll · Mellanslag + dra för att panorera' : nb ? 'Ctrl/⌘ + rull · Mellomrom + dra for å panorere' : 'Ctrl/⌘ + scroll · Space + drag to pan'}</small>
    </div>
    <div ref={viewport} className={`panel-editor-stage-shell editor-viewport${space ? ' is-pan-ready' : ''}${panning ? ' is-panning' : ''}`} onPointerDownCapture={e => {
      if (!(spaceHeld.current || e.button === 1) || typing(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, view };
      e.currentTarget.setPointerCapture(e.pointerId); setPanning(true);
    }} onPointerMove={e => {
      const start = drag.current; if (!start || e.pointerId !== start.id) return;
      e.preventDefault(); e.stopPropagation(); setView({ ...start.view, x: start.view.x + e.clientX - start.x, y: start.view.y + e.clientY - start.y });
    }} onPointerUp={e => { if (drag.current?.id === e.pointerId) { drag.current = undefined; setPanning(false); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } }} onPointerCancel={() => { drag.current = undefined; setPanning(false); }} onLostPointerCapture={() => { drag.current = undefined; setPanning(false); }}>
      <div className="editor-view-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, '--editor-view-scale': view.scale } as CSSProperties}><EditorViewScale.Provider value={view.scale}>{children}</EditorViewScale.Provider></div>
    </div>
  </>;
}
