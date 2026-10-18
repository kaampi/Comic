// A damped spring drives only temporary DOM transforms. Grid coordinates and
// authored panel geometry never participate in this animation.
export type JellySpring = { x: number; y: number; vx: number; vy: number };
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
export function nudgeJelly(state: JellySpring, dx: number, dy: number): JellySpring {
  return { ...state, vx: clamp(state.vx + clamp(dx, 60) * 4.5, 180), vy: clamp(state.vy + clamp(dy, 60) * 4.5, 180) };
}
export function stepJelly(state: JellySpring, elapsed: number): JellySpring {
  const next = { ...state };
  // Small integration steps keep the spring stable after slow/background frames.
  let remaining = Math.max(0, Math.min(elapsed, 0.05));
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    next.vx += (-140 * next.x - 12 * next.vx) * dt;
    next.vy += (-140 * next.y - 12 * next.vy) * dt;
    next.x = clamp(next.x + next.vx * dt, 9);
    next.y = clamp(next.y + next.vy * dt, 9);
    remaining -= dt;
  }
  return next;
}
export function jellyTransform(state: JellySpring): string {
  const x = state.x * 0.8, y = state.y * 0.8;
  return `translate(${-x * 1.4}px, ${-y * 1.4}px) rotate(${x * 0.35}deg) skew(${x * 0.9}deg, ${y * 0.7}deg) scale(${1 + Math.abs(x) * 0.009 - Math.abs(y) * 0.005}, ${1 + Math.abs(y) * 0.009 - Math.abs(x) * 0.005})`;
}
export type PanelJelly = { nudge: (dx: number, dy: number) => void; settle: () => void; cancel: () => void };
const noMotion: PanelJelly = { nudge() {}, settle() {}, cancel() {} };
export function createPanelJelly(target: HTMLElement, text?: SVGElement): PanelJelly {
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (motion?.matches || !window.requestAnimationFrame) return noMotion;
  const elements: Array<HTMLElement | SVGElement> = [target, ...(text ? [text] : [])];
  const saved = elements.map(element => ({ transform: element.style.transform, origin: element.style.transformOrigin, box: element.style.transformBox, willChange: element.style.willChange }));
  let state: JellySpring = { x: 0, y: 0, vx: 0, vy: 0 }, frame = 0, previous = 0, released = false, stopped = false;
  elements.forEach(element => {
    element.style.transformOrigin = 'center';
    element.style.transformBox = element instanceof SVGElement ? 'fill-box' : 'border-box';
    element.style.willChange = 'transform';
  });
  target.setAttribute('data-panel-jelly', '');
  const cancel = () => {
    if (stopped) return;
    stopped = true; window.cancelAnimationFrame(frame);
    motion?.removeEventListener?.('change', cancel);
    elements.forEach((element, i) => {
      element.style.transform = saved[i].transform;
      element.style.transformOrigin = saved[i].origin;
      element.style.transformBox = saved[i].box;
      element.style.willChange = saved[i].willChange;
    });
    target.removeAttribute('data-panel-jelly');
    elements.length = 0;
  };
  const tick = (now: number) => {
    frame = 0;
    if (!target.isConnected) { cancel(); return; }
    state = stepJelly(state, previous ? (now - previous) / 1000 : 1 / 60); previous = now;
    const atRest = Math.max(Math.abs(state.x), Math.abs(state.y)) < 0.015 && Math.max(Math.abs(state.vx), Math.abs(state.vy)) < 0.15;
    if (atRest) {
      state = { x: 0, y: 0, vx: 0, vy: 0 };
      if (released) { cancel(); return; }
    }
    const transform = jellyTransform(state);
    elements.forEach(element => { element.style.transform = transform; });
    if (!atRest) frame = window.requestAnimationFrame(tick);
    else previous = 0;
  };
  const start = () => { if (!stopped && !frame) frame = window.requestAnimationFrame(tick); };
  motion?.addEventListener?.('change', cancel);
  return {
    nudge(dx, dy) { if (!stopped) { state = nudgeJelly(state, dx, dy); start(); } },
    settle() { if (!stopped) { released = true; state = nudgeJelly(state, 0, -9); start(); } },
    cancel,
  };
}
