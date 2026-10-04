import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5176/",
});
for (const key of [
  "window",
  "document",
  "navigator",
  "localStorage",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "Event",
  "MouseEvent",
  "NodeFilter",
  "FileReader",
  "Node",
]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = join(projectRoot, "src");
const compiledRoot = mkdtempSync(join(tmpdir(), "comicbook-ui-"));
symlinkSync(
  join(projectRoot, "node_modules"),
  join(compiledRoot, "node_modules"),
  process.platform === "win32" ? "junction" : "dir",
);
function compile(directory = "") {
  for (const entry of readdirSync(join(sourceRoot, directory), {
    withFileTypes: true,
  })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      compile(path);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name === "main.tsx") continue;
    const source = readFileSync(join(sourceRoot, path), "utf8");
    const output = ts
      .transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      })
      .outputText.replace(/import "[^"\n]+\.css";?/g, "")
      .replace(/from "(\.[^"]+)"/g, 'from "$1.mjs"');
    mkdirSync(join(compiledRoot, directory), { recursive: true });
    writeFileSync(join(compiledRoot, path.replace(/\.tsx?$/, ".mjs")), output);
  }
}
compile();
const React = await import("react");
const { render, screen, waitFor, fireEvent, within } =
  await import("@testing-library/react");
const user = (await import("@testing-library/user-event")).default.setup();
const { App } = await import(pathToFileURL(join(compiledRoot, "App.mjs")));
const source = 'Holmes opened the gate.\r\n"Wait here," he said.';
const project = {
  format: 1,
  id: "test-project",
  title: "Local AI test",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  source: { type: "text", textSnapshot: source },
  style: {
    id: "test-style",
    name: "Test style",
    genre: "Test",
    promptText: "Ink illustration.",
  },
  renderOptions: { linesOnly: false },
  pageDefaults: { gridColumns: 3, gridRows: 5 },
  characters: [{ id: "holmes", name: "Holmes", visualIdentity: "" }],
  locations: [],
  scenes: [],
  panels: [],
  pages: [
    {
      id: "page",
      number: 1,
      gridColumns: 3,
      gridRows: 5,
      placements: [
        {
          id: "blank-placement",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          readingOrder: 1,
          overlays: [],
        },
        {
          id: "manual-placement",
          x: 1,
          y: 0,
          width: 1,
          height: 1,
          readingOrder: 2,
          overlays: [],
          image: {
            name: "existing.png",
            dataUrl: "data:image/png;base64,existing",
            fit: "contain",
          },
        },
      ],
    },
  ],
  adaptations: [],
  bubbleSwatches: [],
};
localStorage.setItem("comicbook-ai.locale", "sv");
localStorage.setItem("comicbook-ai.projects", JSON.stringify([project]));
const reply = JSON.stringify({
  beats: [
    {
      from: 1,
      to: 2,
      title: "At the gate",
      summary: "Holmes opens the gate.",
      beatType: "action",
      sourceTextExcerpt: source,
      visualDescription: "Holmes standing at the gate.",
      dialogue: ["Wait here,"],
      captions: [],
      characters: ["Holmes"],
      location: "",
    },
  ],
});
let mode = "success";
let requests = [];
globalThis.fetch = async (url, init) => {
  requests.push({ url, body: init.body ? JSON.parse(init.body) : undefined });
  let data;
  if (url.endsWith("/api/tags"))
    data = {
      models: [{ name: "story-model:latest" }, { name: "other:latest" }],
    };
  else if (url.endsWith("/v1/models"))
    data = { data: [{ id: "studio-model" }] };
  else if (url.endsWith("/api/show"))
    data = { model_info: { "llama.context_length": 32768 } };
  else {
    if (mode === "failure") return new Response("{}", { status: 503 });
    if (mode === "slow") {
      await new Promise((_resolve, reject) =>
        init.signal.addEventListener("abort", () =>
          reject(new Error("Aborted")),
        ),
      );
    }
    let currentReply = reply;
    if (mode === "selection") {
      const segments = JSON.parse(
        JSON.parse(init.body).messages[1].content,
      ).segments;
      const proposal = JSON.parse(reply);
      proposal.beats[0].from = 1;
      proposal.beats[0].to = segments.length;
      proposal.beats[0].dialogue = [];
      currentReply = JSON.stringify(proposal);
    }
    data = url.endsWith("/api/chat")
      ? { message: { content: currentReply }, done_reason: "stop" }
      : {
          choices: [
            { message: { content: currentReply }, finish_reason: "stop" },
          ],
        };
  }
  return new Response(JSON.stringify(data));
};
const saved = () =>
  JSON.parse(localStorage.getItem("comicbook-ai.projects"))[0];
