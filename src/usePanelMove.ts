import { createPanelJelly, type PanelJelly } from "./panelJelly";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import type { ComicProject, PageLayer } from "./project";
import { albumPageFormat, pageGridMetrics } from "./pageFormat";
import { panelMoveAllowed } from "./panelMove";

export const PANEL_HOLD_MS = 400;
const HOLD_SLOP = 6;
type Page = ComicProject["pages"][number];
type Preview = { pageId: string; layer: PageLayer; valid: boolean; dx: number; dy: number };
type Options = {
  project: ComicProject | null; pageId: string | null; enabled: boolean;
  onSelect: (pageId: string, id: string) => void;
  onCommit: (pageId: string, id: string, x: number, y: number) => void;
};
export function usePanelMove(options: Options) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const latest = useRef(options); latest.current = options;
  const cleanupRef = useRef<(() => void) | null>(null);
  const suppressUntil = useRef(0);
  const jellyRef = useRef<PanelJelly | null>(null);
  useEffect(() => { cleanupRef.current?.(); jellyRef.current?.cancel(); }, [options.project?.id, options.pageId, options.enabled]);
  useEffect(() => () => { cleanupRef.current?.(); jellyRef.current?.cancel(); }, []);

  const begin = (event: ReactPointerEvent<HTMLElement>, page: Page, layer: PageLayer) => {
    if (!latest.current.enabled || event.button !== 0 || event.isPrimary === false ||
        (event.target as Element).closest("button,input,select,textarea,a,[contenteditable=true]")) return;
    cleanupRef.current?.(); jellyRef.current?.cancel(); suppressUntil.current = 0;
    const target = event.currentTarget, grid = target.closest(".layout-panels") as HTMLElement | null;
    const project = latest.current.project;
    if (!grid || !project) return;
    const box = grid.getBoundingClientRect(), metrics = pageGridMetrics(page, albumPageFormat(project));
    const scale = box.width / metrics.width;
    const stepX = (box.width + metrics.gapX * scale) / page.gridColumns;
    const stepY = (box.height + metrics.gapY * scale) / page.gridRows;
    if (stepX <= 0 || stepY <= 0) return;
    const pointerId = event.pointerId, sx = event.clientX, sy = event.clientY;
    let active = false, candidate = layer, dropped = false, lastX = sx, lastY = sy;
    const matching = (e: PointerEvent) => e.pointerId === pointerId;
    const refresh = (x: number, y: number) => {
      candidate = { ...layer, x: layer.x + Math.round((x - sx) / stepX), y: layer.y + Math.round((y - sy) / stepY) };
      const current = latest.current.project, currentPage = current?.pages.find(p => p.id === page.id);
      setPreview({ pageId: page.id, layer: candidate, valid: !!current && !!currentPage && panelMoveAllowed(current, currentPage, candidate),
        dx: (candidate.x - layer.x) * stepX, dy: (candidate.y - layer.y) * stepY });
    };
    const timer = window.setTimeout(() => {
      active = true; suppressUntil.current = Number.POSITIVE_INFINITY;
      latest.current.onSelect(page.id, layer.id);
      try { target.setPointerCapture?.(pointerId); } catch { /* Pointer already ended. */ }
      const canvas = target.closest(".layout-canvas");
      const text = Array.from(canvas?.querySelectorAll<SVGElement>(".page-foreground-texts [data-text-layer]") ?? []).find(element => element.getAttribute("data-text-layer") === layer.id);
      jellyRef.current = createPanelJelly(target, text);
      jellyRef.current.nudge(0, 12);
      refresh(sx, sy);
    }, PANEL_HOLD_MS);
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancelPointer);
      window.removeEventListener("pointerdown", otherPointer);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", cleanup);
      window.removeEventListener("scroll", cleanup, true);
      window.removeEventListener("resize", cleanup);
      window.removeEventListener("contextmenu", cleanup);
      document.removeEventListener("visibilitychange", cleanup);
      target.removeEventListener("lostpointercapture", cleanup);
      cleanupRef.current = null;
      if (active) { if (!dropped) jellyRef.current?.cancel(); suppressUntil.current = performance.now() + 500; setPreview(null); }
      try { if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId); } catch { /* Detached target. */ }
    };
    const move = (e: PointerEvent) => {
      if (!matching(e)) return;
      if (!active) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > HOLD_SLOP) cleanup(); return; }
      e.preventDefault(); jellyRef.current?.nudge(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; refresh(e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      if (!matching(e)) return;
      if (active) {
        e.preventDefault(); refresh(e.clientX, e.clientY);
        const current = latest.current.project, currentPage = current?.pages.find(p => p.id === page.id);
        dropped = !!current && !!currentPage && panelMoveAllowed(current, currentPage, candidate);
        if (dropped) jellyRef.current?.settle();
        if (dropped && (candidate.x !== layer.x || candidate.y !== layer.y)) latest.current.onCommit(page.id, layer.id, candidate.x, candidate.y);
      }
      cleanup();
    };
    const cancelPointer = (e: PointerEvent) => { if (matching(e)) cleanup(); };
    const otherPointer = (e: PointerEvent) => { if (!matching(e)) cleanup(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { if (active) { e.preventDefault(); e.stopPropagation(); } cleanup(); } };
    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("pointerdown", otherPointer);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", cleanup);
    window.addEventListener("scroll", cleanup, true);
    window.addEventListener("resize", cleanup);
    window.addEventListener("contextmenu", cleanup);
    document.addEventListener("visibilitychange", cleanup);
    target.addEventListener("lostpointercapture", cleanup);
  };
  const suppressClick = (event: ReactMouseEvent) => {
    if (performance.now() < suppressUntil.current) { event.preventDefault(); event.stopPropagation(); }
  };
  return { preview, begin, suppressClick };
}
