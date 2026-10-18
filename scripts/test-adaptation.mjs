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
const files = ["adaptation/extract", "adaptation/repair", "adaptation/panelize", "adaptation/aiBeats", "visualSceneAi", "localAi", "project", "projectSaveStatus", "stylesLibrary", "styleColorMode", "painterlyStyles", "manuscriptModel", "manuscriptChapters", "adaptation/prompts", "pageLayout", "overlayTypography", "pageFormat", "pageTypography", "pageBackground", "panelGeometry", "panelBorder", "panelShape"];
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
  assert.deepEqual(again.sequences, []);
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
    assert.deepEqual(adaptation.sequences, []);
  }
  const actionBeats = first.beats.map(b => ({ ...b, beatType: "action" }));
  const withHusband = buildSequences(actionBeats);
  const withoutHusband = buildSequences(actionBeats.map(b => ({ ...b, sourceTextExcerpt: b.sourceTextExcerpt.replace("husband", "partner") })));
  assert.deepEqual(withHusband.map(s => s.beatIds), withoutHusband.map(s => s.beatIds));
  console.log("PASS: titles use current text; dance keywords and substrings do not control grouping or pacing");

  const legacySequences = buildSequences(first.beats);
  const legacy = structuredClone({ ...first, sequences: legacySequences });
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

  const partiallyBroken = structuredClone(legacySequences);
  partiallyBroken[0].beatIds[0] = "stale";
  assert.deepEqual(repairSequenceBeatIds(first.beats, partiallyBroken).flatMap(s => s.beatIds), first.beats.map(b => b.id));
  const ambiguous = [{ ...legacySequences[0], beatIds: ["missing", "missing"] }];
  assert.deepEqual(repairSequenceBeatIds(first.beats, ambiguous), ambiguous);
  const custom = repairLegacyAdaptation({ ...first, sequences: legacySequences.map(s => ({ ...s, title: "My custom title" })) });
  assert.ok(custom.sequences.every(s => s.title === "My custom title"));
  console.log("PASS: partial legacy references recover; ambiguous data and custom titles remain unchanged");

  const { resizeFromCorner } = await import(pathToFileURL(join(temporary,"pageLayout.mjs")));
  const rect={x:1,y:1,width:2,height:2};
  assert.deepEqual(resizeFromCorner(rect,"bottom-right",2,3,6,8),{x:1,y:1,width:4,height:5});
  assert.deepEqual(resizeFromCorner(rect,"top-left",-1,-1,6,8),{x:0,y:0,width:3,height:3});
  assert.deepEqual(resizeFromCorner(rect,"top-right",1,-1,6,8),{x:1,y:0,width:3,height:3});
  assert.deepEqual(resizeFromCorner(rect,"bottom-left",-1,1,6,8),{x:0,y:1,width:3,height:3});
  assert.deepEqual(resizeFromCorner(rect,"bottom-right",100,100,6,8),{x:1,y:1,width:5,height:7});
  assert.deepEqual(resizeFromCorner(rect,"top-left",100,100,6,8),{x:2,y:2,width:1,height:1});
  assert.deepEqual(resizeFromCorner(rect,"bottom-right",.49,.51,6,8),{x:1,y:1,width:2,height:3});
  console.log("PASS: all corner directions snap to grid, preserve the opposite corner and clamp at page bounds/minimum size");
  const model = await import(pathToFileURL(join(temporary, "manuscriptModel.mjs")));
  let working = createProject("Manuscript", "text", BUILTIN_STYLES[0]);
  working.source.textSnapshot = 'Prelude.\n\n"Wait here," he said.\n\n"Wait here," he said.';
  const passage = '"Wait here," he said.';
  const start = working.source.textSnapshot.indexOf(passage);
  const result = model.addManualBeat(working, { start, end: start + passage.length });
  working = result.project;
  const secondStart = working.source.textSnapshot.lastIndexOf(passage);
  working = model.addManualBeat(working, { start: secondStart, end: secondStart + passage.length }).project;
  const firstBeatId = result.beatId;
  assert.equal(working.adaptations[0].beats.length, 2);
  assert.equal(working.adaptations[0].beats[0].sourceTextExcerpt, passage);
  assert.equal(working.adaptations[0].beats[1].sourceStart, secondStart);
  assert.deepEqual(working.adaptations[0].sequences, []);
  working = model.addBeatPanel(working, firstBeatId);
  const firstPlanId = working.adaptations[0].panelPlans[0].id;
  const projectedId = working.panels[0].id;
  working = model.addBeatPanel(working, firstBeatId);
  assert.equal(working.adaptations[0].panelPlans.length, 4);
  assert.equal(working.adaptations[0].panelPlans.at(-1).dialogue.length, 0);
  const image = { name: "panel.png", dataUrl: "data:image/png;base64,preserved" };
  working = model.patchBeatPanel(working, firstPlanId, { visualDescription: "Original direction", image });
  working = model.generateBeatPanelPrompt(working, firstPlanId);
  const promptId = working.adaptations[0].imagePrompts[0].id;
  working = model.generateBeatPanelPrompt(working, firstPlanId);
  assert.equal(working.adaptations[0].imagePrompts[0].id, promptId);
  assert.ok(working.adaptations[0].imagePrompts[0].prompt.includes("Original direction"));
  assert.equal(working.panels[0].id, projectedId);
  const originalPlans = structuredClone(working.adaptations[0].panelPlans);
  working = model.editManuscript(working, "New opening.\n" + working.source.textSnapshot);
  assert.equal(working.adaptations[0].beats[0].sourceStart, start + "New opening.\n".length);
  assert.equal(working.adaptations[0].beats[0].sourceNeedsReview, undefined);
  assert.deepEqual(working.adaptations[0].panelPlans, originalPlans);
  working = model.editManuscript(working, working.source.textSnapshot.replace('Wait here,', 'Stay here,'));
  assert.equal(working.adaptations[0].beats[0].sourceNeedsReview, true);
  assert.equal(working.adaptations[0].beats[1].sourceNeedsReview, undefined);
  assert.equal(working.adaptations[0].panelPlans[0].sourceNeedsReview, true);
  assert.deepEqual(working.adaptations[0].panelPlans[0].image, image);
  assert.equal(working.adaptations[0].panelPlans[0].visualDescription, "Original direction");
  assert.equal(working.adaptations[0].beats[0].sourceTextExcerpt, passage);
  const changedBeat = working.adaptations[0].beats[0];
  working = model.editManuscript(working, working.source.textSnapshot.slice(0, changedBeat.sourceStart) + working.source.textSnapshot.slice(changedBeat.sourceEnd));
  assert.equal(working.adaptations[0].beats[0].sourceStart, working.adaptations[0].beats[0].sourceEnd);
  assert.equal(working.adaptations[0].beats[0].id, firstBeatId);
  const planIds = working.adaptations[0].panelPlans.map(p => p.id);
  working = model.appendAiBeats(working, [{ ...working.adaptations[0].beats[1], id: "new-ai-beat", summary: "AI summary" }]);
  assert.equal(working.adaptations[0].beats.length, 3);
  assert.deepEqual(working.adaptations[0].panelPlans.slice(0,planIds.length).map(p => p.id), planIds);
  assert.equal(working.adaptations[0].panelPlans.length,planIds.length+1);
  assert.equal(model.ensureBeatPanels(working),working);
  working.panels[0] = {...working.panels[0],action:"Edited in panel workspace"};
  working.scenes[0] = {...working.scenes[0],title:"Custom scene",panelIds:[working.panels[1].id,working.panels[0].id,...working.panels.slice(2).map(p=>p.id)]};
  working = model.patchManuscriptBeat(working, firstBeatId, {title:"New beat title"});
  assert.equal(working.panels[0].action,"Edited in panel workspace");
  assert.equal(working.scenes[0].title,"Custom scene");
  assert.deepEqual(working.scenes[0].panelIds,[working.panels[1].id,working.panels[0].id,...working.panels.slice(2).map(p=>p.id)]);
  working = model.patchBeatPanel(working, firstPlanId, {visualDescription:"Explicitly revised direction"});
  assert.equal(working.panels[0].action,"Explicitly revised direction");
  const replacementImage = { name: "new.png", dataUrl: "data:image/png;base64,replacement" };
  working = model.patchBeatPanel(working, firstPlanId, { image: replacementImage });
  assert.deepEqual(working.adaptations[0].panelPlans[0].imageVersions, [image]);
  working = model.patchBeatPanel(working, firstPlanId, { image });
  assert.deepEqual(working.adaptations[0].panelPlans[0].imageVersions, [replacementImage]);
  assert.deepEqual(working.adaptations[0].panelPlans[0].image, image);
  const manuallyPlaced = { name: "manual.png", dataUrl: "data:image/png;base64,manual" };
  working.pages = [{ id: "page", number: 1, gridColumns: 3, gridRows: 5, placements: [
    { id: "empty", panelId: projectedId, readingOrder: 1, x: 0, y: 0, width: 1, height: 1, overlays: [] },
    { id: "manual", adaptationPanelPlanId: firstPlanId, readingOrder: 2, x: 1, y: 0, width: 1, height: 1, overlays: [], image: manuallyPlaced }
  ] }];
  working = model.withAdaptation(working, working.adaptations[0]);
  assert.deepEqual(working.pages[0].placements[0].image, image);
  assert.deepEqual(working.pages[0].placements[1].image, manuallyPlaced);
  const legacyAnchors = model.anchorBeats('Same. Same.', [
    { ...working.adaptations[0].beats[0], sourceTextExcerpt: 'Same.', sourceStart: undefined, sourceEnd: undefined, sourceNeedsReview: undefined },
    { ...working.adaptations[0].beats[1], sourceTextExcerpt: 'Same.', sourceStart: undefined, sourceEnd: undefined }
  ]);
  assert.deepEqual(legacyAnchors.map(b => b.sourceStart), [0, 6]);
  assert.throws(() => model.addManualBeat(working, { start: 0, end: 0 }));
  console.log("PASS: manuscript selections, repeated anchors, source edits/deletion, stable multi-panel prompts/images, additive AI beats and page image preservation");

  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const project = createProject("Saved", "blank", BUILTIN_STYLES[0]);
  project.adaptations = [legacy];
  project.pages = [{ id: "page", number: 1, gridColumns: 3, gridRows: 5, placements: [{ id: "placement", x: 0, y: 0, width: 1, height: 1, readingOrder: 1, overlays: [], image: { name: "image", dataUrl: "data:image/png;base64,example", zoom: 2, offsetX: 10, offsetY: 20, fit: "contain" } }] }];
  assert.equal(saveProjects([project]), true);
  const loaded = readProjects()[0];
  assert.ok(loaded.adaptations[0].sequences.every(s => s.title !== "The dance"));
  assert.deepEqual(loaded.pages[0].placements[0].image, project.pages[0].placements[0].image);
  assert.ok(panelize(loaded.adaptations[0].beats, loaded.adaptations[0].sequences).length > 0);
  const validStorage = globalThis.localStorage;
  globalThis.localStorage = { ...validStorage, setItem() { throw new Error("Quota exceeded"); } };
  assert.equal(saveProjects([working]), false);
  globalThis.localStorage = validStorage;
  assert.equal(readProjects()[0].id, project.id);
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
    from: 1, to: 2, title: "At the gate", summary: "Holmes opens the gate.", visualDescription: "At the gate, Holmes holds the open gate and raises a hand toward his companion.", beatType: "action"
  }] });
  const beatContext = { characters: [{ id: "holmes", name: "Holmes" }], locations: [{ id: "gate", name: "Gate" }] };
  const proposals = ai.parseAiBeats(beatReply, excerpt, beatContext, 50);
  assert.equal(proposals[0].sourceStart, 50); assert.equal(proposals[0].sourceEnd, 50 + excerpt.length);
  assert.deepEqual(proposals[0].characterIds, ["holmes"]); assert.equal(proposals[0].locationId, "gate");
  assert.equal(proposals[0].dialogueCandidates[0].source, "original");
  assert.equal(proposals[0].origin, "ai-generated");
  const extraFields = JSON.parse(beatReply);
  extraFields.beats[0].sourceTextExcerpt = "Invented wording";
  extraFields.beats[0].dialogue = ["Invented dialogue"];
  assert.equal(ai.parseAiBeats(JSON.stringify(extraFields), excerpt, beatContext)[0].sourceTextExcerpt, excerpt);
  assert.equal(ai.parseAiBeats(JSON.stringify(extraFields), excerpt, beatContext)[0].dialogueCandidates[0].text, "Wait here,");
  assert.throws(() => ai.parseAiBeats(beatReply.replace('"from":1', '"from":0'), excerpt, beatContext));
  assert.throws(() => ai.parseAiBeats(beatReply.replace('"to":2', '"to":999'), excerpt, beatContext));
  assert.throws(() => ai.parseAiBeats(beatReply.replace('"from":1', '"from":1.5'), excerpt, beatContext));
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
      const request = JSON.parse(init.body);
      const input = JSON.parse(request.messages[1].content);
      assert.deepEqual(input.segments, [{ id: 1, text: "Holmes opened the gate." }, { id: 2, text: '"Wait here," he said.' }]);
      assert.ok(!request.messages[0].content.includes("sourceTextExcerpt"));
      assert.ok(request.max_tokens <= 2048);
      return response({ choices: [{ message: { content: beatReply }, finish_reason: "stop" }] });
    }, onProgress: (done, total) => progress.push([done, total]) });
  assert.equal(suggested[0].sourceStart, 50); assert.deepEqual(progress, [[0, 1], [1, 1]]);
  await assert.rejects(ai.suggestAiBeats({ source: excerpt, context: beatContext, settings, signal: abort.signal }));
  const repeatedSource = excerpt + "\n\n" + excerpt;
  const numbered = ai.numberSourceSegments(repeatedSource);
  assert.equal(numbered.length, 4);
  assert.ok(numbered.every(segment => repeatedSource.slice(segment.start, segment.end) === segment.text));
  const pair = { beats: [
    { from: 1, to: 2, title: "First", summary: "First exchange.", beatType: "dialogue" },
    { from: 3, to: 4, title: "Second", summary: "Repeated exchange.", beatType: "dialogue" }
  ] };
  const restored = ai.parseAiBeats(JSON.stringify(pair), repeatedSource, beatContext, 100);
  assert.equal(restored[0].sourceTextExcerpt, excerpt);
  assert.equal(restored[1].sourceTextExcerpt, excerpt);
  assert.equal(restored[1].sourceStart, 100 + excerpt.length + 2);
  assert.equal(restored[0].dialogueCandidates.length, 1);
  assert.equal(restored[1].dialogueCandidates.length, 1);
  assert.throws(() => ai.parseAiBeats(JSON.stringify({ beats: [...pair.beats].reverse() }), repeatedSource, beatContext));
  const shared = ai.parseAiBeats(JSON.stringify({ beats: [pair.beats[0], { ...pair.beats[1], from: 2, to: 2 }] }), repeatedSource, beatContext);
  assert.equal(shared[0].dialogueCandidates.length, 1);
  assert.equal(shared[1].dialogueCandidates.length, 0);
  const stringIds = ai.parseAiBeats(JSON.stringify({ beats: [{ ...pair.beats[0], from: "1", to: "2" }] }), excerpt, beatContext);
  assert.equal(stringIds[0].sourceTextExcerpt, excerpt);
  const whitespaceSource = "\r\n  Första meningen.\r\n\r\n  ”Vänta!”\r\n";
  const whitespaceSegments = ai.numberSourceSegments(whitespaceSource);
  assert.ok(whitespaceSegments.every(segment => whitespaceSource.slice(segment.start, segment.end) === segment.text));
  const whitespaceBeats = ai.parseAiBeats(JSON.stringify({ beats: [{ from: 1, to: whitespaceSegments.length, title: "Vänta", summary: "Någon väntar.", beatType: "dialogue" }] }), whitespaceSource, { characters: [], locations: [] }, 200);
  assert.equal(whitespaceBeats[0].sourceTextExcerpt, whitespaceSource.slice(whitespaceBeats[0].sourceStart - 200, whitespaceBeats[0].sourceEnd - 200));
  assert.equal(whitespaceBeats[0].dialogueCandidates[0].text, "Vänta!");
  const longDialogue = '"Wait here. Keep the gate open."';
  const splitDialogue = ai.parseAiBeats(JSON.stringify({ beats: [
    { from: 1, to: 1, title: "Wait", summary: "He asks them to wait.", beatType: "dialogue" },
    { from: 2, to: 2, title: "Gate", summary: "He asks them to keep the gate open.", beatType: "dialogue" }
  ] }), longDialogue, { characters: [], locations: [] });
  assert.equal(splitDialogue[0].dialogueCandidates[0].text, "Wait here.");
  assert.equal(splitDialogue[1].dialogueCandidates[0].text, "Keep the gate open.");
  assert.ok(splitDialogue.every(beat => beat.dialogueCandidates.every(line => beat.sourceTextExcerpt.includes(line.text))));
  assert.notEqual(proposals[0].visualCandidates[0].description, proposals[0].summary);
  assert.equal(panelize(proposals)[0].visualDescription, proposals[0].visualCandidates[0].description);
  const pronounSource = "Holmes stops. He raises his hand.";
  const pronoun = { beats: [{from:2,to:2,title:"Stop",summary:"A warning gesture.",visualDescription:"Holmes faces his companion with one palm held up.",beatType:"action",characterIds:["holmes"],locationId:null}] };
  assert.deepEqual(ai.parseAiBeats(JSON.stringify(pronoun),pronounSource,beatContext,0,true)[0].characterIds,["holmes"]);
  assert.throws(()=>ai.parseAiBeats(JSON.stringify({...pronoun,beats:[{...pronoun.beats[0],characterIds:["invented"]}]}),pronounSource,beatContext,0,true));
  assert.throws(()=>ai.parseAiBeats(JSON.stringify({...pronoun,beats:[{...pronoun.beats[0],locationId:"invented"}]}),pronounSource,beatContext,0,true));
  assert.throws(()=>ai.parseAiBeats(JSON.stringify({...pronoun,beats:[{...pronoun.beats[0],visualDescription:undefined}]}),pronounSource,beatContext,0,true));
  console.log("PASS: numbered references restore exact original text and dialogue, handle repetition/overlap/whitespace, reject invalid IDs/order, and send compact prompts");
  {
  const { renderOptionsForStyle, resolveColorMode } = await import(pathToFileURL(join(temporary, "styleColorMode.mjs")));
  const { buildImagePrompt, generateImagePrompts } = await import(pathToFileURL(join(temporary, "adaptation/prompts.mjs")));
  const charcoal = BUILTIN_STYLES.find(s => s.id === 'draw-expressive-charcoal');
  const oil = BUILTIN_STYLES.find(s => s.id === 'paint-zorn-alla-prima');
  const vintage = BUILTIN_STYLES.find(s => s.id === 'print-vintage-halftone');
  const silk = BUILTIN_STYLES.find(s => s.id === 'paint-east-asian-silk');
  assert.equal(createProject('Charcoal', 'manual', charcoal).renderOptions.colorMode, 'grayscale');
  assert.equal(renderOptionsForStyle(oil, { linesOnly: true }).colorMode, 'color');
  assert.equal(renderOptionsForStyle(charcoal, { colorMode: 'color' }).colorMode, 'grayscale');
  assert.equal(resolveColorMode(BUILTIN_STYLES[0], { linesOnly: true }), 'line-art');
  const samplePanel = { id: 'panel-mode', visualDescription: 'A woman opens a door.', characterIds: [], shotType: 'medium', sizeHint: 'wide' };
  for (const mode of ['short', 'medium', 'full']) {
    const grayscaleProject = { ...createProject('Vintage', 'manual', vintage), renderOptions: { linesOnly: false, colorMode: 'grayscale' } };
    const prompt = buildImagePrompt(grayscaleProject, samplePanel, mode);
    assert.match(prompt, /visible black halftone dots/);
    assert.doesNotMatch(prompt, /dusty reds|warm off-white or pale beige/);
    assert.match(prompt, /neutral grayscale/);
    const negative = generateImagePrompts(grayscaleProject, [samplePanel], mode)[0].negativePrompt;
    assert.match(negative, /sepia/);
    assert.doesNotMatch(negative, /painted rendering|grayscale wash/);
    const colorPrompt = buildImagePrompt({ ...createProject('Oil', 'manual', oil), renderOptions: { linesOnly: true } }, samplePanel, mode);
    assert.match(colorPrompt, /exclusively in color/);
    assert.doesNotMatch(colorPrompt, /line art only/);
  }
  const saved = createProject('Saved gray', 'manual', charcoal);
  saveProjects([saved]);
  const loaded = readProjects().find(p => p.id === saved.id);
  assert.equal(loaded.renderOptions.colorMode, 'grayscale');
  assert.equal(loaded.style.supportedColorModes[0], 'grayscale');
  const originalSnapshot = JSON.stringify(saved.style);
  const changedStyle = { ...saved, style: oil, renderOptions: renderOptionsForStyle(oil, saved.renderOptions) };
  assert.equal(changedStyle.renderOptions.colorMode, 'color');
  assert.equal(JSON.stringify(saved.style), originalSnapshot);
  assert.match(buildImagePrompt(createProject('Silk', 'manual', silk), samplePanel), /No photographic underpainting, hatching, decorative writing, calligraphy, seals or stamps/);
  assert.match(generateImagePrompts(createProject('Silk', 'manual', silk), [samplePanel])[0].negativePrompt, /lettering/);
  console.log('PASS: style mode restrictions, legacy line mode, gray prompt variants in every length, negative prompts, save/load and snapshot preservation');
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}


