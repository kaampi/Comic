import { useEffect, useId, useRef, useState } from "react";
import { clampContextWindow, getLocalModelContextLength, listLocalModels, MAX_CONTEXT_WINDOW, MIN_CONTEXT_WINDOW, normalizeLocalBaseUrl, pickListedModel, type LocalAiEngine, type LocalAiSettings as Settings } from "./localAi";
import { localAiText } from "./localAiText";
import type { Locale } from "./settings";

export function LocalAiSettings({ settings, locale, onChange }: { settings: Settings; locale: Locale; onChange: (settings: Settings) => void }) {
  const t = localAiText(locale);
  const id = useId();
  const latestSettings = useRef(settings); latestSettings.current = settings;
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [contextDraft, setContextDraft] = useState(String(settings.contextWindow));
  const controller = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const server = settings.servers[settings.engine];
  const connection = server.connection ?? "computer";
  let addressError = "";
  try { normalizeLocalBaseUrl(server.baseUrl, connection); }
  catch { addressError = connection === "network" ? t.networkAddressError : t.computerAddressError; }
  useEffect(() => setContextDraft(String(settings.contextWindow)), [settings.contextWindow]);
  useEffect(() => {
    ++requestNumber.current;
    controller.current?.abort();
    setModels([]); setBusy(false); setStatus(""); setError("");
    return () => { ++requestNumber.current; controller.current?.abort(); };
  }, [settings.engine, server.baseUrl, connection]);
  const updateServer = (patch: Partial<typeof server>) => {
    const current = latestSettings.current;
    onChange({...current, servers: {...current.servers, [current.engine]: {...current.servers[current.engine], ...patch}}});
  };
  const run = async (kind: "models" | "context") => {
    controller.current?.abort();
    const request = ++requestNumber.current;
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 15000);
    setBusy(true); setError(""); setStatus("");
    try {
      if (kind === "models") {
        const names = await listLocalModels(settings, abort.signal);
        if (request !== requestNumber.current) return;
        setModels(names);
        const selected = pickListedModel(server.model, names) ?? "";
        updateServer({ model: selected });
        setStatus(names.length ? t.connected + " · " + names.length : t.noModels);
      } else {
        const size = await getLocalModelContextLength(settings, abort.signal);
        if (request !== requestNumber.current) return;
        if (size) {
          onChange({ ...latestSettings.current, contextWindow: clampContextWindow(size) });
          setStatus(t.contextLimit + ": " + size);
        } else setStatus(t.unknownContext);
      }
    } catch (err) {
      if (request === requestNumber.current) setError(err instanceof TypeError ? t.connectionFailed : err instanceof Error ? err.message : String(err));
    } finally {
      window.clearTimeout(timeout);
      if (request === requestNumber.current) setBusy(false);
    }
  };
  const changeConnection = (value: "computer" | "network") => {
    let baseUrl = server.baseUrl;
    try { normalizeLocalBaseUrl(baseUrl, value); }
    catch { baseUrl = value === "computer" ? (settings.engine === "ollama" ? "http://localhost:11434" : "http://localhost:1234") : ""; }
    updateServer({ connection: value, baseUrl, model: "" });
  };
  return <section className="local-ai-settings">
    <h3>{t.title}</h3><p className="quiet">{t.intro}</p>
    <fieldset className="local-ai-connection" aria-describedby={id + "-privacy"}>
      <legend>{t.connection}</legend>
      <label><input type="radio" name={id + "-connection"} value="computer" checked={connection === "computer"} onChange={() => changeConnection("computer")} />{t.computer}</label>
      <label><input type="radio" name={id + "-connection"} value="network" checked={connection === "network"} onChange={() => changeConnection("network")} />{t.network}</label>
    </fieldset>
    <p className="local-ai-privacy" id={id + "-privacy"}>{connection === "network" ? t.networkPrivacy : t.computerPrivacy}</p>
    <div className="local-ai-fields">
      <label>{t.engine}<select value={settings.engine} disabled={busy} onChange={e => onChange({ ...settings, engine: e.target.value as LocalAiEngine })}>
        <option value="ollama">Ollama</option><option value="openai-compatible">LM Studio / llama.cpp (OpenAI-compatible)</option>
      </select></label>
      <label>{t.url}<input type="url" value={server.baseUrl} aria-invalid={Boolean(server.baseUrl.trim() && addressError)} aria-describedby={server.baseUrl.trim() && addressError ? id + "-address-error" : undefined} onChange={e => updateServer({ baseUrl: e.target.value, model: "" })} placeholder={connection === "network" ? (settings.engine === "ollama" ? "http://192.168.1.20:11434" : "http://192.168.1.20:1234") : (settings.engine === "ollama" ? "http://localhost:11434" : "http://localhost:1234")} /></label>
      <button className="primary-button" type="button" disabled={busy || Boolean(addressError)} onClick={() => void run("models")}>{busy ? t.connecting : t.refresh}</button>
      {server.baseUrl.trim() && addressError ? <p className="import-error" role="alert" id={id + "-address-error"}>{addressError}</p> : null}
      <label>{t.model}<select value={server.model} disabled={busy || !models.length} onChange={e => updateServer({ model: e.target.value })}>
        {!models.includes(server.model) ? <option value={server.model}>{server.model || t.noModels}</option> : null}
        {models.map(name => <option key={name} value={name}>{name}</option>)}
      </select></label>
      <label>{t.context}<input type="number" min={MIN_CONTEXT_WINDOW} max={MAX_CONTEXT_WINDOW} value={contextDraft} disabled={busy}
        onChange={e => setContextDraft(e.target.value)} onBlur={() => {
          const size = clampContextWindow(contextDraft.trim() ? Number(contextDraft) : settings.contextWindow);
          setContextDraft(String(size)); onChange({ ...settings, contextWindow: size });
        }} /></label>
      {settings.engine === "ollama" ? <button className="text-button" type="button" disabled={busy || !server.model || Boolean(addressError)} onClick={() => void run("context")}>{t.suggestContext}</button> : null}
    </div>
    {status ? <p role="status">{status}</p> : null}
    {error ? <p className="import-error" role="alert">{error}</p> : null}
    {connection === "network" ? <p className="quiet">{t.networkSetup}</p> : null}
    <p className="quiet">{t.contextHelp}</p><p className="quiet">{t.localHelp}</p><p className="quiet">{t.connectionHelp}</p>
  </section>;
}
