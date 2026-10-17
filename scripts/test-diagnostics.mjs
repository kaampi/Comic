import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const temporary = mkdtempSync(new URL('.diagnostics-test-', root));
const dom = new JSDOM('<input type="text"><input type="color"><textarea></textarea>', { url: 'http://localhost:5176/' });
for (const key of ['window', 'document', 'localStorage', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
try {
  const file = join(temporary, 'diagnostics.mjs');
  writeFileSync(file, ts.transpileModule(readFileSync(new URL('src/diagnostics.ts', root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const log = await import(pathToFileURL(file));
  log.installDiagnostics(); log.installDiagnostics();
  log.recordDiagnostic('disabled');
  assert.equal(localStorage.getItem('comicbook-ai.diagnostics.log'), null);
  log.setDiagnosticsEnabled(true);
  for (let i = 0; i < 600; i++) log.recordDiagnostic('save-complete', { bytes: 123, durationMs: 40 });
  const input = document.querySelector('input');
  input.value = 'PRIVATE MANUSCRIPT'; input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  document.querySelector('input[type=color]').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  window.dispatchEvent(new dom.window.ErrorEvent('error', { error: new TypeError('PRIVATE API KEY'), message: 'PRIVATE API KEY', lineno: 12, colno: 3 }));
  const rejection = new dom.window.Event('unhandledrejection');
  Object.defineProperty(rejection, 'reason', { value: { name: 'PRIVATE NAME', message: 'PRIVATE TEXT' } });
  window.dispatchEvent(rejection);
  window.dispatchEvent(new dom.window.Event('pagehide'));
  const persisted = localStorage.getItem('comicbook-ai.diagnostics.log');
  const entries = JSON.parse(persisted);
  assert.equal(entries.length, 160);
  assert.ok(persisted.length < 50000);
  assert.ok(!persisted.includes('PRIVATE'));
  assert.equal(entries.find(entry => entry.event === 'javascript-error').data.name, 'TypeError');
  assert.equal(entries.find(entry => entry.event === 'promise-error').data.name, 'OtherError');
  const activity = entries.find(entry => entry.event === 'activity');
  assert.equal(activity.data.textInputs, 1); assert.equal(activity.data.colorInputs, 1);
  log.setDiagnosticsEnabled(false);
  const stopped = localStorage.getItem('comicbook-ai.diagnostics.log');
  log.recordDiagnostic('must-not-appear');
  window.dispatchEvent(new dom.window.Event('pagehide'));
  assert.equal(localStorage.getItem('comicbook-ai.diagnostics.log'), stopped);
  const originalSet = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.setItem = () => { throw new dom.window.DOMException('full', 'QuotaExceededError'); };
  assert.doesNotThrow(() => { log.setDiagnosticsEnabled(true); log.recordDiagnostic('save-error'); log.setDiagnosticsEnabled(false); });
  dom.window.Storage.prototype.setItem = originalSet;
  console.log('PASS: opt-in bounded diagnostics survive reload storage, redact error content, count input events, stop cleanly and tolerate full storage');
} finally {
  dom.window.close(); rmSync(temporary, { recursive: true, force: true });
}