const view = render(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);
try {
  await user.click(
    screen.getByRole("button", { name: "Inställningar", exact: true }),
  );
  await user.click(
    screen.getByRole("button", { name: "Anslut / uppdatera modeller" }),
  );
  await screen.findByText("Ansluten · 2", { exact: true });
  await user.selectOptions(
    screen.getByLabelText("Modell för adaptering"),
    "story-model:latest",
  );
  await user.click(
    screen.getByRole("button", { name: "Läs modellens kontextgräns" }),
  );
  await screen.findByText("Modellens kontextgräns: 32768");
  assert.equal(screen.getByLabelText("Kontextstorlek (token)").value, "32768");
  await user.clear(screen.getByLabelText("Kontextstorlek (token)"));
  await user.type(screen.getByLabelText("Kontextstorlek (token)"), "8192");
  await user.tab();
  assert.equal(screen.getByLabelText("Kontextstorlek (token)").value, "8192");
  await user.selectOptions(
    screen.getByLabelText("Servertyp"),
    "openai-compatible",
  );
  await user.click(
    screen.getByRole("button", { name: "Anslut / uppdatera modeller" }),
  );
  await screen.findByText("Ansluten · 1");
  assert.equal(
    screen.getByLabelText("Modell för adaptering").value,
    "studio-model",
  );
  await user.click(screen.getByRole("button", { name: "Stäng", exact: true }));
  await user.click(
    screen.getByRole("button", { name: "Projekt", exact: true }),
  );
  await user.click(
    screen.getByRole("menuitem", { name: "Local AI test", exact: true }),
  );
  const selectText = (start, end) => {
    const editor = screen.getByRole("textbox", { name: "Manus", exact: true });
    editor.focus();
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node,
      offset = 0,
      started = false;
    while ((node = walker.nextNode())) {
      const length = node.textContent.length;
      if (!started && start <= offset + length) {
        range.setStart(node, start - offset);
        started = true;
      }
      if (started && end <= offset + length) {
        range.setEnd(node, end - offset);
        break;
      }
      offset += length;
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.mouseUp(editor);
    return editor;
  };
  let editor = selectText(0, source.indexOf(".") + 1);
  fireEvent.contextMenu(editor, { clientX: 20, clientY: 30 });
  await user.click(
    screen.getByRole("menuitem", { name: "Skapa beat", exact: true }),
  );
  assert.equal(saved().adaptations[0].beats.length, 1);
  assert.equal(
    saved().adaptations[0].beats[0].sourceTextExcerpt,
    "Holmes opened the gate.",
  );
  assert.equal(document.querySelectorAll(".manuscript-beat").length, 1);
  assert.equal(
    document.querySelector(".manuscript-beat").textContent,
    "Holmes opened the gate.",
  );
  assert.equal(
    screen.getByRole("textbox", { name: "Manus", exact: true }).textContent,
    source,
  );
  await user.click(
    screen.getByRole("button", { name: "Lägg till ruta", exact: true }),
  );
  const originalPlan = saved().adaptations[0].panelPlans[0].id;
  const originalPanel = saved().panels[0].id;
  assert.equal(saved().panels.length, 1);
  assert.equal(document.querySelector(".beat-width"), null);
  const sections = [...document.querySelectorAll(".beat-section")];
  assert.equal(sections.length, 2);
  const beatDetails = document.querySelector(".beat-details-section");
  assert.equal(beatDetails.querySelectorAll("details").length, 0);
  assert.ok(beatDetails.contains(screen.getByLabelText("Sammanfattning")));
  assert.ok(beatDetails.contains(screen.getByLabelText("Beat-typ")));
  assert.ok(beatDetails.contains(screen.getByLabelText("Plats")));
  await user.click(beatDetails.querySelector("summary"));
  assert.equal(beatDetails.open, true);
  await user.click(beatDetails.querySelector("summary"));
  assert.equal(beatDetails.open, false);
  const firstCard = document.querySelector(".beat-panel-card");
  assert.equal(firstCard.open, false);
  const beforeCollapse = saved();
  await user.click(firstCard.querySelector("summary"));
  assert.equal(firstCard.open, true);
  await user.click(firstCard.querySelector("summary"));
  assert.equal(firstCard.open, false);
  assert.deepEqual(saved(), beforeCollapse);
  await user.click(firstCard.querySelector("summary"));
  const panelsSection = document.querySelector(".beat-panels-section");
  await user.click(panelsSection.querySelector("summary"));
  assert.equal(panelsSection.open, false);
  await user.click(panelsSection.querySelector("summary"));
  assert.equal(firstCard.open, true);
  await user.click(
    screen.getByRole("button", { name: "Lägg till ruta", exact: true }),
  );
  const secondCard = document.querySelectorAll(".beat-panel-card")[1];
  assert.equal(secondCard.open, false);
  await user.click(secondCard.querySelector("summary"));
  assert.equal(secondCard.open, true);
  await user.click(firstCard.querySelector("summary"));
  assert.equal(firstCard.open, false);
  assert.equal(secondCard.open, true);
  await user.click(secondCard.querySelector("summary"));
  await user.click(firstCard.querySelector("summary"));
  await user.click(
    within(firstCard).getByRole("button", {
      name: "Generera bildprompt",
      exact: true,
    }),
  );
  assert.ok(
    screen.getByLabelText("Bildprompt").value.includes("Ink illustration."),
  );
  const imageInput = document.querySelector(".beat-image-drop input");
  const file = new window.File(["panel-image"], "panel.png", {
    type: "image/png",
  });
  fireEvent.change(imageInput, { target: { files: [file] } });
  await waitFor(() => assert.ok(saved().adaptations[0].panelPlans[0].image));
  assert.equal(
    screen.getByRole("img", { name: "panel.png" }).getAttribute("src"),
    saved().adaptations[0].panelPlans[0].image.dataUrl,
  );
  const initialImage = saved().adaptations[0].panelPlans[0].image;
  fireEvent.change(imageInput, {
    target: {
      files: [
        new window.File(["new-image"], "replacement.png", {
          type: "image/png",
        }),
      ],
    },
  });
  await waitFor(() =>
    assert.equal(
      saved().adaptations[0].panelPlans[0].image.name,
      "replacement.png",
    ),
  );
  assert.deepEqual(saved().adaptations[0].panelPlans[0].imageVersions, [
    initialImage,
  ]);
  document.querySelector(".beat-image-history").open = true;
  await user.click(
    screen.getByRole("button", { name: /panel.png.*Återställ/ }),
  );
  assert.deepEqual(saved().adaptations[0].panelPlans[0].image, initialImage);
  await user.click(
    within(firstCard).getByRole("button", {
      name: "Lägg till dialog",
      exact: true,
    }),
  );
  await user.type(screen.getByLabelText("Dialog"), "Please wait.");
  assert.equal(
    saved().adaptations[0].panelPlans[0].dialogue[0].text,
    "Please wait.",
  );
  const before = saved().adaptations;
  mode = "selection";
  const start = source.indexOf("Wait here,");
  selectText(start, start + "Wait here,".length);
  await user.click(
    screen.getByRole("button", {
      name: "Föreslå beats för markeringen",
      exact: true,
    }),
  );
  await screen.findByRole("heading", {
    name: "Granska AI-förslag",
    exact: true,
  });
  const lastChat = requests
    .filter((request) => request.url.endsWith("/v1/chat/completions"))
    .at(-1);
  assert.deepEqual(JSON.parse(lastChat.body.messages[1].content).segments, [
    { id: 1, text: "Wait here," },
  ]);
  assert.deepEqual(saved().adaptations, before);
  await user.click(
    screen.getByRole("button", { name: "Lägg till valda beats", exact: true }),
  );
  assert.equal(saved().adaptations[0].beats.length, 2);
  assert.equal(saved().adaptations[0].panelPlans[0].id, originalPlan);
  assert.equal(saved().panels[0].id, originalPanel);
  assert.ok(saved().adaptations[0].panelPlans[0].image);
  const afterAccept = saved().adaptations;
  mode = "failure";
  selectText(0, 6);
  await user.click(
    screen.getByRole("button", {
      name: "Föreslå beats för markeringen",
      exact: true,
    }),
  );
  await screen.findByText(/Analysen misslyckades/);
  assert.deepEqual(saved().adaptations, afterAccept);
  mode = "slow";
  selectText(0, 6);
  await user.click(
    screen.getByRole("button", {
      name: "Föreslå beats för markeringen",
      exact: true,
    }),
  );
  await user.click(screen.getByRole("button", { name: "Avbryt", exact: true }));
  await waitFor(() =>
    assert.equal(screen.queryByText(/Analyserar avsnitt/), null),
  );
  assert.deepEqual(saved().adaptations, afterAccept);
  // Source insertion outside beats retains their IDs and updates offsets.
  editor = screen.getByRole("textbox", { name: "Manus", exact: true });
  editor.textContent = "Prelude. " + source;
  fireEvent.input(editor);
  assert.equal(saved().adaptations[0].beats[0].sourceStart, 9);
  assert.equal(saved().adaptations[0].beats[0].sourceNeedsReview, undefined);
  assert.equal(
    document.querySelector(".manuscript-beat").textContent,
    "Holmes opened the gate.",
  );
  editor.textContent = "Prelude. " + source.replace("opened", "closed");
  fireEvent.input(editor);
  assert.equal(saved().adaptations[0].beats[0].sourceNeedsReview, true);
  assert.ok(saved().adaptations[0].panelPlans[0].image);
  assert.equal(saved().adaptations[0].panelPlans[0].id, originalPlan);
  await user.click(screen.getByRole("button", { name: /1 · Holmes/ }));
  assert.ok(screen.getByText("Källtexten har ändrats — granska beatet"));
  const sourceReview = screen.getAllByRole("button", {
    name: "Bekräfta granskad källa",
  });
  await user.click(sourceReview[0]);
  assert.equal(saved().adaptations[0].beats[0].sourceNeedsReview, false);
  assert.equal(
    saved().adaptations[0].beats[0].sourceTextExcerpt,
    "Holmes closed the gate.",
  );
  // Plain-text editing: Enter and paste preserve source and caret offsets.
  editor = selectText(editor.textContent.length, editor.textContent.length);
  fireEvent.keyDown(editor, { key: "Enter" });
  assert.ok(saved().source.textSnapshot.endsWith("\n"));
  fireEvent.paste(editor, {
    clipboardData: { getData: () => "New paragraph." },
  });
  assert.ok(saved().source.textSnapshot.endsWith("\nNew paragraph."));
  await user.click(
    screen.getByRole("button", { name: "Adaptering", exact: true }),
  );
  assert.equal(
    document.querySelectorAll(".adaptation-side-nav button").length,
    2,
  );
  assert.equal(screen.queryByText(/Sekvenser/), null);
  await user.click(
    screen.getByRole("button", {
      name: "Skapa rutor för återstående beats",
      exact: true,
    }),
  );
  assert.equal(saved().adaptations[0].panelPlans[0].id, originalPlan);
  assert.ok(saved().adaptations[0].panelPlans[0].image);
  assert.equal(saved().adaptations[0].panelPlans.length, 3);
  await user.click(screen.getByRole("button", { name: "Sidor", exact: true }));
  const placementRows = document.querySelectorAll(".placement-row");
  await user.selectOptions(
    placementRows[0].querySelector("select"),
    originalPanel,
  );
  assert.deepEqual(saved().pages[0].placements[0].image, initialImage);
  assert.deepEqual(
    saved().pages[0].placements[0].sourceBeatIds,
    saved().adaptations[0].panelPlans[0].sourceBeatIds,
  );
  const manualImage = saved().pages[0].placements[1].image;
  await user.selectOptions(
    placementRows[1].querySelector(".storyboard-link-select"),
    originalPlan,
  );
  assert.deepEqual(saved().pages[0].placements[1].image, manualImage);
  assert.ok(
    requests.some(
      (request) =>
        request.url.endsWith("/v1/chat/completions") &&
        request.body.model === "studio-model",
    ),
  );
  assert.equal(
    JSON.parse(localStorage.getItem("comicbook-ai.local-text-ai")).engine,
    "openai-compatible",
  );
  await user.click(screen.getByRole("button", { name: "Manus", exact: true }));
  const lastSaved = saved();
  const originalSetItem = window.Storage.prototype.setItem;
  window.Storage.prototype.setItem = function (key, value) {
    if (key === "comicbook-ai.projects") throw new Error("Quota exceeded");
    return originalSetItem.call(this, key, value);
  };
  try {
    fireEvent.change(screen.getByLabelText("Rubrik"), {
      target: { value: "Unsaved title" },
    });
    await screen.findByText(/Projektet kunde inte sparas/);
    assert.equal(screen.getByLabelText("Rubrik").value, "Unsaved title");
    assert.deepEqual(saved(), lastSaved);
  } finally {
    window.Storage.prototype.setItem = originalSetItem;
  }
  fireEvent.change(screen.getByLabelText("Rubrik"), {
    target: { value: "Saved title" },
  });
  assert.equal(saved().adaptations[0].beats[0].title, "Saved title");
  assert.equal(screen.queryByText(/Projektet kunde inte sparas/), null);
  console.log(
    "PASS: manuscript frames/CRLF, prompt/image/history/dialogue inspector, selected-only AI append/failure/cancel, source edits/caret, no sequences, stable panel IDs and page images",
  );
} finally {
  view.unmount();
  dom.window.close();
  rmSync(compiledRoot, { recursive: true, force: true });
}
