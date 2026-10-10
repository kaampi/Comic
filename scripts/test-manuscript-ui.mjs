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
import { join, resolve } from "node:path";
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
window.PointerEvent = window.MouseEvent;
globalThis.PointerEvent = window.MouseEvent;
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
      .replace(/import (\w+) from "(\.[^"]+\.json)";/g, (_, name, imported) =>
        `const ${name} = ${readFileSync(resolve(sourceRoot, directory, imported), "utf8")};`)
      .replace(/from "(\.[^"]+)"/g, 'from "$1.mjs"');
    mkdirSync(join(compiledRoot, directory), { recursive: true });
    writeFileSync(join(compiledRoot, path.replace(/\.tsx?$/, ".mjs")), output);
  }
}
compile();
const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { SvgOverlay, bubbleTailStart } = await import(
  pathToFileURL(join(compiledRoot, "SvgOverlay.mjs"))
);
const { wrapOverlayText } = await import(
  pathToFileURL(join(compiledRoot, "overlayTypography.mjs"))
);
assert.deepEqual(wrapOverlayText("First\r\n\r\nSecond", 24), [
  "First",
  "",
  "Second",
]);
assert.equal(wrapOverlayText("1\n2\n3\n4\n5\n6\n7\n8", 24).length, 8);
for (const [textAlign, anchor, x] of [
  ["left", "start", 1.6],
  ["center", "middle", 20],
  ["right", "end", 38.4],
]) {
  const markup = renderToStaticMarkup(
    React.createElement(SvgOverlay, {
      overlay: {
        id: "test",
        type: "speech",
        text: "First\n\nSecond",
        x: 0,
        y: 0,
        width: 40,
        height: 24,
        rotation: 0,
        fontSize: 8,
        textAlign,
        textPadding: 4,
      },
    }),
  );
  assert.ok(markup.includes(`text-anchor="${anchor}"`));
  assert.ok(markup.includes(`<text x="${x}"`));
  assert.equal((markup.match(/<tspan/g) || []).length, 3);
}

const { thoughtCloudGeometry, thoughtTrailGeometry } = await import(pathToFileURL(join(compiledRoot,"thoughtBubble.mjs")));
for(const [width,height] of [[42,24],[84,48],[100,4],[4,100]]) {
 const shape=thoughtCloudGeometry(width,height);
 assert.equal(shape.path,thoughtCloudGeometry(width,height).path);
 assert.ok(shape.path.includes(" A "));
 for(const point of shape.outline){assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.ok(point.x>=0&&point.x<=width&&point.y>=0&&point.y<=height);}
}
assert.ok(thoughtCloudGeometry(84,48).count>thoughtCloudGeometry(42,24).count);
const thought={id:"thought",type:"thought",text:"",x:0,y:0,width:42,height:24,rotation:0};
const shape=thoughtCloudGeometry(42,24);
const normalTrail=thoughtTrailGeometry(thought,shape.outline);
const longTrail=thoughtTrailGeometry({...thought,tailX:80,tailY:80},shape.outline);
assert.ok(longTrail.length>normalTrail.length);
const wideTrail=thoughtTrailGeometry({...thought,tailX:80,tailY:80,thoughtTailWidth:100},shape.outline);
assert.ok(wideTrail[0].r>longTrail[0].r);
const straightTrail=thoughtTrailGeometry({...thought,tailX:80,tailY:80,thoughtTailCurve:0},shape.outline);
const reverseTrail=thoughtTrailGeometry({...thought,tailX:80,tailY:80,thoughtTailCurve:-30},shape.outline);
assert.notEqual(straightTrail[0].x,longTrail[0].x);
assert.notEqual(reverseTrail[0].x,longTrail[0].x);
assert.deepEqual(reverseTrail.at(-1),longTrail.at(-1));

assert.deepEqual(thoughtTrailGeometry({...thought,tailX:21,tailY:12},shape.outline),[]);
assert.deepEqual(thoughtTrailGeometry({...thought,tailX:25,tailY:14},shape.outline),[]);
for(let i=1;i<longTrail.length;i++)assert.ok(longTrail[i].r<=longTrail[i-1].r);
assert.ok(Math.abs(longTrail.at(-1).x-80)<1e-8&&Math.abs(longTrail.at(-1).y-80)<1e-8);
const legacyThought = renderToStaticMarkup(React.createElement(SvgOverlay,{overlay:{id:"thought",type:"thought",text:"Thinking",x:10,y:10,width:42,height:24,rotation:0}}));
assert.ok((legacyThought.match(/<circle/g)||[]).length>=1);
assert.ok(legacyThought.includes('class="thought-trail"'));
assert.ok(legacyThought.includes('class="thought-cloud"'));
const { render, screen, waitFor, fireEvent, within } =
  await import("@testing-library/react");
