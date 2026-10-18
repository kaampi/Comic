import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import type { BubbleLink, TextOverlay } from "./project";
import type { LayerTextMetrics } from "./pageTypography";
import type { Locale } from "./settings";
import { ConnectedBubbles } from "./ConnectedBubbles";
import { bubbleConnectionControls, moveConnectionHandle, type ConnectionHandle } from "./bubbleConnections";

const labels = {
  sv: { start: 'Startpunkt', end: 'Slutpunkt', control1: 'Kurvhandtag vid första bubblan', control2: 'Kurvhandtag vid andra bubblan', connection: 'Förbindelse' },
  en: { start: 'Start attachment', end: 'End attachment', control1: 'Curve handle at first bubble', control2: 'Curve handle at second bubble', connection: 'Connection' },
  nb: { start: 'Startpunkt', end: 'Sluttpunkt', control1: 'Kurvehåndtak ved første boble', control2: 'Kurvehåndtak ved andre boble', connection: 'Forbindelse' },
};
type Draft = { sourceId: string; link: BubbleLink };

// The preview stays inside this component; pointer moves never save the album.
export function BubbleConnectionEditor({ overlays, selectedId, textMetrics, locale, onChange, children }: {
  overlays: TextOverlay[]; selectedId?: string | null; textMetrics: LayerTextMetrics;
  locale: Locale; onChange: (sourceId: string, link: BubbleLink) => void; children: ReactNode;
}) {
  const [draft, setDraft] = useState<Draft>();
  const stop = useRef<(() => void) | undefined>();
  const callback = useRef(onChange); callback.current = onChange;
  useEffect(() => () => stop.current?.(), [selectedId]);
  const preview = draft ? overlays.map(o => o.id !== draft.sourceId ? o : { ...o, bubbleLinks: o.bubbleLinks?.map(l => l.targetId === draft.link.targetId ? draft.link : l) }) : overlays;
  const links = preview.flatMap(source => (source.bubbleLinks ?? []).filter(link => source.id === selectedId || link.targetId === selectedId).map(link => ({ source, link, target: preview.find(o => o.id === link.targetId) })));
  const begin = (event: ReactPointerEvent<SVGCircleElement>, source: TextOverlay, target: TextOverlay, link: BubbleLink, handle: ConnectionHandle) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); stop.current?.();
    const svg = event.currentTarget.ownerSVGElement, box = svg?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return;
    let next = link, moved = false, timer: number | undefined;
    const show = () => { timer = undefined; setDraft({ sourceId: source.id, link: next }); };
    const move = (ev: PointerEvent) => {
      next = moveConnectionHandle(source, target, link, handle, { x: (ev.clientX - box.left) / box.width * 100, y: (ev.clientY - box.top) / box.height * 100 }, textMetrics);
      moved = true;
      if (timer === undefined) timer = window.setTimeout(show, 16);
    };
    const clean = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', commit);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', keydown, true);
      stop.current = undefined; setDraft(undefined);
    };
    const cancel = () => clean();
    const commit = () => { clean(); if (moved) callback.current(source.id, next); };
    const keydown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); cancel(); }
    };
    stop.current = cancel;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', commit);
    window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel);
    window.addEventListener('keydown', keydown, true);
  };
  return <>
    <ConnectedBubbles overlays={preview} textMetrics={textMetrics}/>
    {children}
    <g className="bubble-connection-handles">
      {links.map(({ source, target, link }, index) => {
        if (!target) return null;
        const g = bubbleConnectionControls(source, target, link, textMetrics), text = labels[locale];
        const handles: [ConnectionHandle, { x: number; y: number }][] = [['start', g.start], ['end', g.end], ['control1', g.control1], ['control2', g.control2]];
        return <g key={source.id + ':' + target.id} data-connection-source={source.id} data-connection-target={target.id}>
          <path d={`M ${g.start.x} ${g.start.y} L ${g.control1.x} ${g.control1.y} M ${g.end.x} ${g.end.y} L ${g.control2.x} ${g.control2.y}`} fill="none" stroke="#2473a6" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" style={{ pointerEvents: 'none' }}/>
          {handles.map(([handle, point]) => <circle key={handle} className={`bubble-connection-handle connection-${handle}`} cx={point.x} cy={point.y} r={handle.startsWith('control') ? 1.5 : 1.8} fill={handle.startsWith('control') ? '#2473a6' : '#fffdf7'} stroke="#2473a6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" style={{ cursor: 'grab', pointerEvents: 'all' }} role="button" tabIndex={0} aria-label={`${text.connection} ${index + 1}: ${text[handle]}`} onPointerDown={event => begin(event, source, target, link, handle)} onKeyDown={event => {
            const dx = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0, dy = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
            if (!dx && !dy) return;
            event.preventDefault(); event.stopPropagation();
            const step = event.shiftKey ? 5 : 1;
            callback.current(source.id, moveConnectionHandle(source, target, link, handle, { x: point.x + dx * step, y: point.y + dy * step }, textMetrics));
          }}><title>{text[handle]}</title></circle>)}
        </g>;
      })}
    </g>
  </>;
}
