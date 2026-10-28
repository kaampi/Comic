import { normalizeBeatPrompt } from "./aiPrompts";
// Independent adaptation of kaampi Write's Ollama and OpenAI-compatible transports.
export type LocalAiEngine = "ollama" | "openai-compatible";
export type LocalAiSettings = {
  engine: LocalAiEngine;
  servers: Record<LocalAiEngine, { baseUrl: string; model: string }>;
  contextWindow: number;
  prompts?: { beats?: string };
};
export const LOCAL_AI_KEY = "comicbook-ai.local-text-ai";
export const DEFAULT_CONTEXT_WINDOW = 8192;
export const MIN_CONTEXT_WINDOW = 1024;
export const MAX_CONTEXT_WINDOW = 131072;
export const defaultLocalAiSettings = (): LocalAiSettings => ({
  engine: "ollama",
  servers: {
    ollama: { baseUrl: "http://localhost:11434", model: "" },
    "openai-compatible": { baseUrl: "http://localhost:1234", model: "" }
  },
  contextWindow: DEFAULT_CONTEXT_WINDOW
});
export function clampContextWindow(value: number): number {
  return Number.isFinite(value) ? Math.max(MIN_CONTEXT_WINDOW, Math.min(MAX_CONTEXT_WINDOW, Math.round(value))) : DEFAULT_CONTEXT_WINDOW;
}
export function readLocalAiSettings(): LocalAiSettings {
  const defaults = defaultLocalAiSettings();
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_AI_KEY) ?? "null");
    if (!stored) return defaults;
    for (const engine of ["ollama", "openai-compatible"] as const) {
      const server = stored.servers?.[engine];
      if (typeof server?.baseUrl === "string") defaults.servers[engine].baseUrl = server.baseUrl;
      if (typeof server?.model === "string") defaults.servers[engine].model = server.model;
    }
    const prompt = normalizeBeatPrompt(stored.prompts?.beats);
    if (prompt) defaults.prompts = { beats: prompt };
    defaults.engine = stored.engine === "openai-compatible" ? stored.engine : "ollama";
    defaults.contextWindow = clampContextWindow(stored.contextWindow);
  } catch {}
  return defaults;
}
export function saveLocalAiSettings(settings: LocalAiSettings): boolean {
  try { localStorage.setItem(LOCAL_AI_KEY, JSON.stringify(settings)); return true; } catch { return false; }
}
export function normalizeLocalBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Invalid local server URL."); }
  const host = url.hostname.toLowerCase();
  const octets = host.split(".").map(Number);
  const ipv4 = octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
  const privateIpv4 = ipv4 && (octets[0] === 127 || octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  const local = host === "localhost" || host.endsWith(".localhost") || host === "[::1]" ||
    /^\[(fc|fd|fe[89ab])[0-9a-f:]+\]$/.test(host) || privateIpv4 ||
    host.endsWith(".local") || host.endsWith(".lan") || /^[a-z][a-z0-9-]*$/.test(host);
  if (!local || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Use an HTTP(S) address on this computer or your local network.");
  }
  return url.href.replace(/\/+$/, "");
}
export function pickListedModel(preferred: string, names: string[]): string | undefined {
  if (names.includes(preferred)) return preferred;
  return names.find(name => name === preferred + ":latest" || name.startsWith(preferred + ":")) ?? names[0];
}
function endpoint(settings: LocalAiSettings, ollama: string, openai: string): string {
  const base = normalizeLocalBaseUrl(settings.servers[settings.engine].baseUrl);
  return settings.engine === "ollama" ? base + ollama : base.replace(/\/v1$/, "") + "/v1" + openai;
}
async function requestJson(url: string, init: RequestInit, fetchImpl = globalThis.fetch.bind(globalThis)): Promise<any> {
  const response = await fetchImpl(url, { ...init, redirect: "error" });
  if (!response.ok) throw new Error("Local AI: HTTP " + response.status + " " + response.statusText);
  const data = await response.json();
  if (typeof data?.error === "string") throw new Error("Local AI: " + data.error);
  return data;
}
export async function listLocalModels(settings: LocalAiSettings, signal?: AbortSignal, fetchImpl?: typeof fetch): Promise<string[]> {
  const data = await requestJson(endpoint(settings, "/api/tags", "/models"), { method: "GET", signal }, fetchImpl);
  const models = settings.engine === "ollama" ? data?.models : data?.data;
  if (!Array.isArray(models)) throw new Error("Local AI returned an invalid model list.");
  const names = models.map(entry => settings.engine === "ollama" ? entry?.name : entry?.id)
    .filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}
export async function getLocalModelContextLength(settings: LocalAiSettings, signal?: AbortSignal, fetchImpl?: typeof fetch): Promise<number | undefined> {
  if (settings.engine !== "ollama") return undefined;
  const data = await requestJson(endpoint(settings, "/api/show", ""), {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ model: settings.servers.ollama.model })
  }, fetchImpl);
  if (!data?.model_info || typeof data.model_info !== "object") return undefined;
  return Object.entries(data.model_info).find(([key, value]) => key.endsWith(".context_length") &&
    typeof value === "number" && Number.isFinite(value) && value > 0)?.[1] as number | undefined;
}
export type LocalChatDiagnostics = {
  requestBody: string; responseBody?: string; rawReply?: string;
  maxOutputTokens: number; contextWindow: number; finishReason?: string;
};
export async function completeLocalChat(settings: LocalAiSettings, messages: Array<{ role: "system" | "user"; content: string }>,
  signal?: AbortSignal, fetchImpl?: typeof fetch, onDiagnostics?: (value:LocalChatDiagnostics)=>void, responseSchema?:Record<string,unknown>): Promise<string> {
  const model = settings.servers[settings.engine].model;
  if (!model.trim()) throw new Error("Select a local text model first.");
  const maxTokens = Math.min(2048, Math.floor(settings.contextWindow * .35));
  const body = settings.engine === "ollama"
    ? { model, messages, stream: false, format: responseSchema??"json", options: { temperature: .2, num_predict: maxTokens, num_ctx: settings.contextWindow } }
    : { model, messages, stream: false, temperature: .2, max_tokens: maxTokens, ...(responseSchema?{response_format:{type:"json_schema",json_schema:{name:"scene_purpose_evidence",strict:true,schema:responseSchema}}}:{}) };
  const diagnostics:LocalChatDiagnostics={requestBody:JSON.stringify(body),maxOutputTokens:maxTokens,contextWindow:settings.contextWindow};
  onDiagnostics?.({...diagnostics});
  const data = await requestJson(endpoint(settings, "/api/chat", "/chat/completions"), {
    method: "POST", headers: { "Content-Type": "application/json" }, signal, body: JSON.stringify(body)
  }, fetchImpl);
  const rawReply=settings.engine==='ollama'?data?.message?.content:data?.choices?.[0]?.message?.content;
  const finishReason=settings.engine==='ollama'?data?.done_reason:data?.choices?.[0]?.finish_reason;
  onDiagnostics?.({...diagnostics,responseBody:JSON.stringify(data),...(typeof rawReply==='string'?{rawReply}:{}),...(typeof finishReason==='string'?{finishReason}:{})});
  if (data?.done_reason === "length" || data?.choices?.[0]?.finish_reason === "length" ||
      (settings.engine === "ollama" && typeof data?.eval_count === "number" && data.eval_count >= maxTokens)) {
    throw new Error("The model response was truncated at the output limit. Inspect AI diagnostics for repetition or excessive detail before changing context size.");
  }
  const content = settings.engine === "ollama" ? data?.message?.content : data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Local AI returned an empty reply.");
  return content;
}