const user = (await import("@testing-library/user-event")).default.setup();
// Font metrics arrive asynchronously; reflow the editor once the selected font loads.
const originalCreateElement=document.createElement.bind(document);
let fontLoaded=false,resolveFont;
const fontListeners=new Set();
const requestedFonts=[];
const canvasContext={font:'',measureText(text){return {width:text.length*(fontLoaded?1:10)};}};
globalThis.CanvasRenderingContext2D=class {};
document.createElement=function(tag,...args){return tag==='canvas'?{getContext:()=>canvasContext}:originalCreateElement(tag,...args);};
Object.defineProperty(document,'fonts',{configurable:true,value:{
  load(font){requestedFonts.push(font);return new Promise(resolve=>{resolveFont=resolve;});},
  addEventListener(event,listener){fontListeners.add(listener);},
  removeEventListener(event,listener){fontListeners.delete(listener);}
}});
const measuredOverlay={id:'font-metrics',type:'caption',text:'iiii iiii',x:0,y:0,width:100,height:80,rotation:0,fontSize:12,textPadding:10,fontFamily:'Patrick Hand, cursive',fontWeight:400};
const metricsFixture=render(React.createElement('svg',null,React.createElement(SvgOverlay,{overlay:measuredOverlay,textMetrics:{width:60,height:100,pageWidthMm:210}})));
assert.equal(metricsFixture.container.querySelectorAll('tspan').length,2);
await React.act(async()=>{fontLoaded=true;resolveFont([]);});
assert.equal(metricsFixture.container.querySelectorAll('tspan').length,1);
assert.ok(requestedFonts[0].includes('400 16px Patrick Hand'));
await React.act(async()=>{fontLoaded=false;for(const listener of fontListeners)listener();});
assert.equal(metricsFixture.container.querySelectorAll('tspan').length,2);
metricsFixture.unmount();
assert.equal(fontListeners.size,0);
document.createElement=originalCreateElement;
delete document.fonts;
delete globalThis.CanvasRenderingContext2D;
const { FontPicker } = await import(pathToFileURL(join(compiledRoot, "FontPicker.mjs")));
const { uiText } = await import(pathToFileURL(join(compiledRoot, "i18n.mjs")));
function FontPickerFixture() {
  const [font, setFont] = React.useState("Comic Neue, sans-serif");
  return React.createElement("div", null,
    React.createElement(FontPicker, {label:"Preview font", value:font, onChange:setFont}),
    React.createElement("button", {type:"button"}, "Outside font picker"));
}
const fontFixture = render(React.createElement(FontPickerFixture));
const fontTrigger = screen.getByRole("combobox", {name:"Preview font"});
assert.equal(fontTrigger.getAttribute("aria-expanded"), "false");
await user.click(fontTrigger);
const fontList = screen.getByRole("listbox", {name:"Preview font"});
for (const option of within(fontList).getAllByRole("option")) {
  const preview = option.querySelector(".font-picker-preview");
  assert.equal(preview.style.fontFamily.replace(/["\']/g, "").split(",")[0], preview.textContent);
}
await user.click(within(fontList).getByRole("option", {name:"Permanent Marker", exact:true}));
assert.ok(fontTrigger.textContent.includes("Permanent Marker"));
assert.equal(screen.queryByRole("listbox"), null);
await user.click(fontTrigger);
await user.keyboard("{Home}{ArrowDown}{Enter}");
assert.ok(fontTrigger.textContent.includes("Action Man"));
assert.equal(screen.queryByRole("listbox"), null);
await user.click(fontTrigger);
let escaped = false;
const fontEscape = event => { if(event.key === "Escape") escaped = true; };
window.addEventListener("keydown", fontEscape);
await user.keyboard("{Escape}");
assert.equal(screen.queryByRole("listbox"), null);
assert.equal(escaped, false);
window.removeEventListener("keydown", fontEscape);
await user.click(fontTrigger);
await user.keyboard("rub");
await user.keyboard("{Enter}");
assert.ok(fontTrigger.textContent.includes("Rubik Bubbles"));
await user.click(fontTrigger);
await user.click(screen.getByRole("button", {name:"Outside font picker",exact:true}));
assert.equal(screen.queryByRole("listbox"), null);
fontFixture.unmount();

// A wide original remains whole when moved behind a narrow clipping frame.
const { PositionedImage } = await import(pathToFileURL(join(compiledRoot,'PositionedImage.mjs')));
let cropImage={name:'wide.png',dataUrl:'data:image/png;base64,wide',fit:'cover',positionMode:'frame',zoom:1,offsetX:0,offsetY:0};
const cropFixture=render(React.createElement('div',{style:{position:'relative',overflow:'hidden'}},React.createElement(PositionedImage,{image:cropImage})));
const cropFrame=cropFixture.container.firstChild,cropElement=cropFrame.querySelector('img');
let cropBox={width:200,height:200};
cropFrame.getBoundingClientRect=()=>({...cropBox,left:0,top:0});
Object.defineProperty(cropElement,'naturalWidth',{configurable:true,value:400});
Object.defineProperty(cropElement,'naturalHeight',{configurable:true,value:200});
fireEvent.load(cropElement);
assert.equal(cropElement.style.width,'400px');
assert.equal(cropElement.style.left,'-100px');
cropImage={...cropImage,offsetX:-50};
cropFixture.rerender(React.createElement('div',{style:{position:'relative',overflow:'hidden'}},React.createElement(PositionedImage,{image:cropImage})));
assert.equal(cropElement.style.left,'-200px');
assert.equal(Number.parseFloat(cropElement.style.left)+Number.parseFloat(cropElement.style.width),200,'original right edge reaches the frame right edge');
assert.equal(cropElement.style.objectFit,'fill','the image element contains the full original without an internal crop');
assert.equal(cropElement.style.transform,'none');
cropImage={...cropImage,offsetX:50};
cropFixture.rerender(React.createElement('div',{style:{position:'relative',overflow:'hidden'}},React.createElement(PositionedImage,{image:cropImage})));
assert.equal(cropElement.style.left,'0px','moving right reveals the original left edge');
cropImage={...cropImage,offsetX:0,fit:'contain'};
cropFixture.rerender(React.createElement('div',{style:{position:'relative',overflow:'hidden'}},React.createElement(PositionedImage,{image:cropImage})));
assert.equal(cropElement.style.width,'200px');
assert.equal(cropElement.style.height,'100px');
assert.equal(cropElement.style.top,'50px');
cropBox={width:400,height:200};
fireEvent(window,new window.Event('resize'));
assert.equal(cropElement.style.width,'400px','resizing recomputes fit from the parent frame');
cropImage={...cropImage,fit:'cover',offsetY:-50};
Object.defineProperty(cropElement,'naturalWidth',{configurable:true,value:200});
Object.defineProperty(cropElement,'naturalHeight',{configurable:true,value:400});
cropBox={width:200,height:200};
fireEvent.load(cropElement);
cropFixture.rerender(React.createElement('div',{style:{position:'relative',overflow:'hidden'}},React.createElement(PositionedImage,{image:cropImage})));
assert.equal(cropElement.style.height,'400px');
assert.equal(cropElement.style.top,'-200px','moving up reveals the original bottom edge');
cropImage={...cropImage,rotation:90};
cropFixture.rerender(React.createElement('div',{style:{position:'relative',overflow:'hidden'}},React.createElement(PositionedImage,{image:cropImage})));
assert.equal(cropElement.style.transform,'rotate(90deg)');
assert.equal(cropElement.style.transformOrigin,'center center');
cropFixture.unmount();
console.log('PASS: full original image survives cover crop; horizontal/vertical pan reveals hidden edges, contain and resize retain proportions.');

const { assignLibraryPanel } = await import(
  pathToFileURL(join(compiledRoot, "comicPanelLibrary.mjs"))
);
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
  characters: [{ id: "holmes", name: "Holmes", visualIdentity: "", description: "" }],
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
  const originalPlan = saved().adaptations[0].panelPlans[0].id;
  const originalPanel = saved().panels[0].id;
  assert.equal(saved().panels.length, 1);
  assert.equal(document.querySelector(".beat-width"), null);
  const sections = [...document.querySelectorAll(".beat-section")];
  assert.equal(sections.length, 1);
  const beatDetails = document.querySelector(".beat-details-section");
  assert.equal(beatDetails.querySelectorAll("details").length, 0);
  assert.ok(beatDetails.contains(screen.getByLabelText("Sammanfattning")));
  assert.ok(beatDetails.contains(screen.getByLabelText("Beat-typ")));
  assert.ok(beatDetails.contains(screen.getByLabelText("Plats")));
  await user.click(beatDetails.querySelector("summary"));
  assert.equal(beatDetails.open, true);
  await user.click(beatDetails.querySelector("summary"));
  assert.equal(beatDetails.open, false);
  let firstCard = document.querySelector(".beat-panel-card");
  assert.equal(firstCard.tagName, "SECTION");
  assert.equal(firstCard.querySelector(":scope > summary"), null);
  assert.equal(document.querySelector(".beat-panels-section"), null);
  await user.click(
    screen.getByRole("button", { name: "Lägg till ruta", exact: true }),
  );
  firstCard = document.querySelector(".beat-panel-card");
  assert.equal(firstCard.tagName, "DETAILS");
  const beforeCollapse = saved();
  await user.click(firstCard.querySelector("summary"));
  assert.equal(firstCard.open, true);
  const panelsSection = document.querySelector(".beat-panels-section");
  await user.click(panelsSection.querySelector("summary"));
  assert.equal(panelsSection.open, false);
  await user.click(panelsSection.querySelector("summary"));
  assert.deepEqual(saved(), beforeCollapse);
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
  assert.equal(
    screen.getByRole("button", { name: "Alla beats har rutor", exact: true })
      .disabled,
    true,
  );
  assert.equal(saved().adaptations[0].panelPlans[0].id, originalPlan);
  assert.ok(saved().adaptations[0].panelPlans[0].image);
  assert.equal(saved().adaptations[0].panelPlans.length, 3);
  await user.click(screen.getByRole("button", { name: "Sidor", exact: true }));
  const placementRows = document.querySelectorAll(".placement-row");
  const libraryCard = document.querySelector(
    `[data-panel-id="${originalPanel}"]`,
  );
  assert.ok(libraryCard.querySelector("img"));
  assert.equal(document.querySelector('.page-sidebar h3').firstChild.textContent.trim(),'Bildbibliotek');
  assert.equal(document.querySelector('.page-sidebar .page-list'),null);
  assert.ok(document.querySelector('.page-canvas-header .page-new-button'));
  assert.equal(within(document.querySelector('.page-sidebar')).queryByRole('button',{name:'Ny sida',exact:true}),null);
  assert.ok(libraryCard.closest('.panel-library-beat').querySelector('h4').textContent.startsWith('Beat '));
  assert.ok(document.querySelector('.project-sidebar .page-frame-picker select'));
  assert.equal(document.querySelector('.page-sidebar select'),null);

  await user.click(document.querySelectorAll(".drawn-panel")[0]);
  await user.click(libraryCard);
  assert.ok(
    saved().pages[0].placements[0].overlays.some(
      (o) => o.text === "Please wait.",
    ),
  );
  assert.ok(
    document.querySelector(`[data-panel-id="${originalPanel}"]`).disabled,
  );
  assert.match(
    document.querySelector(`[data-panel-id="${originalPanel}"]`).textContent,
    /Sida 1/,
  );
  await user.click(screen.getByLabelText("Visa bara oplacerade"));
  assert.equal(
    document.querySelector(`[data-panel-id="${originalPanel}"]`),
    null,
  );
  await user.click(screen.getByLabelText("Visa bara oplacerade"));
  await user.click(document.querySelector(".layout-canvas"));
  assert.deepEqual(saved().pages[0].placements[0].image, initialImage);
  assert.deepEqual(
    saved().pages[0].placements[0].sourceBeatIds,
    saved().adaptations[0].panelPlans[0].sourceBeatIds,
  );
  const { packAlbumBackup, parseAlbumBackup, restoredAlbumCopy } = await import(
    pathToFileURL(join(compiledRoot, "albumBackup.mjs"))
  );
  const backedUpProject = saved();
  const backup = packAlbumBackup(backedUpProject);
  assert.deepEqual(
    parseAlbumBackup(JSON.parse(JSON.stringify(backup))),
    backedUpProject,
  );
  const { normalizeProjectTypography } = await import(pathToFileURL(join(compiledRoot,"pageTypography.mjs")));
  const legacyBackup = structuredClone(backup);
  delete legacyBackup.project.typographyVersion;
  const legacySnapshot = structuredClone(legacyBackup);
  const migratedBackup = parseAlbumBackup(legacyBackup);
  assert.deepEqual(legacyBackup,legacySnapshot);
  assert.deepEqual(migratedBackup,normalizeProjectTypography(legacyBackup.project));
  assert.deepEqual(parseAlbumBackup(packAlbumBackup(migratedBackup)),migratedBackup);
  assert.deepEqual(restoredAlbumCopy(legacyBackup.project).pages,migratedBackup.pages);
  const unknownTypography = structuredClone(backup);
  unknownTypography.project.typographyVersion=99;
  assert.throws(()=>parseAlbumBackup(unknownTypography),/unsupported-backup/);
  const copiedProject = restoredAlbumCopy(backedUpProject);
  assert.notEqual(copiedProject.id, backedUpProject.id);
  assert.deepEqual(copiedProject.pages, backedUpProject.pages);
  assert.deepEqual(copiedProject.adaptations, backedUpProject.adaptations);
  assert.throws(() =>
    parseAlbumBackup({ kind: "storybook-ai.manuscript", format: 1 }),
  );
  assert.throws(() => parseAlbumBackup({ ...backup, format: 99 }));
  const brokenBackup = structuredClone(backup);
  brokenBackup.project.pages[0].placements[0].overlays = "invalid";
  assert.throws(() => parseAlbumBackup(brokenBackup));
  const assignedProject = saved();
  assert.deepEqual(
    assignLibraryPanel(
      assignedProject,
      "page",
      "blank-placement",
      originalPanel,
    ),
    assignedProject,
  );
  assert.equal(
    assignLibraryPanel(
      assignedProject,
      "page",
      "manual-placement",
      originalPanel,
    ),
    assignedProject,
  );
  const unusedPanel = assignedProject.panels.find(
    (p) => p.id !== originalPanel,
  );
  const withManualImage = assignLibraryPanel(
    assignedProject,
    "page",
    "manual-placement",
    unusedPanel.id,
  );
  assert.deepEqual(
    withManualImage.pages[0].placements[1].image,
    assignedProject.pages[0].placements[1].image,
  );
  const manualImage = saved().pages[0].placements[1].image;
  await user.selectOptions(
    placementRows[1].querySelector(".storyboard-link-select"),
    originalPlan,
  );
  assert.deepEqual(saved().pages[0].placements[1].image, manualImage);
  assert.equal(document.querySelectorAll(".panel-corner-handle").length, 0);
  const drawn = document.querySelectorAll(".drawn-panel")[1];
  await user.click(drawn);
  assert.equal(document.querySelectorAll(".panel-corner-handle").length, 4);
  assert.ok(document.querySelector(".layout-snap-grid"));
  const grid = document.querySelector(".layout-panels");
  grid.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 300,
    bottom: 500,
    width: 300,
    height: 500,
    toJSON() {},
  });
  const initialRect = saved().pages[0].placements[1];
  const handle = document.querySelector(".corner-bottom-right");
  fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(window, { clientX: 202, clientY: 302 });
  fireEvent.pointerUp(window);
  const resized = saved().pages[0].placements[1];
  assert.equal(resized.width, 2);
  assert.equal(resized.height, 3);
  assert.equal(resized.id, initialRect.id);
  assert.equal(resized.readingOrder, initialRect.readingOrder);
  assert.deepEqual(resized.image, initialRect.image);
  assert.deepEqual(resized.overlays, initialRect.overlays);
  fireEvent.keyDown(document.querySelector(".corner-top-left"), {
    key: "ArrowLeft",
  });
  assert.equal(saved().pages[0].placements[1].x, 1); // overlap with adjacent panel is rejected
  fireEvent.pointerDown(document.querySelector(".corner-bottom-right"), {
    button: 0,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(window, { clientX: 1000, clientY: 1000 });
  assert.equal(saved().pages[0].placements[1].height, 5);
  fireEvent.keyDown(window, { key: "Escape" });
  assert.equal(saved().pages[0].placements[1].height, 3);
  await user.click(document.querySelector(".layout-canvas"));
  assert.equal(document.querySelectorAll(".panel-corner-handle").length, 0);
  assert.equal(document.querySelector(".layout-snap-grid"), null);
  await user.dblClick(document.querySelectorAll(".drawn-panel")[0]);
  const oldOverlay = saved().pages[0].placements[0].overlays[0];
  const defaults = document.querySelector(".panel-editor-tools > details");
  await user.click(defaults.querySelector("summary"));
  const speechDefaults = defaults.querySelector("details");
  await user.click(speechDefaults.querySelector("summary"));
  await user.click(within(speechDefaults).getByRole("combobox", {name:"Font",exact:true}));
  await user.click(within(speechDefaults).getByRole("option", {name:"Permanent Marker",exact:true}));
  fireEvent.change(within(speechDefaults).getByLabelText("Textstorlek (pt)"), {
    target: { value: "12" },
  });
  fireEvent.change(within(speechDefaults).getByLabelText("Rundning"), {
    target: { value: "80" },
  });
  await user.selectOptions(
    within(speechDefaults).getByLabelText("Textvikt"),
    "700",
  );
  await user.selectOptions(
    within(speechDefaults).getByLabelText("Textjustering"),
    "left",
  );
  await user.click(
    document.querySelector(".panel-editor-add-actions button.primary-button"),
  );
  const createdText = saved().pages[0].placements[0].overlays.at(-1);
  assert.deepEqual(saved().pages[0].placements[0].overlays[0], oldOverlay);
  const { readProjects } = await import(
    pathToFileURL(join(compiledRoot, "project.mjs"))
  );
  assert.equal(readProjects()[0].overlayDefaults.speech.fontSize, 12);
  assert.equal(createdText.fontSize, 12);
  assert.equal(createdText.fontFamily, "Permanent Marker, cursive");
  assert.equal(createdText.fontWeight, 700);
  assert.equal(createdText.roundness, 80);
  assert.equal(createdText.textAlign, "left");
  const properties = document.querySelector(".selected-panel-tool");
  const speechSurface = document.querySelectorAll('.panel-editor-stage .overlay-drag-surface')[saved().pages[0].placements[0].overlays.length-1];
  const mixedSidebar=properties.querySelector('textarea');
  fireEvent.change(mixedSidebar,{target:{value:'Small BIG small'}});
  mixedSidebar.focus();mixedSidebar.setSelectionRange(6,9);fireEvent.select(mixedSidebar);
  fireEvent.change(within(properties).getByLabelText('Storlek (pt)'),{target:{value:'24'}});
  await user.selectOptions(within(properties).getByLabelText('Vikt'),'400');
  await user.click(within(properties).getByRole('combobox',{name:'Font',exact:true}));
  await user.click(within(properties).getByRole('option',{name:'Comic Neue',exact:true}));
  const mixedSaved=structuredClone(saved().pages[0].placements[0].overlays.at(-1));
  assert.equal(mixedSaved.fontSize,12,'selection formatting does not change base size');
  assert.deepEqual(mixedSaved.textStyles,[{start:6,end:9,fontSize:24,fontWeight:400,fontFamily:'Comic Neue, sans-serif'}]);
  assert.ok(document.querySelector('.panel-editor-stage .rich-overlay-text'));
  assert.deepEqual(readProjects()[0].pages[0].placements[0].overlays.at(-1).textStyles,mixedSaved.textStyles);
  assert.deepEqual(parseAlbumBackup(packAlbumBackup(saved())).pages[0].placements[0].overlays.at(-1).textStyles,mixedSaved.textStyles);
  const invalidRuns=structuredClone(packAlbumBackup(saved()));invalidRuns.project.pages[0].placements[0].overlays.at(-1).textStyles[0].end=999;
  assert.throws(()=>parseAlbumBackup(invalidRuns),/invalid-backup/);
  fireEvent.doubleClick(speechSurface);
  let richInput=screen.getByRole('textbox',{name:'Redigera text i bubblan',exact:true});
  assert.equal(richInput.getAttribute('contenteditable'),'true');
  assert.equal(richInput.querySelectorAll('span').length,3);
  assert.equal(richInput.querySelectorAll('span')[1].style.fontWeight,'400');
  const directSelection=document.createRange();directSelection.selectNodeContents(richInput.querySelectorAll('span')[1]);window.getSelection().removeAllRanges();window.getSelection().addRange(directSelection);fireEvent.mouseUp(richInput);
  assert.ok(within(properties).getByText(/Formaterar markerad text/));
  fireEvent.change(within(properties).getByLabelText('Storlek (pt)'),{target:{value:'28'}});
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).textStyles[0].fontSize,28,'selection directly in bubble controls local typography');
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).fontSize,12);
  fireEvent.keyDown(richInput,{key:'Escape'});
  assert.deepEqual(saved().pages[0].placements[0].overlays.at(-1).textStyles,mixedSaved.textStyles);
  fireEvent.doubleClick(speechSurface);richInput=screen.getByRole('textbox',{name:'Redigera text i bubblan',exact:true});
  richInput.textContent='Small BIG! small';fireEvent.input(richInput);
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).textStyles[0].end,10,'inserted text inherits local format');
  fireEvent.keyDown(richInput,{key:'Escape'});
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).text,'Small BIG small');
  assert.deepEqual(saved().pages[0].placements[0].overlays.at(-1).textStyles,mixedSaved.textStyles,'Escape restores text and formatting');
  fireEvent.doubleClick(speechSurface);
  richInput=screen.getByRole('textbox',{name:'Redigera text i bubblan',exact:true});
  const richRange=document.createRange();richRange.selectNodeContents(richInput);window.getSelection().removeAllRanges();window.getSelection().addRange(richRange);
  fireEvent.paste(richInput,{clipboardData:{getData:type=>type==='text/plain'?'Safe <tag>\nSecond':'<img src=x onerror=bad>'}});
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).text,'Safe <tag>\nSecond');
  assert.equal(richInput.querySelector('img'),null,'paste stores text without HTML');
  fireEvent.keyDown(richInput,{key:'Escape'});
  const baseFormatButton=within(properties).queryByRole('button',{name:'Ändra grundformatet',exact:true});if(baseFormatButton)await user.click(baseFormatButton);
  await user.click(within(properties).getByRole('button',{name:'Återställ textformatering',exact:true}));
  fireEvent.change(mixedSidebar,{target:{value:createdText.text}});
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).textStyles,undefined);
  fireEvent.pointerDown(speechSurface,{button:0,clientX:0,clientY:0});
  fireEvent.pointerUp(window);
  assert.equal(document.querySelector('.inline-overlay-editor'),null,'a single click still selects without typing');
  fireEvent.doubleClick(speechSurface);
  let inlineInput=screen.getByRole('textbox',{name:'Redigera text i bubblan',exact:true});
  assert.equal(document.activeElement,inlineInput);
  assert.equal(inlineInput.style.fontFamily,createdText.fontFamily);
  assert.equal(inlineInput.style.fontWeight,String(createdText.fontWeight));
  assert.equal(inlineInput.style.textAlign,createdText.textAlign);
  assert.equal(speechSurface.querySelector('text'),null,'SVG text is hidden while its HTML editor is active');
  assert.equal(document.querySelector('.overlay-resize-grip'),null,'typing hides resize handles');
  await user.keyboard('Direkt i bubblan{Enter}Andra raden');
  assert.equal(inlineInput.value,'Direkt i bubblan\nAndra raden','Enter inserts a newline');
  assert.equal(properties.querySelector('textarea').value,inlineInput.value,'sidebar reflects inline edits');
  assert.equal(readProjects()[0].pages[0].placements[0].overlays.at(-1).text,inlineInput.value,'inline edits use local project saving');
  fireEvent.pointerDown(inlineInput,{button:0,clientX:10,clientY:10});
  fireEvent.pointerMove(window,{clientX:40,clientY:40});
  fireEvent.pointerUp(window);
  assert.deepEqual({...saved().pages[0].placements[0].overlays.at(-1),text:createdText.text},createdText,'typing and text selection preserve geometry and style');
  await user.keyboard('{Escape}');
  assert.equal(document.querySelector('.inline-overlay-editor'),null);
  assert.ok(document.querySelector('.panel-editor-modal'),'Escape cancels text without closing the modal');
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).text,createdText.text);
  assert.equal(properties.querySelector('textarea').value,createdText.text);
  fireEvent.doubleClick(speechSurface);
  inlineInput=screen.getByRole('textbox',{name:'Redigera text i bubblan',exact:true});
  fireEvent.change(inlineInput,{target:{value:'En sparad replik\n\nMed tom rad'}});
  fireEvent.pointerDown(properties.querySelector('textarea'));
  assert.equal(document.querySelector('.inline-overlay-editor'),null,'clicking outside commits text');
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).text,'En sparad replik\n\nMed tom rad');
  assert.ok(speechSurface.querySelector('text'),'SVG text returns after editing');
  await user.click(within(properties).getByRole("combobox", {name:uiText("sv","font"),exact:true}));
  await user.click(within(properties).getByRole("option", {name:"Comic Neue",exact:true}));
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).fontFamily,"Comic Neue, sans-serif");
  fireEvent.change(properties.querySelector("textarea"), {
    target: { value: "First\n\nSecond" },
  });
  await user.selectOptions(
    within(properties).getByLabelText("Textjustering"),
    "right",
  );
  await user.selectOptions(within(properties).getByLabelText("Typ"),"thought");
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).type,"thought");
  fireEvent.doubleClick(speechSurface);
  inlineInput=screen.getByRole('textbox',{name:'Redigera text i bubblan',exact:true});
  fireEvent.change(inlineInput,{target:{value:''}});
  fireEvent.blur(inlineInput);
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).text,'','empty bubble text can be committed');
  fireEvent.change(properties.querySelector('textarea'),{target:{value:'First\n\nSecond'}});
  assert.ok(document.querySelector(".panel-editor-stage .thought-trail"));
  assert.ok(document.querySelectorAll(".panel-editor-stage .thought-trail circle").length>=1);
  assert.ok(document.querySelector(".overlay-tail-grip"));
  fireEvent.change(within(properties).getByLabelText("Startbredd"),{target:{value:"85"}});
  fireEvent.change(within(properties).getByLabelText("Böjning"),{target:{value:"-45"}});
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).thoughtTailWidth,85);
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).thoughtTailCurve,-45);

  const overlaySvg=document.querySelector(".panel-editor-stage > svg");
  overlaySvg.getBoundingClientRect=()=>({left:0,top:0,width:300,height:300});
  const beforeRootDrag=saved().pages[0].placements[0].overlays.at(-1);
  const root=bubbleTailStart(beforeRootDrag);
  fireEvent.pointerDown(document.querySelector(".overlay-tail-start-grip"),{clientX:root.x*3,clientY:root.y*3});
  fireEvent.pointerMove(window,{clientX:(beforeRootDrag.x+beforeRootDrag.width/2)*3,clientY:(beforeRootDrag.y-10)*3});
  fireEvent.pointerUp(window);
  const topRoot=saved().pages[0].placements[0].overlays.at(-1);
  assert.ok(Math.abs(topRoot.tailStartAngle+Math.PI/2)<1e-8);
  assert.equal(topRoot.tailX,beforeRootDrag.tailX);
  assert.equal(topRoot.tailY,beforeRootDrag.tailY);
  assert.ok(bubbleTailStart(topRoot).y<topRoot.y+topRoot.height*.2);
  await user.selectOptions(within(properties).getByLabelText("Typ"),"speech");
  const speechBefore=saved().pages[0].placements[0].overlays.at(-1),speechRoot=bubbleTailStart(speechBefore);
  fireEvent.pointerDown(document.querySelector(".overlay-tail-start-grip"),{clientX:speechRoot.x*3,clientY:speechRoot.y*3});
  fireEvent.pointerMove(window,{clientX:(speechBefore.x-10)*3,clientY:(speechBefore.y+speechBefore.height/2)*3});
  fireEvent.pointerUp(window);
  const speechAfter=saved().pages[0].placements[0].overlays.at(-1);
  assert.ok(Math.abs(Math.abs(speechAfter.tailStartAngle)-Math.PI)<1e-8);
  assert.ok(bubbleTailStart(speechAfter).x<speechAfter.x+speechAfter.width*.1);
  assert.equal(speechAfter.tailX,speechBefore.tailX);
  assert.equal(speechAfter.tailY,speechBefore.tailY);
  const resizedSpeech={...speechAfter,width:speechAfter.width*1.2};
  assert.ok(bubbleTailStart(resizedSpeech).x<resizedSpeech.x+resizedSpeech.width*.1);
  await user.selectOptions(within(properties).getByLabelText("Typ"),"thought");
  const changedText = saved().pages[0].placements[0].overlays.at(-1);
  assert.equal(changedText.text, "First\n\nSecond");
  assert.equal(changedText.textAlign, "center");
  assert.equal(saved().overlayDefaults.speech.textAlign, "left");
  await user.selectOptions(within(properties).getByLabelText("Typ"),"sfx");
  const sfxBefore=saved().pages[0].placements[0].overlays.at(-1);
  await user.click(within(properties).getByRole("button",{name:"Explosion",exact:true}));
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).sfxShapeId,"burst");
  assert.ok(document.querySelector('.panel-editor-stage [data-sfx-shape="burst"] path'));
  fireEvent.doubleClick(speechSurface);
  inlineInput=screen.getByRole('textbox',{name:'Redigera text i bubblan',exact:true});
  fireEvent.change(inlineInput,{target:{value:'BANG!'}});
  fireEvent.keyDown(inlineInput,{key:'Escape'});
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).text,sfxBefore.text,'SFX editing can be cancelled');
  await user.click(within(properties).getByLabelText("Visa text"));
  fireEvent.change(within(properties).getByLabelText("Rotation (grader)"),{target:{value:"25"}});
  const sfxAfter=saved().pages[0].placements[0].overlays.at(-1);
  assert.equal(sfxAfter.sfxTextHidden,true);
  assert.equal(sfxAfter.text,sfxBefore.text);
  assert.equal(sfxAfter.rotation,25);
  assert.equal(sfxAfter.id,sfxBefore.id);
  await user.click(within(properties).getByRole("button",{name:"Fartstreck",exact:true}));
  assert.equal(saved().pages[0].placements[0].overlays.at(-1).sfxShapeId,"speed");
  assert.ok(document.querySelector('.panel-editor-stage [data-sfx-shape="speed"] path[fill="none"]'));

  await user.click(
    within(document.querySelector(".panel-editor-modal header")).getByRole(
      "button",
      { name: "Stäng", exact: true },
    ),
  );
  const freeCell = document.querySelectorAll(".grid-cell")[9];
  fireEvent.pointerDown(freeCell, { button: 0 });
  fireEvent.pointerUp(document.querySelector(".construction-grid"));
  fireEvent.click(freeCell);
  const newPlacement = saved().pages[0].placements.at(-1);
  assert.equal(
    screen.getByLabelText("Bildruta på sidan").value,
    newPlacement.id,
  );
  assert.equal(document.querySelectorAll(".panel-corner-handle").length, 4);
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
  await waitFor(() => assert.ok(screen.queryByText(/Projektet kunde inte sparas/) === null));
  const beforeDelete = saved();
  const removedId = beforeDelete.adaptations[0].beats[0].id;
  await user.click(
    screen.getByRole("button", { name: "Ta bort beat", exact: true }),
  );
  assert.equal(
    saved().adaptations[0].beats.length,
    beforeDelete.adaptations[0].beats.length - 1,
  );
  assert.ok(!saved().adaptations[0].beats.some((b) => b.id === removedId));
  assert.equal(saved().source.textSnapshot, beforeDelete.source.textSnapshot);
  assert.deepEqual(
    saved().adaptations[0].panelPlans.map((p) => p.image),
    beforeDelete.adaptations[0].panelPlans.map((p) => p.image),
  );
  assert.ok(
    saved().adaptations[0].panelPlans.every(
      (p) => !p.sourceBeatIds.includes(removedId),
    ),
  );
  assert.ok(!document.querySelector(`[data-beat-ids~="${removedId}"]`));
  await user.click(
    screen.getByRole("button", { name: "Ångra borttagning", exact: true }),
  );
  const restored = saved();
  assert.deepEqual(restored.adaptations, beforeDelete.adaptations);
  assert.deepEqual(restored.pages, beforeDelete.pages);
  assert.ok(document.querySelector(`[data-beat-ids~="${removedId}"]`));
  await user.click(
    screen.getByRole("button", { name: "Ta bort beat", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Rubrik"), {
    target: { value: "Edit remaining beat" },
  });
  assert.equal(
    screen.queryByRole("button", { name: "Ångra borttagning", exact: true }),
    null,
  );
  await user.click(
    screen.getByRole("button", { name: "Ta bort beat", exact: true }),
  );
  assert.equal(saved().adaptations[0].beats.length, 0);
  assert.equal(
    screen.queryByRole("button", { name: "Ta bort beat", exact: true }),
    null,
  );
  assert.equal(
    saved().adaptations[0].panelPlans.length,
    beforeDelete.adaptations[0].panelPlans.length,
  );
  await user.click(screen.getByRole("button", { name: "Sidor", exact: true }));
  window.confirm = () => true;
  await user.click(
    screen.getByRole("button", { name: "Radera sida", exact: true }),
  );
  assert.equal(saved().pages.length, 0);
  assert.ok(screen.getByRole("region", { name: "Bildbibliotek" }));
  assert.equal(document.querySelector(".layout-canvas"), null);
  await user.click(
    screen.getAllByRole("button", { name: "Ny sida", exact: true })[0],
  );
  assert.equal(saved().pages.length, 1);
  assert.ok(document.querySelector(".layout-canvas"));
  // Compact grid controls persist manual mode; header arrows select pages without reordering.
  const compactGrid=screen.getByRole('group',{name:'Sidans rutnät',exact:true});
  assert.equal(within(compactGrid).getByRole('spinbutton',{name:'Kolumner'}).value,'3');
  assert.equal(within(compactGrid).getByRole('spinbutton',{name:'Rader'}).value,'5');
  assert.ok(within(compactGrid).getByText('(Preset)',{exact:true}));
  assert.equal(document.querySelector('.project-sidebar-head'),null);
  assert.equal(document.querySelector('.page-context-settings h3').textContent,'Sidinställningar');
  assert.equal(document.querySelector('.page-context-settings .preset-select'),null);
  assert.ok(document.querySelector('.page-canvas-header .page-delete-button svg'));
  assert.equal(screen.queryByRole('button',{name:'Föregående sida',exact:true}),null);
  assert.equal(screen.queryByRole('button',{name:'Nästa sida',exact:true}),null);
  await user.click(within(compactGrid).getByRole('button',{name:'Öka kolumner',exact:true}));
  assert.equal(saved().pages[0].gridColumns,4);
  assert.equal(saved().pages[0].gridMode,'custom');
  assert.ok(within(compactGrid).getByText('(Custom)',{exact:true}));
  await user.click(within(compactGrid).getByRole('button',{name:'Minska kolumner',exact:true}));
  assert.equal(saved().pages[0].gridColumns,3);
  assert.equal(readProjects()[0].pages[0].gridMode,'custom');
  assert.equal(parseAlbumBackup(packAlbumBackup(saved())).pages[0].gridMode,'custom');
  const invalidGridMode=structuredClone(packAlbumBackup(saved()));
  invalidGridMode.project.pages[0].gridMode='other';
  assert.throws(()=>parseAlbumBackup(invalidGridMode),/invalid-backup/);
  const firstPageId=saved().pages[0].id;
  await user.click(screen.getByRole('button',{name:'Ny sida',exact:true}));
  const pagesBeforeNavigation=structuredClone(saved().pages);
  await user.click(screen.getByRole('button',{name:'Nästa sida',exact:true}));
  assert.equal(document.querySelector('.page-canvas-header h2').textContent,'Sid 2');
  assert.equal(screen.queryByRole('button',{name:'Nästa sida',exact:true}),null);
  assert.ok(screen.getByText('(Preset)',{exact:true}));
  assert.deepEqual(saved().pages,pagesBeforeNavigation);
  await user.click(screen.getByRole('button',{name:'Föregående sida',exact:true}));
  assert.equal(document.querySelector('.page-canvas-header h2').textContent,'Sid 1');
  assert.ok(screen.getByText('(Custom)',{exact:true}));
  assert.deepEqual(saved().pages,pagesBeforeNavigation);
  await user.click(screen.getByRole('button',{name:'Nästa sida',exact:true}));
  await user.click(screen.getByRole('button',{name:'Radera sida',exact:true}));
  assert.equal(saved().pages.length,1);
  assert.equal(saved().pages[0].id,firstPageId);
  assert.equal(document.querySelector('.page-canvas-header h2').textContent,'Sid 1');
  // A full-page layer uses the existing editor without adding layout frames.
  const backgroundStyles = document.createElement('style');
  backgroundStyles.textContent = readFileSync(join(sourceRoot,'pageBackground.css'),'utf8');
  document.head.append(backgroundStyles);
  const framesBeforeBackground = saved().pages[0].placements;
  await user.click(document.querySelector(".page-background-controls summary"));
  assert.equal(saved().pages[0].background,undefined);
  await user.upload(screen.getByLabelText("Ladda upp bakgrundsbild",{exact:true,selector:"input"}),new window.File(["direct background"],"direct-background.png",{type:"image/png"}));
  await screen.findByLabelText("Byt bakgrundsbild",{exact:true,selector:"input"});
  const directBackgroundId=saved().pages[0].background.id;
  assert.equal(saved().pages[0].background.image.name,"direct-background.png");
  const backgroundPicker = document.querySelector('.page-background-image-picker');
  assert.equal(backgroundPicker.querySelector('img').getAttribute('alt'), 'direct-background.png');
  assert.equal(backgroundPicker.querySelector('img').getAttribute('src'), saved().pages[0].background.image.dataUrl);
  assert.equal(backgroundPicker.querySelector('input').value, '');
  assert.equal(window.getComputedStyle(backgroundPicker.querySelector('input')).display, 'none');
  assert.ok(within(backgroundPicker).getByRole('button', {name:'Byt bakgrundsbild',exact:true}).querySelector('svg'));
  assert.ok(within(backgroundPicker).getByRole('button', {name:'Ta bort bakgrundsbild',exact:true}).querySelector('svg'));
  assert.ok(document.querySelector('.page-background-actions').contains(screen.getByRole('button',{name:'Välj från bildbiblioteket',exact:true})));
  assert.deepEqual(saved().pages[0].placements,framesBeforeBackground);
  assert.ok(document.querySelector(".page-background-layer img"));
  await user.click(screen.getByRole("button",{name:"Redigera bakgrund och text",exact:true}));
  const directEditor=document.querySelector(".panel-editor-modal");
  await user.click(within(directEditor.querySelector(".panel-editor-add-actions")).getByRole("button",{name:"Lägg till textruta",exact:true}));
  const directBackgroundOverlays=structuredClone(saved().pages[0].background.overlays);
  const firstLinkBubble=saved().pages[0].background.overlays.at(-1);
  await user.click(within(directEditor.querySelector(".panel-editor-add-actions")).getByRole("button",{name:"Lägg till textruta",exact:true}));
  const secondLinkBubble=saved().pages[0].background.overlays.at(-1);
  await user.selectOptions(screen.getByLabelText('Koppla till'),firstLinkBubble.id);
  assert.deepEqual(saved().pages[0].background.overlays.at(-1).bubbleLinks,[{targetId:firstLinkBubble.id,width:20}]);
  assert.ok(directEditor.querySelector('.connected-bubble-outline'));
  const widthControl=screen.getByLabelText(/Förbindelsens bredd/);
  fireEvent.change(widthControl,{target:{value:'35'}});
  assert.equal(saved().pages[0].background.overlays.at(-1).bubbleLinks[0].width,35);
  const linkedBackup=JSON.parse(JSON.stringify(packAlbumBackup(saved())));
  assert.deepEqual(parseAlbumBackup(linkedBackup).pages[0].background.overlays,saved().pages[0].background.overlays);
  assert.deepEqual(readProjects()[0].pages[0].background.overlays,saved().pages[0].background.overlays);
  const brokenLinks=structuredClone(linkedBackup);brokenLinks.project.pages[0].background.overlays.at(-1).bubbleLinks[0].targetId='missing';
  assert.throws(()=>parseAlbumBackup(brokenLinks),/invalid-backup/);
  await user.click(screen.getByRole('button',{name:'Koppla loss bubblan',exact:true}));
  assert.equal(directEditor.querySelector('.connected-bubble-outline'),null);
  await user.selectOptions(screen.getByLabelText('Koppla till'),firstLinkBubble.id);
  const linkedInput=directEditor.querySelectorAll('.overlay-drag-surface')[saved().pages[0].background.overlays.length-1];
  fireEvent.doubleClick(linkedInput);
  const linkedText=screen.getByRole('textbox',{name:'Redigera text i bubblan',exact:true});
  fireEvent.change(linkedText,{target:{value:'Connected text'}});fireEvent.blur(linkedText);
  assert.equal(saved().pages[0].background.overlays.find(o=>o.id===firstLinkBubble.id).text,firstLinkBubble.text,'connected text remains independent');
  await user.selectOptions(within(directEditor.querySelector('.selected-panel-tool')).getByLabelText('Typ'),'caption');
  assert.equal(directEditor.querySelector('.connected-bubble-outline'),null,'changing type disconnects incompatible bubbles');
  await user.selectOptions(within(directEditor.querySelector('.selected-panel-tool')).getByLabelText('Typ'),'speech');
  await user.selectOptions(screen.getByLabelText('Koppla till'),firstLinkBubble.id);
  await user.click(within(directEditor.querySelector('.panel-properties-heading')).getByRole('button',{name:'Ta bort',exact:true}));
  assert.equal(saved().pages[0].background.overlays.some(o=>o.id===secondLinkBubble.id),false);
  assert.deepEqual(saved().pages[0].background.overlays,directBackgroundOverlays,'deleting connected bubble preserves partner and clears links');

  await user.click(within(directEditor.querySelector("header")).getByRole("button",{name:"Stäng",exact:true}));
  await user.upload(screen.getByLabelText("Byt bakgrundsbild",{exact:true,selector:"input"}),new window.File(["replacement background"],"replacement.png",{type:"image/png"}));
  await waitFor(()=>assert.equal(saved().pages[0].background.image.name,"replacement.png"));
  assert.equal(saved().pages[0].background.id,directBackgroundId);
  assert.deepEqual(saved().pages[0].background.overlays,directBackgroundOverlays);
  assert.deepEqual(saved().pages[0].placements,framesBeforeBackground);
  await user.click(screen.getByRole('button',{name:'Ta bort bakgrundsbild',exact:true}));
  assert.equal(saved().pages[0].background.image,undefined);
  assert.equal(saved().pages[0].background.id,directBackgroundId);
  assert.deepEqual(saved().pages[0].background.overlays,directBackgroundOverlays);
  assert.deepEqual(saved().pages[0].placements,framesBeforeBackground);
  assert.equal(document.querySelector('.page-background-thumbnail'),null);
  assert.ok(screen.getByRole('button',{name:'Ladda upp bakgrundsbild',exact:true}));
  assert.equal(screen.queryByRole("button",{name:"Ta bort bakgrund",exact:true}),null);

  await user.click(screen.getByRole("button", {name:"Välj från bildbiblioteket",exact:true}));
  assert.equal(screen.getByLabelText("Bildruta på sidan").value,"__background__");
  assert.deepEqual(saved().pages[0].placements,framesBeforeBackground);
  const backgroundLibrary = document.querySelector(".panel-library");
  const backgroundCard = [...backgroundLibrary.querySelectorAll("button")].find(button=>!button.disabled && button.classList.contains("panel-library-card"));
  assert.ok(backgroundCard);
  await user.click(backgroundCard);
  assert.ok(saved().pages[0].background.panelId);
  assert.deepEqual(saved().pages[0].placements,framesBeforeBackground);
  await user.click(screen.getByRole("button",{name:"Redigera bakgrund och text",exact:true}));
  let backgroundEditor = document.querySelector(".panel-editor-modal");
  assert.ok(backgroundEditor.textContent.includes("Bakgrund"));
  await user.click(within(backgroundEditor.querySelector('.panel-image-controls')).getByRole('button',{name:'Ta bort bild',exact:true}));
  const backgroundUpload = backgroundEditor.querySelector('input[type="file"]');
  assert.ok(backgroundUpload);
  await user.upload(backgroundUpload,new window.File(["synthetic image"],"background.png",{type:"image/png"}));
  await screen.findByRole("button",{name:"Lägg till SFX",exact:true});
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(saved().pages[0].background.image.name,"background.png");
  assert.equal(within(backgroundEditor).queryByLabelText("Passning"),null);
  fireEvent.change(within(backgroundEditor).getByLabelText(/^Zoom/),{target:{value:"150"}});
  fireEvent.change(within(backgroundEditor).getByLabelText("X-position (%)"),{target:{value:"25"}});
  fireEvent.change(within(backgroundEditor).getByLabelText("Y-position (%)"),{target:{value:"-10"}});
  assert.equal(saved().pages[0].background.image.fit,"cover");
  assert.equal(saved().pages[0].background.image.zoom,1.5);
  assert.equal(saved().pages[0].background.image.offsetX,25);
  assert.equal(saved().pages[0].background.image.offsetY,-10);
  await user.click(within(backgroundEditor.querySelector(".panel-editor-add-actions")).getByRole("button",{name:"Lägg till textruta",exact:true}));
  const backgroundText = backgroundEditor.querySelector("textarea");
  fireEvent.change(backgroundText,{target:{value:"Text direkt på sidan\nAndra raden"}});
  assert.equal(saved().pages[0].background.overlays.at(-1).text,"Text direkt på sidan\nAndra raden");
  fireEvent.doubleClick(backgroundEditor.querySelectorAll('.overlay-drag-surface')[saved().pages[0].background.overlays.length-1]);
  inlineInput=screen.getByRole('textbox',{name:'Redigera text i bubblan',exact:true});
  fireEvent.change(inlineInput,{target:{value:'Direktredigerad bakgrundstext'}});
  fireEvent.blur(inlineInput);
  assert.equal(saved().pages[0].background.overlays.at(-1).text,'Direktredigerad bakgrundstext');
  assert.equal(backgroundText.value,'Direktredigerad bakgrundstext');
  assert.deepEqual(saved().pages[0].placements,framesBeforeBackground);
  await user.click(within(backgroundEditor.querySelector("header")).getByRole("button",{name:"Stäng",exact:true}));
  assert.ok(document.querySelector(".page-background-layer img"));
  const backgroundSaved = saved().pages[0].background;
  assert.deepEqual(readProjects()[0].pages[0].background,backgroundSaved);
  const backgroundTarget=[...document.querySelectorAll('.background-text-target')].find(e=>e.getAttribute('aria-label').includes('Direktredigerad bakgrundstext'));
  assert.ok(backgroundTarget.querySelector('rect[fill="transparent"]'),'the full text box catches clicks between letters');
  fireEvent.pointerDown(backgroundTarget,{button:0});
  fireEvent.pointerUp(backgroundTarget);
  assert.equal(document.querySelector('.layout-canvas').classList.contains('is-drawing'),false);
  fireEvent.click(backgroundTarget);
  assert.equal(document.querySelector('.selected-panel-tool textarea').value,'Direktredigerad bakgrundstext','clicking background text selects the correct text in the editor');
  assert.deepEqual(saved().pages[0].placements,framesBeforeBackground,'background text clicks do not create frames');
  await user.click(within(document.querySelector('.panel-editor-modal header')).getByRole('button',{name:'Stäng',exact:true}));
  fireEvent.keyDown(backgroundTarget,{key:'Enter'});
  assert.ok(document.querySelector('.panel-editor-modal'),'background text supports keyboard activation');
  await user.click(within(document.querySelector('.panel-editor-modal header')).getByRole('button',{name:'Stäng',exact:true}));
  const {overlapsBackgroundText}=await import(pathToFileURL(join(compiledRoot,'pageBackground.mjs')));
  const {albumPageFormat,layerRect,pageAspect,pageGridMetrics}=await import(pathToFileURL(join(compiledRoot,'pageFormat.mjs')));
  const {libraryDropTarget,dropLibraryPanel}=await import(pathToFileURL(join(compiledRoot,'libraryDrop.mjs')));
  const clickPage=saved().pages[0];
  const blockedCell=[...document.querySelectorAll('.grid-cell')].find((_,i)=>overlapsBackgroundText(saved(),clickPage,{id:'candidate',readingOrder:0,overlays:[],x:i%clickPage.gridColumns,y:Math.floor(i/clickPage.gridColumns),width:1,height:1}));
  assert.ok(blockedCell);
  fireEvent.pointerDown(blockedCell,{button:0});
  fireEvent.pointerUp(document.querySelector('.construction-grid'));
  assert.deepEqual(saved().pages[0].placements,framesBeforeBackground,'drawing over background text creates no panel');
  assert.ok(screen.getByText('Bildrutan överlappar en textruta på bakgrunden. Rita den utanför textrutan eller flytta texten först.'));
  const protectedProject=structuredClone(saved());
  const protectedPage=protectedProject.pages[0];protectedPage.placements=[];
  const protectedLayer={id:'candidate',x:0,y:0,width:1,height:1,readingOrder:1,overlays:[]};
  const protectedFormat=albumPageFormat(protectedProject),protectedBox=layerRect(protectedPage,protectedLayer,protectedFormat),protectedHeight=700/pageAspect(protectedFormat);
  protectedPage.background={...protectedPage.background,panelId:undefined,adaptationPanelPlanId:undefined,overlays:[{id:'protected-text',type:'caption',text:'Protected',rotation:25,x:(protectedBox.x+20)/700*100,y:(protectedBox.y+20)/protectedHeight*100,width:(protectedBox.width-40)/700*100,height:(protectedBox.height-40)/protectedHeight*100}]};
  assert.equal(overlapsBackgroundText(protectedProject,protectedPage,protectedLayer),true,'new frames cannot cover rotated background text');
  assert.equal(overlapsBackgroundText(protectedProject,protectedPage,{...protectedLayer,x:2,y:4}),false,'free areas still allow panels');
  const protectedGrid=pageGridMetrics(protectedPage,protectedFormat);
  assert.equal(libraryDropTarget(protectedProject,protectedPage.id,10,10,protectedGrid),null,'library drop preview rejects protected cells');
  assert.deepEqual(libraryDropTarget(protectedProject,protectedPage.id,2*(protectedGrid.cellWidth+protectedGrid.gapX)+10,4*(protectedGrid.cellHeight+protectedGrid.gapY)+10,protectedGrid),{kind:'new',x:2,y:4});
  protectedProject.panels.push({id:'guard-image',sceneId:'none',order:999,action:'',dialogue:'',narration:'',imagePrompt:'',characterIds:[],image:{name:'test.png',dataUrl:'data:image/png;base64,test'}});
  assert.equal(dropLibraryPanel(protectedProject,protectedPage.id,{kind:'new',x:0,y:0},'guard-image'),null,'direct drops cannot bypass the protection');
  assert.ok(dropLibraryPanel(protectedProject,protectedPage.id,{kind:'new',x:2,y:4},'guard-image'),'free-cell drops continue to work');
  await user.click(screen.getByRole("button",{name:"Ta bort bakgrundsbild",exact:true}));
  assert.equal(saved().pages[0].background.image,undefined);
  assert.equal(saved().pages[0].background.id,backgroundSaved.id);
  assert.deepEqual(saved().pages[0].background.overlays,backgroundSaved.overlays);
  assert.deepEqual(saved().pages[0].placements,framesBeforeBackground);
  // Replace the image so the following download/restore checks cover it too.
  await user.click(screen.getByRole("button",{name:"Redigera bakgrund och text",exact:true}));
  backgroundEditor=document.querySelector(".panel-editor-modal");
  await user.upload(backgroundEditor.querySelector('input[type="file"]'),new window.File(["synthetic image"],"backup-background.png",{type:"image/png"}));
  await new Promise(resolve=>setTimeout(resolve,20));
  await user.click(within(backgroundEditor.querySelector("header")).getByRole("button",{name:"Stäng",exact:true}));
  // Shape presets and 4×4 handles edit geometry without replacing frame contents.
  await user.selectOptions(screen.getByLabelText("Bildruta på sidan"), "");
  if(!document.querySelector('.drawn-panel')){
    const shapePage=saved().pages[0];
    const freeCell=[...document.querySelectorAll('.grid-cell')].find((_,i)=>i%shapePage.gridColumns<shapePage.gridColumns-1&&!overlapsBackgroundText(saved(),shapePage,{...protectedLayer,x:i%shapePage.gridColumns,y:Math.floor(i/shapePage.gridColumns)}));
    assert.ok(freeCell,'shape fixture needs a cell outside background text');
    fireEvent.pointerDown(freeCell,{button:0});
    fireEvent.pointerUp(document.querySelector('.construction-grid'));
  }
  fireEvent.doubleClick(document.querySelector('.drawn-panel'));
  const shapeInitialEditor=document.querySelector('.panel-editor-modal');
  await user.upload(shapeInitialEditor.querySelector('input[type="file"]'),new window.File(['initial shape image'],'shape-initial.png',{type:'image/png'}));
  await waitFor(()=>assert.equal(saved().pages[0].placements[0].image.name,'shape-initial.png'));
  await user.click(within(shapeInitialEditor.querySelector('.panel-editor-add-actions')).getByRole('button',{name:'Lägg till textruta',exact:true}));
  await user.click(within(shapeInitialEditor.querySelector('header')).getByRole('button',{name:'Stäng',exact:true}));
  const shapeFrameBefore=structuredClone(saved().pages[0].placements[0]);
  let shapeFrame=document.querySelector('.drawn-panel');
  await user.click(shapeFrame);
  const shapeSelect=screen.getByLabelText('Rutans form');
  for(const [value,count] of [['diamond',4],['parallelogram',4],['trapezoid',4],['triangle',3]]){
    await user.selectOptions(shapeSelect,value);
    assert.equal(saved().pages[0].placements[0].shapePoints.length,count);
    assert.ok(shapeFrame.classList.contains('is-shaped'));
    assert.ok(shapeFrame.querySelector('.panel-image-frame').style.clipPath.includes('polygon'));
    const {shapePoints,...unchanged}=saved().pages[0].placements[0];
    assert.deepEqual(unchanged,shapeFrameBefore);
  }
  await user.selectOptions(shapeSelect,'diamond');
  await user.click(screen.getByRole('switch',{name:'Fri form',exact:true}));
  assert.equal(shapeFrame.querySelectorAll('.panel-corner-handle').length,0);
  assert.equal(shapeFrame.querySelectorAll('.panel-shape-surface circle').length,25);
  assert.equal(shapeFrame.querySelectorAll('.panel-shape-handle').length,4);
  let formCorner=within(shapeFrame).getByRole('button',{name:'Formhörn 1',exact:true});
  fireEvent.keyDown(formCorner,{key:'ArrowDown'});
  assert.deepEqual(saved().pages[0].placements[0].shapePoints[0],{x:2,y:1});
  assert.equal(shapeSelect.value,'custom');
  const beforeShapeDrag=structuredClone(saved().pages[0].placements[0].shapePoints);
  const shapeSurface=shapeFrame.querySelector('.panel-shape-surface');
  shapeSurface.getBoundingClientRect=()=>({left:100,top:100,width:400,height:400,right:500,bottom:500});
  const captures=[];
  let captured=false;
  formCorner.setPointerCapture=id=>{captures.push(['capture',id]);captured=true;};
  formCorner.hasPointerCapture=()=>captured;
  formCorner.releasePointerCapture=id=>{captures.push(['release',id]);captured=false;};
  fireEvent.pointerDown(formCorner,{button:0,clientX:300,clientY:200});
  fireEvent.pointerMove(window,{clientX:305,clientY:115});
  assert.deepEqual(saved().pages[0].placements[0].shapePoints[0],{x:2,y:0});
  fireEvent.keyDown(window,{key:'Escape'});
  assert.deepEqual(saved().pages[0].placements[0].shapePoints,beforeShapeDrag);
  assert.deepEqual(captures.map(item=>item[0]),['capture','release'],'Escape releases pointer capture');
  fireEvent.pointerDown(formCorner,{button:0,clientX:300,clientY:200});
  fireEvent.pointerMove(window,{clientX:305,clientY:115});
  fireEvent.pointerUp(window);
  assert.deepEqual(saved().pages[0].placements[0].shapePoints[0],{x:2,y:0});
  // A move onto an adjacent corner is rejected.
  fireEvent.pointerDown(formCorner,{button:0,clientX:300,clientY:100});
  fireEvent.pointerMove(window,{clientX:500,clientY:300});
  fireEvent.pointerUp(window);
  assert.deepEqual(saved().pages[0].placements[0].shapePoints[0],{x:2,y:0});
  fireEvent.pointerDown(formCorner,{button:0,clientX:300,clientY:100});
  fireEvent.pointerMove(window,{clientX:200,clientY:100});
  assert.deepEqual(saved().pages[0].placements[0].shapePoints[0],{x:1,y:0});
  fireEvent.pointerCancel(window);
  assert.deepEqual(saved().pages[0].placements[0].shapePoints[0],{x:2,y:0});
  assert.equal(captured,false,'completed and cancelled drags release capture');
  assert.equal(screen.getByRole('switch',{name:'Fri form',exact:true}).checked,true);
  assert.equal(shapeFrame.querySelectorAll('.panel-shape-handle').length,4,'handles remain after repeated edits');
  // A release click on the canvas used to clear selection and reset the mode.
  const beforeModeChange=structuredClone(saved().pages[0].placements[0]);
  fireEvent.click(document.querySelector('.layout-canvas'));
  assert.equal(document.querySelector('.is-layout-selected'),null);
  assert.equal(screen.getByRole('switch',{name:'Fri form',exact:true}).checked,true);
  const panelCount=saved().pages[0].placements.length;
  fireEvent.pointerDown(document.querySelector('.grid-cell'),{button:0});
  fireEvent.pointerUp(document.querySelector('.construction-grid'));
  assert.equal(saved().pages[0].placements.length,panelCount,'free shape does not draw new panels');
  await user.click(shapeFrame);
  assert.equal(shapeFrame.querySelectorAll('.panel-shape-handle').length,4,'reselecting retains free shape mode');
  fireEvent.keyDown(within(shapeFrame).getByRole('button',{name:'Formhörn 2',exact:true}),{key:'ArrowLeft'});
  assert.equal(saved().pages[0].placements[0].shapePoints[1].x,3,'a second corner remains editable');
  fireEvent.keyDown(within(shapeFrame).getByRole('button',{name:'Formhörn 2',exact:true}),{key:'ArrowRight'});
  await user.click(screen.getByRole('switch',{name:'Fri form',exact:true}));
  assert.deepEqual(saved().pages[0].placements[0],beforeModeChange,'switching to normal keeps the edited shape and contents');
  assert.equal(shapeFrame.querySelectorAll('.panel-shape-handle').length,0);
  assert.equal(shapeFrame.querySelectorAll('.panel-corner-handle').length,4);
  const beforeShapedResize=structuredClone(saved().pages[0].placements[0]);
  fireEvent.keyDown(shapeFrame.querySelector('.corner-bottom-right'),{key:'ArrowRight'});
  assert.equal(saved().pages[0].placements[0].width,beforeShapedResize.width+1);
  assert.deepEqual(saved().pages[0].placements[0].shapePoints,beforeShapedResize.shapePoints);
  assert.deepEqual(saved().pages[0].placements[0].overlays,beforeShapedResize.overlays);
  assert.deepEqual(saved().pages[0].placements[0].image,beforeShapedResize.image);
  assert.deepEqual(readProjects()[0].pages[0].placements[0].shapePoints,saved().pages[0].placements[0].shapePoints);
  await user.click(screen.getByRole('switch',{name:'Fri form',exact:true}));
  assert.equal(shapeFrame.querySelectorAll('.panel-shape-surface circle').length,45,'two-cell panel has an 8×4 subdivision grid');
  const wideCorner=within(shapeFrame).getByRole('button',{name:'Formhörn 1',exact:true});
  fireEvent.keyDown(wideCorner,{key:'ArrowLeft'});
  assert.deepEqual(saved().pages[0].placements[0].shapePoints[0],{x:1.5,y:0});
  const wideSurface=shapeFrame.querySelector('.panel-shape-surface');
  wideSurface.getBoundingClientRect=()=>({left:100,top:100,width:400,height:400,right:500,bottom:500});
  fireEvent.pointerDown(wideCorner,{button:0,clientX:250,clientY:100});
  fireEvent.pointerMove(window,{clientX:345,clientY:105});
  assert.deepEqual(saved().pages[0].placements[0].shapePoints[0],{x:2.5,y:0});
  fireEvent.keyDown(window,{key:'Escape'});
  assert.deepEqual(saved().pages[0].placements[0].shapePoints[0],{x:1.5,y:0});
  await user.click(screen.getByRole('switch',{name:'Fri form',exact:true}));
  const {PanelShapeHandles}=await import(pathToFileURL(join(compiledRoot,'PanelShapeControls.mjs')));
  const fullPageGrid=renderToStaticMarkup(React.createElement(PanelShapeHandles,{layer:{...saved().pages[0].placements[0],width:3,height:5},locale:'sv',onChange:()=>{}}));
  assert.equal((fullPageGrid.match(/<circle /g)||[]).length,273,'full 3×5 page has 12×20 subdivisions');
  fireEvent.doubleClick(shapeFrame);
  const shapedEditor=document.querySelector('.panel-editor-modal');
  assert.ok(shapedEditor.querySelector('.panel-editor-stage').classList.contains('is-shaped'));
  assert.ok(shapedEditor.querySelector('.panel-editor-image-layer').style.clipPath.includes('polygon'));
  await user.click(within(shapedEditor).getByRole('button',{name:'Redigera bild',exact:true}));
  fireEvent.doubleClick(shapedEditor.querySelector('.overlay-drag-surface'));
  assert.equal(document.querySelector('.inline-overlay-editor'),null,'image mode does not allow bubble typing');
  const imageStage=shapedEditor.querySelector('.panel-editor-stage');
  imageStage.getBoundingClientRect=()=>({left:0,top:0,width:400,height:200,right:400,bottom:200});
  const panLayer=shapedEditor.querySelector('.panel-editor-image-layer');
  const panImage=panLayer.querySelector('img');
  panLayer.getBoundingClientRect=imageStage.getBoundingClientRect;
  Object.defineProperty(panImage,'naturalWidth',{configurable:true,value:800});
  Object.defineProperty(panImage,'naturalHeight',{configurable:true,value:400});
  fireEvent.load(panImage);
  fireEvent.change(within(shapedEditor).getByLabelText(/^Zoom/),{target:{value:'200'}});
  const frameBeforePan=structuredClone(saved().pages[0].placements[0]);
  fireEvent.pointerDown(panLayer,{button:0,clientX:100,clientY:100});
  fireEvent.pointerMove(window,{clientX:140,clientY:140});
  assert.equal(saved().pages[0].placements[0].image.offsetX,10);
  assert.equal(saved().pages[0].placements[0].image.offsetY,20);
  assert.equal(panImage.style.width,'800px');
  assert.equal(panImage.style.height,'400px');
  assert.equal(panImage.style.left,'-160px');
  assert.equal(panImage.style.top,'-60px');
  assert.equal(panImage.style.transform,'none');
  fireEvent.pointerUp(window);
  fireEvent.pointerDown(panLayer,{button:0,clientX:140,clientY:140});
  fireEvent.pointerMove(window,{clientX:100,clientY:100});
  assert.equal(saved().pages[0].placements[0].image.offsetY,0);
  fireEvent.keyDown(window,{key:'Escape'});
  assert.equal(saved().pages[0].placements[0].image.offsetY,20);
  fireEvent.pointerDown(panLayer,{button:0,clientX:140,clientY:140});
  fireEvent.pointerMove(window,{clientX:140,clientY:100});
  fireEvent.pointerCancel(window);
  assert.equal(saved().pages[0].placements[0].image.offsetY,20);
  fireEvent.change(within(shapedEditor).getByLabelText('Y-position (%)'),{target:{value:'-15'}});
  assert.equal(panImage.style.left,'-160px');
  assert.equal(panImage.style.top,'-130px');
  assert.deepEqual(saved().pages[0].placements[0].shapePoints,frameBeforePan.shapePoints);
  assert.deepEqual(saved().pages[0].placements[0].overlays,frameBeforePan.overlays);
  const zoomBeforeWheel=saved().pages[0].placements[0].image.zoom;
  assert.equal(fireEvent.wheel(panLayer,{deltaY:-100,cancelable:true}),true);
  assert.equal(saved().pages[0].placements[0].image.zoom,zoomBeforeWheel);
  assert.equal(fireEvent.wheel(panLayer,{deltaY:-100,ctrlKey:true,cancelable:true}),false,'Ctrl wheel cancels browser zoom');
  assert.equal(saved().pages[0].placements[0].image.zoom,2.1);
  assert.equal(fireEvent.wheel(panLayer,{deltaY:100,metaKey:true,cancelable:true}),false,'Command wheel cancels browser zoom');
  assert.equal(saved().pages[0].placements[0].image.zoom,2);
  assert.deepEqual(saved().pages[0].placements[0].overlays,frameBeforePan.overlays);
  const offsetsBeforeRotation={x:saved().pages[0].placements[0].image.offsetX,y:saved().pages[0].placements[0].image.offsetY};
  assert.equal(fireEvent.wheel(panLayer,{deltaY:100,altKey:true,cancelable:true}),false);
  assert.equal(saved().pages[0].placements[0].image.rotation,1);
  assert.equal(saved().pages[0].placements[0].image.zoom,2);
  assert.equal(panImage.style.transform,'rotate(1deg)');
  fireEvent.wheel(panLayer,{deltaY:-100,altKey:true,cancelable:true});
  assert.equal(saved().pages[0].placements[0].image.rotation,0);
  fireEvent.change(within(shapedEditor).getByLabelText('Rotation (°)'),{target:{value:'30'}});
  assert.equal(saved().pages[0].placements[0].image.rotation,30);
  assert.equal(readProjects()[0].pages[0].placements[0].image.rotation,30);
  assert.equal(parseAlbumBackup(packAlbumBackup(saved())).pages[0].placements[0].image.rotation,30);
  const badImageRotation=structuredClone(packAlbumBackup(saved()));badImageRotation.project.pages[0].placements[0].image.rotation='bad';
  assert.throws(()=>parseAlbumBackup(badImageRotation),/invalid-backup/);
  assert.deepEqual({x:saved().pages[0].placements[0].image.offsetX,y:saved().pages[0].placements[0].image.offsetY},offsetsBeforeRotation);
  assert.deepEqual(saved().pages[0].placements[0].overlays,frameBeforePan.overlays);
  await user.click(within(shapedEditor).getByRole('button',{name:'Klar med bild',exact:true}));
  fireEvent.wheel(panLayer,{deltaY:-100,ctrlKey:true,cancelable:true});
  assert.equal(saved().pages[0].placements[0].image.zoom,2,'zoom requires active image editing');
  fireEvent.wheel(panLayer,{deltaY:100,altKey:true,cancelable:true});
  assert.equal(saved().pages[0].placements[0].image.rotation,30,'rotation requires active image editing');
  await user.click(within(shapedEditor).getByRole('button',{name:'Redigera bild',exact:true}));
  await user.click(within(shapedEditor).getByRole('button',{name:'Återställ bild',exact:true}));
  assert.equal(saved().pages[0].placements[0].image.rotation,0);
  assert.equal(saved().pages[0].placements[0].image.zoom,1);
  const beforeShapeImage=structuredClone(saved().pages[0].placements[0]);
  assert.equal(shapedEditor.querySelector('.panel-editor-stage > svg').style.display,'none','image mode hides text without removing its data');
  fireEvent.change(within(shapedEditor).getByLabelText(/^Zoom/),{target:{value:'50'}});
  assert.equal(saved().pages[0].placements[0].image.zoom,.5,'numeric zoom can leave space around the image');
  fireEvent.wheel(panLayer,{deltaY:100,ctrlKey:true,cancelable:true});
  assert.equal(saved().pages[0].placements[0].image.zoom,.4,'wheel zoom uses the same range');
  fireEvent.keyDown(window,{key:'Escape'});
  assert.ok(document.querySelector('.panel-editor-modal'),'Escape leaves image mode without closing the editor');
  assert.equal(shapedEditor.querySelector('.panel-editor-stage > svg').style.display,'');
  const imageControls=shapedEditor.querySelector('.panel-image-controls');
  assert.equal(imageControls.querySelectorAll('button').length,2,'two primary image actions outside edit mode');
  assert.equal(shapedEditor.querySelector('.panel-editor-tools .panel-image-controls'),null,'image controls sit below the artwork');
  assert.equal(shapedEditor.querySelector('.panel-editor-tools .panel-source-picker'),null,'the text sidebar contains no image source controls');
  assert.equal(shapedEditor.querySelectorAll('.selected-panel-tool fieldset').length,4,'text, connections, appearance and tail are grouped');
  await user.click(within(imageControls).getByRole('button',{name:'Ta bort bild',exact:true}));
  assert.equal(saved().pages[0].placements[0].image,undefined);
  assert.deepEqual(saved().pages[0].placements[0].overlays,beforeShapeImage.overlays,'removing the image preserves bubbles');
  assert.deepEqual(saved().pages[0].placements[0].shapePoints,beforeShapeImage.shapePoints,'removing the image preserves the frame');
  assert.ok(shapedEditor.querySelector('.panel-editor-dropzone'),'empty frame offers image upload');
  await user.upload(shapedEditor.querySelector('input[type="file"]'),new window.File(['image'],'shaped.png',{type:'image/png'}));
  await waitFor(()=>assert.equal(saved().pages[0].placements[0].image.name,'shaped.png'));
  assert.equal(saved().pages[0].placements[0].image.fit,'cover','replacement starts filling the panel');
  assert.equal(saved().pages[0].placements[0].image.zoom,1);
  assert.deepEqual(saved().pages[0].placements[0].shapePoints,beforeShapeImage.shapePoints);
  assert.deepEqual(saved().pages[0].placements[0].overlays,beforeShapeImage.overlays);
  await user.click(within(shapedEditor.querySelector('header')).getByRole('button',{name:'Stäng',exact:true}));
  const validShapeBackup=packAlbumBackup(saved());
  assert.deepEqual(parseAlbumBackup(validShapeBackup).pages,saved().pages);
  const invalidShapeBackup=structuredClone(validShapeBackup);
  invalidShapeBackup.project.pages[0].placements[0].shapePoints=[{x:0,y:0},{x:4,y:4},{x:4,y:0},{x:0,y:4}];
  assert.throws(()=>parseAlbumBackup(invalidShapeBackup),/invalid-backup/);
  console.log('PASS: form controls, 25 snapping points, keyboard/pointer editing, Escape rollback, crossing rejection, clipped editor, image replacement and shape backup/load.');
  const albumMenuStyles = document.createElement("style");
  const stylesheet = readFileSync(join(sourceRoot,"styles.css"),"utf8");
  albumMenuStyles.textContent = [...stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(match=>match[1].includes(".project-topbar")).map(match=>match[0]).join("\n") + readFileSync(join(sourceRoot,"AlbumMenu.css"),"utf8");
  document.head.append(albumMenuStyles);
  const visibleAlbumMenu = screen.getByRole("navigation",{name:"Albummeny",exact:true});
  assert.equal(window.getComputedStyle(visibleAlbumMenu).display,"flex");
  assert.ok(within(visibleAlbumMenu).getByRole("button",{name:"Backup",exact:true}));
  const albumSections=within(visibleAlbumMenu).getByRole("group",{name:"Projektinnehåll",exact:true});
  assert.deepEqual(within(albumSections).getAllByRole("button").map(button=>button.textContent),["Manus","Adaptering","Karaktärer","Platser","Bildrutor","Sidor"]);
  assert.equal(document.querySelector('.project-side-nav'),null);
  const leftSettings=screen.getByRole("complementary",{name:"Arbetsinställningar",exact:true});
  assert.ok(within(leftSettings).getByRole("region",{name:"Sidinställningar",exact:true}));
  assert.ok(leftSettings.querySelector('.grid-settings'));
  assert.equal(document.querySelector('.page-planner .grid-settings'),null);
  for(const [label,selector] of [["Karaktärer",".library-workspace"],["Platser",".library-workspace"],["Bildrutor",".scene-workspace"],["Sidor",".page-workspace"]]){
    await user.click(within(albumSections).getByRole("button",{name:label,exact:true}));
    assert.ok(document.querySelector(selector));
    assert.equal(within(albumSections).getByRole("button",{name:label,exact:true}).getAttribute('aria-current'),'page');
  }
  albumMenuStyles.remove();
  await user.click(
    screen.getByRole("button", { name: "Albuminställningar", exact: true }),
  );
  const albumDialog = screen.getByRole("dialog", {
    name: "Albuminställningar",
  });
  assert.ok(within(albumDialog).getByLabelText("Albumtitel"));
  fireEvent.change(within(albumDialog).getByLabelText("Albumtitel"), {
    target: { value: "Album menu test" },
  });
  assert.equal(saved().title, "Album menu test");
  fireEvent.change(within(albumDialog).getByLabelText("Kolumner"), {
    target: { value: "4" },
  });
  assert.equal(saved().pageDefaults.gridColumns, 4);
  assert.equal(saved().pages[0].gridColumns, 3);
  const originalPageLayers = structuredClone(saved().pages);
  await user.selectOptions(within(albumDialog).getByLabelText("Format", {exact:true}),"letter");
  await user.selectOptions(within(albumDialog).getByLabelText("Orientering", {exact:true}),"landscape");
  assert.equal(saved().pageFormat.preset,"letter");
  assert.equal(saved().pageFormat.orientation,"landscape");
  assert.deepEqual(saved().pages,originalPageLayers);
  await user.selectOptions(within(albumDialog).getByLabelText("Format", {exact:true}),"custom");
  fireEvent.change(within(albumDialog).getByLabelText("Bredd (mm)"),{target:{value:"170"}});
  fireEvent.change(within(albumDialog).getByLabelText("Höjd (mm)"),{target:{value:"260"}});
  assert.equal(saved().pageFormat.widthMm,170);
  assert.equal(saved().pageFormat.heightMm,260);
  assert.deepEqual(readProjects()[0].pageFormat,saved().pageFormat);
  const formatBackup=packAlbumBackup(saved());
  assert.deepEqual(parseAlbumBackup(formatBackup).pageFormat,saved().pageFormat);
  const invalidFormatBackup=structuredClone(formatBackup);invalidFormatBackup.project.pageFormat.widthMm=-1;
  assert.throws(()=>parseAlbumBackup(invalidFormatBackup),/invalid-backup/);
  fireEvent.keyDown(window, { key: "Escape" });
  assert.equal(screen.queryByRole("dialog"), null);
  await user.click(screen.getByRole("button", {name:"Exportera",exact:true}));
  const exportDialog=screen.getByRole("dialog",{name:"Exportera",exact:true});
  assert.equal(within(exportDialog).getByLabelText("Format",{exact:true}).value,"custom");
  assert.equal(within(exportDialog).getByLabelText("Upplösning (dpi)").value,"300");
  assert.equal(within(exportDialog).getByLabelText("Filformat").value,"pdf");
  const beforeExportSettings=structuredClone(saved());
  await user.selectOptions(within(exportDialog).getByLabelText("Format",{exact:true}),"a4");
  assert.equal(within(exportDialog).getByLabelText("Anpassning till annat format").value,"contain");
  await user.selectOptions(within(exportDialog).getByLabelText("Filformat"),"jpeg");
  assert.equal(within(exportDialog).getByLabelText("JPEG-kvalitet (%)").value,"95");
  await user.click(within(exportDialog).getByLabelText("Sida 1",{exact:true}));
  assert.equal(within(exportDialog).getByRole("button",{name:"Ladda ner export",exact:true}).disabled,true);
  assert.deepEqual(saved(),beforeExportSettings);
  fireEvent.keyDown(window,{key:"Escape"});
  await user.click(screen.getByRole("button", { name: "Backup", exact: true }));
  const originalCreate = URL.createObjectURL,
    originalRevoke = URL.revokeObjectURL,
    originalClick = window.HTMLAnchorElement.prototype.click;
  let downloadedBlob, downloadedName;
  URL.createObjectURL = (blob) => {
    downloadedBlob = blob;
    return "blob:test";
  };
  URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {
    downloadedName = this.download;
  };
  const beforeBackup = saved();
  await user.click(
    screen.getByRole("button", { name: "Ladda ner albumbackup", exact: true }),
  );
  assert.ok(downloadedName.endsWith(".json"));
  assert.deepEqual(
    parseAlbumBackup(JSON.parse(await downloadedBlob.text())),
    beforeBackup,
  );
  assert.deepEqual(saved(), beforeBackup);
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
  window.HTMLAnchorElement.prototype.click = originalClick;
  const beforeRestore = localStorage.getItem("comicbook-ai.projects");
  await user.upload(
    screen.getByLabelText("Välj albumbackup"),
    new window.File(["{}"], "wrong.json", { type: "application/json" }),
  );
  await screen.findByRole("alert");
  assert.equal(localStorage.getItem("comicbook-ai.projects"), beforeRestore);
  assert.equal(
    screen.queryByRole("button", { name: "Öppna som nytt album" }),
    null,
  );
  await user.upload(
    screen.getByLabelText("Välj albumbackup"),
    new window.File(
      [JSON.stringify(packAlbumBackup(beforeBackup))],
      "album.json",
      { type: "application/json" },
    ),
  );
  const restoreButton = await screen.findByRole("button", {
    name: "Öppna som nytt album",
    exact: true,
  });
  const normalSetItem = window.Storage.prototype.setItem;
  window.Storage.prototype.setItem = function (key, value) {
    if (key === "comicbook-ai.projects") throw new Error("Quota exceeded");
    return normalSetItem.call(this, key, value);
  };
  await user.click(restoreButton);
  assert.equal(localStorage.getItem("comicbook-ai.projects"), beforeRestore);
  assert.ok(screen.getByRole("dialog"));
  window.Storage.prototype.setItem = normalSetItem;
  await user.click(restoreButton);
  await waitFor(() => assert.ok(screen.queryByRole("dialog") === null));
  const restoredProjects = JSON.parse(
    localStorage.getItem("comicbook-ai.projects"),
  );
  assert.equal(restoredProjects.length, 2);
  assert.notEqual(restoredProjects[0].id, beforeBackup.id);
  assert.deepEqual(restoredProjects[1], beforeBackup);
  assert.deepEqual(restoredProjects[0].pages, beforeBackup.pages);
  assert.deepEqual(restoredProjects[0].adaptations, beforeBackup.adaptations);
  view.unmount();
  const edgeProject=structuredClone(beforeBackup);
  edgeProject.id='edge-album';edgeProject.title='Diagonaltest';edgeProject.pageFormat={preset:'a4',orientation:'portrait',widthMm:210,heightMm:297};
  const baseFrame=edgeProject.pages[0].placements[0];
  const rightEdgeFrame={...baseFrame,id:'right-edge',x:0,y:0,width:3,height:1,readingOrder:1,shapePoints:[{x:8/3,y:0},{x:4,y:0},{x:4,y:4},{x:2,y:4}]};
  const leftEdgeFrame={...baseFrame,id:'left-edge',x:0,y:0,width:1,height:1,readingOrder:5,shapePoints:undefined};
  edgeProject.pages=[{id:'edge-page',number:1,gridColumns:3,gridRows:5,placements:[rightEdgeFrame,leftEdgeFrame]}];
  localStorage.setItem('comicbook-ai.projects',JSON.stringify([edgeProject]));
  const edgeView=render(React.createElement(App));
  try{
    await user.click(screen.getByRole('button',{name:/Diagonaltest/}));
    await user.click(screen.getByRole('button',{name:'Sidor',exact:true}));
    await user.click(screen.getByLabelText('ruta 5',{exact:true}));
    assert.equal(screen.getByLabelText('Marginal mellan rutor (mm)').value,'2');
    const contentsBefore=structuredClone(saved().pages[0].placements[1]);
    await user.click(screen.getByRole('button',{name:'Passa kanten',exact:true}));
    assert.equal(screen.queryByRole('alert'),null);
    assert.equal(saved().pages[0].placements[1].width,3);
    assert.deepEqual(saved().pages[0].placements[1].image,contentsBefore.image);
    assert.deepEqual(saved().pages[0].placements[1].overlays,contentsBefore.overlays);
    assert.deepEqual(saved().pages[0].placements[0],rightEdgeFrame);
    const sharedHitStyle=document.createElement('style');
    sharedHitStyle.textContent=readFileSync(join(sourceRoot,'panelShape.css'),'utf8');document.head.append(sharedHitStyle);
    const rightHit=screen.getByLabelText('ruta 1',{exact:true}).querySelector('.panel-shape-fill polygon');
    const leftHit=screen.getByLabelText('ruta 5',{exact:true}).querySelector('.panel-shape-fill polygon');
    assert.equal(window.getComputedStyle(rightHit).pointerEvents,'visiblePainted');
    await user.click(rightHit);
    assert.equal(screen.getByLabelText('Grannruta').value,'left-edge');
    await user.click(leftHit);
    assert.equal(screen.getByLabelText('Grannruta').value,'right-edge');
    sharedHitStyle.remove();
    const firstFit=structuredClone(saved().pages[0].placements[1].shapePoints);
    fireEvent.change(screen.getByLabelText('Marginal mellan rutor (mm)'),{target:{value:'3'}});
    await user.click(screen.getByRole('button',{name:'Passa kanten',exact:true}));
    assert.notDeepEqual(saved().pages[0].placements[1].shapePoints,firstFit);
    assert.deepEqual(parseAlbumBackup(packAlbumBackup(saved())).pages,saved().pages);
    assert.deepEqual(readProjects()[0].pages[0].placements[1].shapePoints,saved().pages[0].placements[1].shapePoints);
    // Turning the fitted panel into a rectangle would overlap its neighbor.
    const acceptedShape=structuredClone(saved().pages[0].placements[1].shapePoints);
    await user.selectOptions(screen.getByLabelText('Rutans form'),'rectangle');
    assert.deepEqual(saved().pages[0].placements[1].shapePoints,acceptedShape);
    const beforeBorderContents=structuredClone(saved().pages[0].placements);
    await user.click(screen.getByRole('button',{name:'Albuminställningar',exact:true}));
    const borderDialog=screen.getByRole('dialog',{name:'Albuminställningar',exact:true});
    fireEvent.change(within(borderDialog).getByLabelText('Ramfärg (hex)'),{target:{value:'#aa2233'}});
    fireEvent.change(within(borderDialog).getByLabelText('Ramtjocklek (pt)'),{target:{value:'2'}});
    fireEvent.keyDown(window,{key:'Escape'});
    assert.equal(saved().panelBorderDefaults.color,'#aa2233');
    const selectedFrame=screen.getByLabelText('ruta 5',{exact:true});
    const selectedOutline=selectedFrame.querySelector('.panel-frame-outline polygon');
    assert.equal(selectedOutline.getAttribute('stroke'),'#aa2233');
    assert.equal(screen.getByLabelText('Använd albumets standardram').checked,true);
    fireEvent.change(screen.getByLabelText('Ramfärg (hex)'),{target:{value:'#22aa44'}});
    fireEvent.change(screen.getByLabelText('Ramtjocklek (pt)'),{target:{value:'6'}});
    assert.equal(screen.getByLabelText('Använd albumets standardram').checked,false);
    assert.equal(selectedOutline.getAttribute('stroke'),'#22aa44');
    assert.equal(saved().pages[0].placements[1].panelBorder.thicknessPt,6);
    assert.equal(screen.getByLabelText('ruta 1',{exact:true}).querySelector('.panel-frame-outline polygon').getAttribute('stroke'),'#aa2233');
    await user.click(screen.getByLabelText('Visa ram'));
    assert.equal(selectedFrame.querySelector('.panel-frame-outline'),null);
    assert.equal(saved().pages[0].placements[1].panelBorder.visible,false);
    await user.click(screen.getByLabelText('Använd albumets standardram'));
    assert.equal(saved().pages[0].placements[1].panelBorder,undefined);
    assert.equal(selectedFrame.querySelector('.panel-frame-outline polygon').getAttribute('stroke'),'#aa2233');
    const afterBorderContents=saved().pages[0].placements;
    for(let i=0;i<afterBorderContents.length;i++){
      assert.deepEqual(afterBorderContents[i].image,beforeBorderContents[i].image);
      assert.deepEqual(afterBorderContents[i].overlays,beforeBorderContents[i].overlays);
      assert.deepEqual(afterBorderContents[i].shapePoints,beforeBorderContents[i].shapePoints);
    }
    assert.deepEqual(parseAlbumBackup(packAlbumBackup(saved())).panelBorderDefaults,saved().panelBorderDefaults);
    const badBorderBackup=packAlbumBackup(structuredClone(saved()));badBorderBackup.project.panelBorderDefaults.thicknessPt=-1;
    assert.throws(()=>parseAlbumBackup(badBorderBackup),/invalid-backup/);
    console.log('PASS: inherited album border, custom color/hex/thickness, hidden border, restoring defaults and intact frame contents/backup.');

  }finally{edgeView.unmount();}
  console.log('PASS: screenshot-style shared middle cell, neighbor-fit controls, adjustable gap, stable frame contents, overlap prevention and backup/load.');
  console.log(
    "PASS: manuscript frames/CRLF, prompt/image/history/dialogue inspector, selected-only AI append/failure/cancel, source edits/caret, no sequences, stable panel IDs and page images",
  );
} finally {
  view.unmount();
  dom.window.close();
  rmSync(compiledRoot, { recursive: true, force: true });
}



