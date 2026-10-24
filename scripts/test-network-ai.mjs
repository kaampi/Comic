import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".network-ai-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
symlinkSync(join(root, "node_modules"), join(temporary, "node_modules"), process.platform === "win32" ? "junction" : "dir");
const response = data => new Response(JSON.stringify(data));
try {
  for (const name of ["localAi.ts", "aiPrompts.ts", "localAiText.ts", "settings.ts", "LocalAiSettings.tsx"]) {
    const output = ts.transpileModule(readFileSync(join(root, "src", name), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
    }).outputText.replace(/from "(\.[^"]+)"/g, 'from "$1.mjs"');
    writeFileSync(join(temporary, name.replace(/\.tsx?$/, ".mjs")), output);
  }
  const ai = await import(pathToFileURL(join(temporary, "localAi.mjs")));
  const loopbacks = ["http://localhost:11434", "http://127.0.0.1:1234/v1/", "http://127.5.6.7:8000", "http://[::1]:1234"];
  const privateAddresses = ["http://10.0.0.2:11434", "https://172.16.0.1:8000", "http://172.31.255.254:1234/v1", "http://192.168.1.20:1234", "http://[fc00::1]:1234", "http://[fd12:3456::2]:1234", "http://[fe80::1234]:1234", "http://[febf::1]:1234"];
  for (const url of loopbacks) {
    assert.ok(ai.normalizeLocalBaseUrl(url, "computer"));
    assert.throws(() => ai.normalizeLocalBaseUrl(url, "network"));
  }
  for (const url of privateAddresses) {
    assert.ok(ai.normalizeLocalBaseUrl(url, "network"));
    assert.throws(() => ai.normalizeLocalBaseUrl(url, "computer"));
  }
  const blocked = ["https://api.openai.com", "http://8.8.8.8", "http://172.15.1.2", "http://172.32.0.1", "http://192.169.0.1", "http://0.0.0.0", "http://169.254.1.1", "http://100.64.0.1", "http://[2001:4860:4860::8888]", "http://[fec0::1]", "http://[::ffff:192.168.1.20]", "http://ai-server.local", "http://ai-server.lan", "http://ai-server", "http://localhost.example.com", "http://192.168.1.20.example.com", "http://user:secret@192.168.1.20:1234", "http://192.168.1.20/?token=secret", "http://192.168.1.20/#fragment", "http://192.168.1.20/?", "http://192.168.1.20/#", "ftp://192.168.1.20", "file:///tmp/server", "not a url"];
  for (const url of blocked) {
    for (const mode of ["computer", "network", undefined]) assert.throws(() => ai.normalizeLocalBaseUrl(url, mode), url);
  }
  // Existing settings stay local by default; older private-IP configurations retain their destination.
  localStorage.clear();
  assert.equal(ai.readLocalAiSettings().servers.ollama.connection, "computer");
  const legacy = ai.defaultLocalAiSettings();
  delete legacy.servers.ollama.connection;
  legacy.servers.ollama.baseUrl = "http://192.168.1.20:11434";
  legacy.servers.ollama.model = "old-model";
  localStorage.setItem(ai.LOCAL_AI_KEY, JSON.stringify(legacy));
  let settings = ai.readLocalAiSettings();
  assert.equal(settings.servers.ollama.connection, "network");
  assert.equal(settings.servers.ollama.model, "old-model");
  assert.equal(settings.servers["openai-compatible"].connection, "computer");
  ai.saveLocalAiSettings(settings);
  assert.deepEqual(ai.readLocalAiSettings(), settings);
  let calls = [];
  const mock = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/api/tags")) return response({ models: [{ name: "network-model" }] });
    if (url.endsWith("/models")) return response({ data: [{ id: "network-model" }] });
    if (url.endsWith("/api/show")) return response({ model_info: { "llama.context_length": 16384 } });
    return response(settings.engine === "ollama" ? { message: { content: "{}" } } : { choices: [{ message: { content: "{}" } }] });
  };
  for (const engine of ["ollama", "openai-compatible"]) {
    settings.engine = engine;
    settings.servers[engine] = { baseUrl: "http://192.168.1.20:1234" + (engine === "ollama" ? "" : "/v1/"), model: "network-model", connection: "network" };
    await ai.listLocalModels(settings, undefined, mock);
    assert.equal(calls.at(-1).init.method, "GET");
    assert.equal(calls.at(-1).init.body, undefined, "connection check sends no manuscript");
    assert.equal(calls.at(-1).url, "http://192.168.1.20:1234" + (engine === "ollama" ? "/api/tags" : "/v1/models"));
    await ai.completeLocalChat(settings, [{ role: "user", content: "Synthetic test passage" }], undefined, mock);
    assert.equal(calls.at(-1).url, "http://192.168.1.20:1234" + (engine === "ollama" ? "/api/chat" : "/v1/chat/completions"));
    assert.equal(JSON.parse(calls.at(-1).init.body).messages[0].content, "Synthetic test passage");
    if (engine === "ollama") assert.equal(await ai.getLocalModelContextLength(settings, undefined, mock), 16384);
    for (const url of blocked) {
      settings.servers[engine].baseUrl = url;
      const before = calls.length;
      await assert.rejects(ai.listLocalModels(settings, undefined, mock));
      await assert.rejects(ai.completeLocalChat(settings, [{ role: "user", content: "Synthetic test passage" }], undefined, mock));
      if (engine === "ollama") await assert.rejects(ai.getLocalModelContextLength(settings, undefined, mock));
      assert.equal(calls.length, before, "invalid destination is rejected before fetch: " + url);
    }
  }
  for (const { init } of calls) {
    assert.equal(init.redirect, "error", "redirects cannot send text to another destination");
    assert.equal(init.credentials, "omit");
    assert.equal(init.referrerPolicy, "no-referrer");
  }
  settings = ai.defaultLocalAiSettings();
  settings.servers.ollama.baseUrl = "http://192.168.1.20:11434";
  await assert.rejects(ai.listLocalModels(settings, undefined, mock), /this computer/);
  // Test the actual UI: changing settings does no network I/O; an explicit check only fetches models.
  const React = await import("react");
  const { render, screen, fireEvent, cleanup, waitFor, act } = await import("@testing-library/react");
  const { LocalAiSettings } = await import(pathToFileURL(join(temporary, "LocalAiSettings.mjs")));
  let current;
  function Harness() {
    const [value, setValue] = React.useState(ai.defaultLocalAiSettings());
    current = value;
    return React.createElement(LocalAiSettings, { settings: value, locale: "sv", onChange: next => { ai.saveLocalAiSettings(next); setValue(next); } });
  }
  calls = [];
  let finish;
  globalThis.fetch = (url, init) => { calls.push({ url, init }); return new Promise(resolve => { finish = resolve; }); };
  render(React.createElement(Harness));
  assert.equal(screen.getByRole("radio", { name: "Den här datorn" }).checked, true);
  fireEvent.click(screen.getByRole("radio", { name: "Egen server i nätverket" }));
  assert.ok(screen.getByText(/När du startar en analys skickas texten/));
  const address = () => screen.getByRole("textbox", { name: "Serveradress" });
  const connect = () => screen.getByRole("button", { name: "Anslut / uppdatera modeller" });
  assert.equal(connect().disabled, true);
  fireEvent.change(address(), { target: { value: "https://api.openai.com" } });
  assert.equal(address().getAttribute("aria-invalid"), "true");
  assert.equal(connect().disabled, true);
  fireEvent.change(address(), { target: { value: "http://192.168.1.20:11434" } });
  assert.equal(connect().disabled, false);
  assert.equal(calls.length, 0);
  fireEvent.click(connect());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.body, undefined);
  const firstSignal = calls[0].init.signal;
  const oldFinish = finish;
  fireEvent.click(screen.getByRole("radio", { name: "Den här datorn" }));
  assert.equal(firstSignal.aborted, true);
  await act(async () => oldFinish(response({ models: [{ name: "stale-network-model" }] })));
  assert.equal(current.servers.ollama.model, "");
  assert.equal(screen.queryByRole("status"), null);
  assert.equal(address().value, "http://localhost:11434");
  fireEvent.click(screen.getByRole("radio", { name: "Egen server i nätverket" }));
  fireEvent.change(address(), { target: { value: "http://192.168.1.20:11434" } });
  fireEvent.click(connect());
  await act(async () => finish(response({ models: [{ name: "network-model" }] })));
  await waitFor(() => assert.equal(screen.getByLabelText("Modell för adaptering").value, "network-model"));
  assert.equal(ai.readLocalAiSettings().servers.ollama.connection, "network");
  assert.equal(ai.readLocalAiSettings().servers.ollama.model, "network-model");
  fireEvent.change(address(), { target: { value: "http://192.168.1.21:11434" } });
  assert.equal(current.servers.ollama.model, "", "a model from the old server cannot be reused silently");
  assert.equal(calls.length, 2);
  cleanup();
  console.log("PASS: explicit local/network choices, private IPv4/IPv6, blocked public/DNS/credential destinations before fetch, migration/persistence, both transports, manuscript-free checks, redirect policy and stale-request cancellation.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
  dom.window.close();
}
