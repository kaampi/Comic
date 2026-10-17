// Opt-in, bounded technical diagnostics. Never record field values or project data.
const FLAG = 'comicbook-ai.diagnostics.enabled';
const KEY = 'comicbook-ai.diagnostics.log';
const LIMIT = 160;
type Entry = { time: string; event: string; data: Record<string, number | string | boolean> };
let enabled = false;
let entries: Entry[] = [];
let installed = false;
let dirty = false;
let timer: ReturnType<typeof setInterval> | undefined;
let observer: PerformanceObserver | undefined;
let textInputs = 0, colorInputs = 0;
let previousSample = performance.now();
try {
  enabled = localStorage.getItem(FLAG) === '1';
  const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  if (Array.isArray(stored)) entries = stored.slice(-LIMIT).filter(item => item && typeof item.time === 'string' && typeof item.event === 'string' && item.data && typeof item.data === 'object');
} catch { /* Diagnostics must not break startup. */ }

function flush() {
  if (!dirty) return;
  try { localStorage.setItem(KEY, JSON.stringify(entries)); dirty = false; } catch { /* Keep a bounded in-memory log if storage is unavailable. */ }
}
export function diagnosticsEnabled() { return enabled; }
export function recordDiagnostic(event: string, data: Entry['data'] = {}) {
  if (!enabled) return;
  entries.push({ time: new Date().toISOString(), event, data });
  if (entries.length > LIMIT) entries.splice(0, entries.length - LIMIT);
  dirty = true;
  if (event.endsWith('error')) flush();
}
export function diagnosticErrorName(error: unknown): string {
  // Error messages and arbitrary rejection payloads can contain private content.
  const names = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'QuotaExceededError', 'SecurityError', 'AbortError', 'InvalidStateError', 'UnknownError', 'ProjectStorageError'];
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  return typeof name === 'string' && names.includes(name) ? name : 'OtherError';
}
function sample() {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  recordDiagnostic('activity', {
    textInputs, colorInputs, intervalMs: Math.round(performance.now() - previousSample), visibility: document.visibilityState,
    ...(memory ? { heapBytes: memory.usedJSHeapSize, heapLimitBytes: memory.jsHeapSizeLimit } : {}),
  });
  textInputs = colorInputs = 0;
  previousSample = performance.now();
  flush();
}
function configure() {
  if (timer) clearInterval(timer);
  observer?.disconnect();
  observer = undefined;
  textInputs = colorInputs = 0;
  if (!enabled) return;
  previousSample = performance.now();
  timer = setInterval(sample, 2000);
  try {
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      observer = new PerformanceObserver(list => {
        for (const task of list.getEntries()) recordDiagnostic('long-task', { durationMs: Math.round(task.duration) });
      });
      observer.observe({ entryTypes: ['longtask'] });
    }
  } catch { /* Unsupported in some browsers. */ }
}
export function setDiagnosticsEnabled(value: boolean) {
  if (!value) { recordDiagnostic('logging-stopped'); flush(); }
  enabled = value;
  try { localStorage.setItem(FLAG, value ? '1' : '0'); } catch { /* Session-only logging still works. */ }
  if (value) { recordDiagnostic('logging-started'); flush(); }
  if (installed) configure();
}
export function installDiagnostics() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', event => recordDiagnostic('javascript-error', {
    name: diagnosticErrorName(event.error), line: event.lineno, column: event.colno,
    // Only application source locations, never the error message or full URL.
    location: String(event.error?.stack ?? '').match(/(?:\/src\/|\/assets\/)[\w./-]+:\d+:\d+/)?.[0] ?? 'unavailable',
  }));
  window.addEventListener('unhandledrejection', event => recordDiagnostic('promise-error', { name: diagnosticErrorName(event.reason) }));
  document.addEventListener('input', event => {
    if (!enabled) return;
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'color') colorInputs++;
    else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable) textInputs++;
  }, true);
  document.addEventListener('visibilitychange', () => { recordDiagnostic('visibility', { state: document.visibilityState }); flush(); });
  window.addEventListener('pagehide', () => { recordDiagnostic('page-hidden'); sample(); });
  recordDiagnostic('app-start', { previousEntries: entries.length, heapMeasurementAvailable: 'memory' in performance });
  flush();
  configure();
}
export function downloadDiagnostics() {
  recordDiagnostic('log-export'); flush();
  const blob = new Blob([JSON.stringify({ format: 1, exportedAt: new Date().toISOString(), userAgent: navigator.userAgent, enabled, entries }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'comicbook-ai-diagnostics.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
