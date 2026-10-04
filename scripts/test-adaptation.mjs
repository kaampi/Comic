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
const files = ["adaptation/extract", "adaptation/repair", "adaptation/panelize", "project", "stylesLibrary"];
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
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
