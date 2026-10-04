import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import ts from "typescript";

// Compile only the local domain modules; no app, browser or manuscript fixture is needed.
const temporary = mkdtempSync(join(tmpdir(), "comicbook-adaptation-"));
globalThis.crypto ??= { randomUUID };
const files = ["adaptation/extract", "adaptation/repair", "adaptation/panelize", "adaptation/aiBeats", "localAi", "project", "stylesLibrary"];
for (const file of files) {
  const source = readFileSync(new URL("../src/" + file + ".ts", import.meta.url), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const output = result.outputText.replace(/from "(\.[^"]+)"/g, 'from "$1.mjs"');
  const target = join(temporary, file + ".mjs");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, output);
}
try {
  const { createAdaptation, buildSequences } = await import(pathToFileURL(join(temporary, "adaptation/extract.mjs")));
  const { panelize } = await import(pathToFileURL(join(temporary, "adaptation/panelize.mjs")));
  const { repairLegacyAdaptation, repairSequenceBeatIds } = await import(pathToFileURL(join(temporary, "adaptation/repair.mjs")));
  const { readProjects, saveProjects, createProject } = await import(pathToFileURL(join(temporary, "project.mjs")));
  const { BUILTIN_STYLES } = await import(pathToFileURL(join(temporary, "stylesLibrary.mjs")));
  const source = 'A detective arrived at the gate.\n\nHer husband carried the evidence.\n\n"Keep the letter," she said.\n\nHolmes examined the footprints.';
  const first = createAdaptation("Case", source);
  const again = createAdaptation("Case", source, first);
  assert.deepEqual(again.beats.map(b => b.id), first.beats.map(b => b.id));
  assert.deepEqual(again.sequences.flatMap(s => s.beatIds), again.beats.map(b => b.id));
  assert.ok(panelize(again.beats, again.sequences).length > 0);
  console.log("PASS: repeated extraction preserves IDs and creates panels");

  const repeated = createAdaptation("Repeated", "The gate was shut.\n\nThe gate was shut.");
  const repeatedAgain = createAdaptation("Repeated", repeated.sourceText, repeated);
  assert.equal(new Set(repeatedAgain.beats.map(b => b.id)).size, 2);
  assert.deepEqual(repeatedAgain.beats.map(b => b.id), repeated.beats.map(b => b.id));
  console.log("PASS: repeated paragraphs retain distinct stable IDs");

  const changed = createAdaptation("Case", source + "\n\nA new clue appeared.", again);
  assert.deepEqual(changed.beats.slice(0, again.beats.length).map(b => b.id), again.beats.map(b => b.id));
  assert.ok(changed.sequences.every(s => s.beatIds.every(id => changed.beats.some(b => b.id === id))));
  console.log("PASS: edited manuscript maintains valid references");

  for (const text of [source, "Det finns ett samband.\n\nPolisen undersöker bevisen.", "Music played.\n\nThey danced together."]) {
    const adaptation = createAdaptation("Other story", text);
    assert.ok(adaptation.sequences.every(s => s.title !== "The dance" && s.density !== "cinematic"));
    assert.ok(adaptation.sequences[0].title.includes(text.split(".")[0]));
  }
  const actionBeats = first.beats.map(b => ({ ...b, beatType: "action" }));
  const withHusband = buildSequences(actionBeats);
  const withoutHusband = buildSequences(actionBeats.map(b => ({ ...b, sourceTextExcerpt: b.sourceTextExcerpt.replace("husband", "partner") })));
  assert.deepEqual(withHusband.map(s => s.beatIds), withoutHusband.map(s => s.beatIds));
  console.log("PASS: titles use current text; dance keywords and substrings do not control grouping or pacing");

  const legacy = structuredClone(first);
  const bogusIds = new Map(first.beats.map((b, i) => [b.id, "buggy-" + i]));
  legacy.sequences = legacy.sequences.map(s => ({ ...s, title: "The dance", density: "cinematic", preferredPanelCount: 7, beatIds: s.beatIds.map(id => bogusIds.get(id)) }));
  legacy.panelPlans = [{ id: "existing-panel", sourceBeatIds: [first.beats[0].id] }];
  legacy.imagePrompts = [{ id: "existing-prompt" }];
  const original = structuredClone(legacy);
  const repaired = repairLegacyAdaptation(legacy);
  assert.deepEqual(repaired.sequences.flatMap(s => s.beatIds), first.beats.map(b => b.id));
  assert.ok(repaired.sequences.every(s => s.title !== "The dance" && s.preferredPanelCount === 7 && s.density === "cinematic"));
  assert.deepEqual(repaired.panelPlans, legacy.panelPlans);
  assert.deepEqual(repaired.imagePrompts, legacy.imagePrompts);
  assert.deepEqual(legacy, original);
  assert.deepEqual(repairLegacyAdaptation(repaired), repaired);
  assert.ok(panelize(legacy.beats, legacy.sequences).length > 0);
  console.log("PASS: saved legacy references recover without losing settings, plans, prompts or mutating input");

  const partiallyBroken = structuredClone(first.sequences);
  partiallyBroken[0].beatIds[0] = "stale";
  assert.deepEqual(repairSequenceBeatIds(first.beats, partiallyBroken).flatMap(s => s.beatIds), first.beats.map(b => b.id));
  const ambiguous = [{ ...first.sequences[0], beatIds: ["missing", "missing"] }];
  assert.deepEqual(repairSequenceBeatIds(first.beats, ambiguous), ambiguous);
  const custom = repairLegacyAdaptation({ ...first, sequences: first.sequences.map(s => ({ ...s, title: "My custom title" })) });
  assert.ok(custom.sequences.every(s => s.title === "My custom title"));
  console.log("PASS: partial legacy references recover; ambiguous data and custom titles remain unchanged");

  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const project = createProject("Saved", "blank", BUILTIN_STYLES[0]);
  project.adaptations = [legacy];
  project.pages = [{ id: "page", number: 1, gridColumns: 3, gridRows: 5, placements: [{ id: "placement", x: 0, y: 0, width: 1, height: 1, readingOrder: 1, overlays: [], image: { name: "image", dataUrl: "data:image/png;base64,example", zoom: 2, offsetX: 10, offsetY: 20, fit: "contain" } }] }];
  saveProjects([project]);
  const loaded = readProjects()[0];
  assert.ok(loaded.adaptations[0].sequences.every(s => s.title !== "The dance"));
  assert.deepEqual(loaded.pages[0].placements[0].image, project.pages[0].placements[0].image);
  assert.ok(panelize(loaded.adaptations[0].beats, loaded.adaptations[0].sequences).length > 0);
  console.log("PASS: normal project loading repairs legacy adaptation and preserves page images");

  const local = await import(pathToFileURL(join(temporary, "localAi.mjs")));
  const ai = await import(pathToFileURL(join(temporary, "adaptation/aiBeats.mjs")));
  const settings = local.defaultLocalAiSettings();
  settings.servers.ollama.model = "story-model:latest";
  local.saveLocalAiSettings(settings);
  assert.deepEqual(local.readLocalAiSettings(), settings);
  assert.ok(storage.has("comicbook-ai.local-text-ai"));
  assert.ok(![...storage.keys()].some(key => key.startsWith("storybook")));
  assert.equal(local.normalizeLocalBaseUrl(" http://localhost:11434/ "), "http://localhost:11434");
  for (const url of ["http://192.168.1.20:1234", "http://10.0.0.2:8000/v1", "http://[::1]:11434", "http://ai-server.local:1234"]) {
    assert.ok(local.normalizeLocalBaseUrl(url));
  }
  for (const url of ["https://api.openai.com", "https://example.com", "file:///tmp/server", "http://user:secret@localhost:1234"]) {
    assert.throws(() => local.normalizeLocalBaseUrl(url));
  }
  const requests = [];
  const response = payload => new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
  const mock = async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith("/api/tags")) return response({ models: [{ name: "z:latest" }, { name: "a:latest" }, { name: "z:latest" }] });
    if (url.endsWith("/v1/models")) return response({ data: [{ id: "studio-model" }] });
    if (url.endsWith("/api/show")) return response({ model_info: { "llama.context_length": 32768 } });
    if (url.endsWith("/api/chat")) return response({ message: { content: '{"beats":[]}' }, done_reason: "stop" });
    return response({ choices: [{ message: { content: '{"beats":[]}' }, finish_reason: "stop" }] });
  };
  assert.deepEqual(await local.listLocalModels(settings, undefined, mock), ["a:latest", "z:latest"]);
  assert.equal(local.pickListedModel("z", ["a:latest", "z:latest"]), "z:latest");
  assert.equal(await local.getLocalModelContextLength(settings, undefined, mock), 32768);
  await local.completeLocalChat(settings, [{ role: "user", content: "test" }], undefined, mock);
  let body = JSON.parse(requests.at(-1).init.body);
  assert.equal(body.model, "story-model:latest");
  assert.equal(body.options.num_ctx, 8192);
  assert.equal(body.format, "json");
  settings.engine = "openai-compatible";
  settings.servers["openai-compatible"] = { baseUrl: "http://localhost:1234/v1/", model: "studio-model" };
  assert.deepEqual(await local.listLocalModels(settings, undefined, mock), ["studio-model"]);
  assert.equal(requests.at(-1).url, "http://localhost:1234/v1/models");
  await local.completeLocalChat(settings, [{ role: "user", content: "test" }], undefined, mock);
  assert.equal(requests.at(-1).url, "http://localhost:1234/v1/chat/completions");
  body = JSON.parse(requests.at(-1).init.body);
  assert.equal(body.model, "studio-model"); assert.equal(body.stream, false); assert.ok(body.max_tokens > 0);
  await assert.rejects(local.listLocalModels(settings, undefined, async () => response({})));
  await assert.rejects(local.completeLocalChat(settings, [], undefined, async () => new Response("failed", { status: 503 })));
  await assert.rejects(local.completeLocalChat(settings, [], undefined, async () => response({ choices: [{ finish_reason: "length", message: { content: "{}" } }] })));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(local.listLocalModels(settings, abort.signal, async (_url, init) => { init.signal.throwIfAborted(); }));
  console.log("PASS: both local transports, model listing, context, storage isolation, failures and cancellation");

  const excerpt = 'Holmes opened the gate. "Wait here," he said.';
  const beatReply = JSON.stringify({ beats: [{
    title: "At the gate", summary: "Holmes opens the gate.", beatType: "action", sourceTextExcerpt: excerpt,
    visualDescription: "Holmes stands at the open gate.", dialogue: ["Wait here,"], captions: [], characters: ["Holmes"], location: "Gate"
  }] });
  const beatContext = { characters: [{ id: "holmes", name: "Holmes" }], locations: [{ id: "gate", name: "Gate" }] };
  const proposals = ai.parseAiBeats(beatReply, excerpt, beatContext, 50);
  assert.equal(proposals[0].sourceStart, 50); assert.equal(proposals[0].sourceEnd, 50 + excerpt.length);
  assert.deepEqual(proposals[0].characterIds, ["holmes"]); assert.equal(proposals[0].locationId, "gate");
  assert.equal(proposals[0].dialogueCandidates[0].source, "original");
  assert.equal(proposals[0].origin, "ai-generated");
  assert.throws(() => ai.parseAiBeats(beatReply.replace("Wait here,", "Invented dialogue"), excerpt, beatContext));
  assert.throws(() => ai.parseAiBeats(beatReply, "An unrelated scene.", beatContext));
  assert.throws(() => ai.parseAiBeats("not json", excerpt, beatContext));
  assert.throws(() => ai.parseAiBeats('{"beats":[]}', excerpt, beatContext));
  const longSource = (excerpt + "\n\n").repeat(150);
  const chunks = ai.splitBeatSource(longSource, 8192);
  assert.equal(chunks.map(chunk => chunk.text).join(""), longSource);
  assert.ok(chunks.length > 1 && chunks.every(chunk => chunk.text.length <= 2469));
  const frozenPlan = structuredClone(first);
  const accepted = ai.adaptationFromAiBeats("AI", source, proposals, first);
  assert.deepEqual(first, frozenPlan); assert.equal(accepted.id, first.id);
  assert.ok(accepted.sequences.every(sequence => sequence.beatIds.every(id => accepted.beats.some(beat => beat.id === id))));
  assert.ok(panelize(accepted.beats, accepted.sequences).length > 0);
  const progress = [];
  const suggested = await ai.suggestAiBeats({ source: excerpt, sourceOffset: 50, context: beatContext, settings,
    fetchImpl: async (_url, init) => {
      assert.equal(JSON.parse(JSON.parse(init.body).messages[1].content).manuscript, excerpt);
      return response({ choices: [{ message: { content: beatReply }, finish_reason: "stop" }] });
    }, onProgress: (done, total) => progress.push([done, total]) });
  assert.equal(suggested[0].sourceStart, 50); assert.deepEqual(progress, [[0, 1], [1, 1]]);
  await assert.rejects(ai.suggestAiBeats({ source: excerpt, context: beatContext, settings, signal: abort.signal }));
  console.log("PASS: AI proposals preserve source/dialogue, reject hallucinated sources, split long manuscripts, and apply only validated beats");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
