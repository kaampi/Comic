import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".story-workflow-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent", "FileReader", "File", "HTMLInputElement", "SVGElement", "NodeFilter", "HTMLTextAreaElement"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.PointerEvent=dom.window.MouseEvent;
Object.defineProperty(globalThis,"PointerEvent",{value:dom.window.MouseEvent,configurable:true});
dom.window.confirm=()=>true;
let networkRequests = 0;
const nativeFetch=globalThis.fetch;
globalThis.fetch = async url => { if(String(url).startsWith('data:'))return nativeFetch(url); networkRequests++; throw new Error("offline"); };
symlinkSync(join(root, "node_modules"), join(temporary, "node_modules"), process.platform === "win32" ? "junction" : "dir");

function compile(directory = "") {
  for (const entry of readdirSync(join(root, "src", directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { compile(path); continue; }
    if (!/\.tsx?$/.test(entry.name) || entry.name === "main.tsx") continue;
    const output = ts.transpileModule(readFileSync(join(root, "src", path), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText.replace(/import "[^"\n]+\.css";?/g, "").replace(/from "(\.[^"]+)"/g, (_, imported) => {
      if (imported.endsWith(".json")) return 'from "' + pathToFileURL(resolve(root, "src", dirname(path), imported)) + '" with { type: "json" }';
      return 'from "' + imported + '.mjs"';
    });
    mkdirSync(join(temporary, directory), { recursive: true });
    writeFileSync(join(temporary, path.replace(/\.tsx?$/, ".mjs")), output.replace(/import\("(\.[^"]+)"\)/g,'import("$1.mjs")'));
  }
}

try {
  compile();
  const React=await import("react");
  const {render,screen,within,fireEvent,cleanup}=await import("@testing-library/react");
  const {default:userEvent}=await import("@testing-library/user-event");
  const local=path=>import(pathToFileURL(join(temporary,path+".mjs")));
  const {createProject,normalizeStoredProjects}=await local("project");
  const {importManuscriptChapters}=await local("manuscriptChapters");
  const {addManualBeat,patchBeatPanel,generateBeatPanelPrompt,ensureBeatPanels}=await local("manuscriptModel");
  const {orderedStoryboard,moveStoryboardPanel,insertStoryboardPanel,archiveStoryboardPanel}=await local("storyboardModel");
  const {libraryEntries,assignLibraryPanel}=await local("comicPanelLibrary");
  const {packAlbumBackup,parseAlbumBackup}=await local("albumBackup");
  const {StoryWorkflow}=await local("StoryWorkflow");
  const {App}=await local("App");
  const {readLocalAiSettings}=await local("localAi");
  const {PanelLibrary}=await local("PanelLibrary");
  let project=createProject("Workflow fixture","storybook");
  const imported=importManuscriptChapters([{id:"source-a",title:"Arrival",text:"One enters. Two follows."},{id:"source-b",title:"Departure",text:"Three leaves."}]);
  project.source={type:"storybook",textSnapshot:imported.text,chapters:imported.chapters};
  const [a,b]=imported.chapters;
  project=addManualBeat(project,{start:a.start,end:a.start+11}).project;
  project=addManualBeat(project,{start:a.start+12,end:a.end}).project;
  project=addManualBeat(project,{start:b.start,end:b.end}).project;
  const [first,second,other]=project.adaptations[0].panelPlans;
  const image={name:"authored.png",dataUrl:"data:image/png;base64,AA=="};
  project=patchBeatPanel(project,first.id,{title:"Authored title",purpose:"A visitor arrives",visualDescription:"A figure under a lit doorway",dialogue:[{id:"stable-line",speaker:"Visitor",text:"Hello",bubbleType:"speech",source:"original"}],image});
  project=patchBeatPanel(project,first.id,{image:{name:"second.png",dataUrl:"data:image/png;base64,AQ=="}});
  assert.equal(project.adaptations[0].panelPlans[0].imageVersions[0].name,"authored.png");
  project=generateBeatPanelPrompt(project,first.id);
  const sourceSnapshot=structuredClone(project.source),assets=structuredClone(project.adaptations[0].panelPlans[0]),prompt=structuredClone(project.adaptations[0].imagePrompts[0]);
  const sourcePanel=project.panels.find(p=>p.adaptationPanelPlanId===first.id);
  project.pages=[{id:"page",number:1,gridColumns:2,gridRows:1,placements:[{id:"frame",x:0,y:0,width:50,height:100,readingOrder:1,overlays:[]}]}];
  project=assignLibraryPanel(project,"page","frame",sourcePanel.id);
  const page=structuredClone(project.pages);
  project=moveStoryboardPanel(project,first.id,second.id,a.id);
  assert.deepEqual(orderedStoryboard(project,a.id).map(p=>p.id),[second.id,first.id]);
  assert.equal(orderedStoryboard(project,b.id)[0].id,other.id);
  assert.equal(project.adaptations[0].panelPlans.find(p=>p.id===other.id).order,other.order,"other chapter slots stay put");
  assert.deepEqual(libraryEntries(project).map(e=>e.plan.id),[second.id,first.id,other.id],"page library follows storyboard order across beats");
  assert.deepEqual(project.pages,page,"reordering never rearranges placed page panels");
  const split=insertStoryboardPanel(project,first.id,a.id,true);project=split.project;
  const reaction=project.adaptations[0].panelPlans.find(p=>p.id===split.panelId);
  assert.deepEqual(reaction.sourceBeatIds,first.sourceBeatIds);
  assert.deepEqual(reaction.dialogue,[]);assert.deepEqual(reaction.captions,[]);assert.equal(reaction.image,undefined);assert.equal(reaction.imagePromptId,undefined);
  assert.deepEqual({...project.adaptations[0].panelPlans.find(p=>p.id===first.id),order:assets.order},assets,"splitting preserves original authored fields and IDs");
  const inserted=insertStoryboardPanel(project,null,b.id);project=inserted.project;
  assert.equal(project.adaptations[0].panelPlans.find(p=>p.id===inserted.panelId).chapterId,b.id);
  project=archiveStoryboardPanel(project,first.id,true);
  assert.equal(orderedStoryboard(project,a.id).some(p=>p.id===first.id),false);
  assert.deepEqual(project.pages,page,"removal preserves images, bubbles and source IDs already on pages");
  assert.ok(libraryEntries(project).find(e=>e.plan?.id===first.id),"placed archived panel remains traceable");
  project=archiveStoryboardPanel(project,second.id,true);
  assert.equal(libraryEntries(project).some(e=>e.plan?.id===second.id),false,"unplaced archived panels do not appear in page library");
  assert.equal(ensureBeatPanels(project).adaptations[0].panelPlans.length,project.adaptations[0].panelPlans.length,"archived panels are not silently recreated");
  project=normalizeStoredProjects([parseAlbumBackup(packAlbumBackup(project))])[0];
  assert.equal(orderedStoryboard(project,a.id,true).length,2,"removal survives backup and reload");
  project=patchBeatPanel(project,reaction.id,{visualDescription:"An independent new edit"});
  project=archiveStoryboardPanel(project,first.id,false);
  assert.equal(project.adaptations[0].panelPlans.find(p=>p.id===reaction.id).visualDescription,"An independent new edit","undo preserves intervening edits");
  assert.deepEqual(project.adaptations[0].imagePrompts[0],prompt);
  assert.deepEqual(project.source,sourceSnapshot);
  assert.equal(project.panels.find(p=>p.adaptationPanelPlanId===first.id).id,sourcePanel.id);
  assert.equal(project.adaptations[0].panelPlans.find(p=>p.id===first.id).imageVersions[0].name,"authored.png","image history survives reorder, removal, restore and backup");
  const invalid=packAlbumBackup(project);invalid.project.adaptations[0].panelPlans[0].archived="yes";assert.throws(()=>parseAlbumBackup(invalid),/invalid-backup/);
  console.log("PASS: chapter-scoped reorder, page-library order, insert, split, reversible removal, stable assets and IDs, placed page preservation, backup/reload, source isolation");

  const user=userEvent.setup({document});
  let working=structuredClone(project);
  function Harness(){const [p,setP]=React.useState(working),[stage,setStage]=React.useState("storyboard"),[chapter,setChapter]=React.useState(a.id);return React.createElement(StoryWorkflow,{project:p,locale:"sv",settings:readLocalAiSettings(),stage,chapterId:chapter,onChapterChange:setChapter,onStage:setStage,onUpdate:change=>setP(prev=>{working=change(prev);return working;})});}
  render(React.createElement(Harness));
  const inspector=()=>screen.getByRole("complementary",{name:"Bildrutans detaljer"});
  assert.equal(document.querySelectorAll("[data-storyboard-panel]").length,2);
  fireEvent.change(within(inspector()).getByLabelText("Läsaren ska förstå"),{target:{value:"A new purpose"}});
  const focusedId=orderedStoryboard(working,a.id)[0].id;
  assert.equal(working.adaptations[0].panelPlans.find(p=>p.id===focusedId).purpose,"A new purpose");
  const beforeMove=orderedStoryboard(working,a.id).map(p=>p.id);
  const transfer={effectAllowed:"",setData(){}};
  fireEvent.dragStart(screen.getAllByRole("button",{name:"Dra bildruta"})[0],{dataTransfer:transfer});
  fireEvent.drop(document.querySelectorAll("[data-storyboard-panel]")[1],{dataTransfer:transfer});
  assert.deepEqual(orderedStoryboard(working,a.id).map(p=>p.id),[beforeMove[1],beforeMove[0]],"native drag updates chapter order");
  await user.click(screen.getAllByRole("button",{name:"Flytta upp"})[1]);
  assert.deepEqual(orderedStoryboard(working,a.id).map(p=>p.id),beforeMove,"button controls offer the same ordering");
  await user.click(screen.getByRole("button",{name:"Dela bildruta",exact:true}));
  assert.equal(document.querySelectorAll("[data-storyboard-panel]").length,3);
  await user.click(screen.getByRole("button",{name:"Ta bort bildruta",exact:true}));
  assert.equal(document.querySelectorAll("[data-storyboard-panel]").length,2);
  await user.click(screen.getByRole("button",{name:"Ångra borttagning"}));
  assert.equal(document.querySelectorAll("[data-storyboard-panel]").length,3);
  await user.click(screen.getByRole("button",{name:"Läs sekvensen",exact:true}));
  const reader=screen.getByRole("dialog",{name:"Läs sekvensen"});assert.equal(reader.getAttribute("aria-modal"),"true");
  await user.click(within(reader).getByRole("button",{name:/Nästa/}));
  fireEvent.keyDown(reader,{key:"Escape"});assert.equal(screen.queryByRole("dialog",{name:"Läs sekvensen"}),null);
  await user.click(screen.getByRole("button",{name:/Till bilder/}));
  await user.click(screen.getByRole("button",{name:"Justera bildprompt",exact:true}));
  assert.ok(screen.getByRole("dialog",{name:"Justera bildprompt"}));
  await user.click(within(screen.getByRole("dialog",{name:"Justera bildprompt"})).getByRole("button",{name:"Stäng",exact:true}));
  const upload=screen.getByLabelText("Välj bild");
  await user.upload(upload,new File(["synthetic"],"new.png",{type:"image/png"}));
  const {waitFor}=await import("@testing-library/react");
  await waitFor(()=>assert.ok(working.adaptations[0].panelPlans.some(p=>p.image?.name==="new.png")));
  await user.click(screen.getByRole("button",{name:/Departure/}));
  assert.equal(document.querySelectorAll("[data-storyboard-panel]").length,2);
  await user.click(screen.getByRole("button",{name:/Arrival/}));
  assert.equal(document.querySelectorAll("[data-storyboard-panel]").length,3);
  cleanup();
  render(React.createElement(PanelLibrary,{project:working,locale:"sv",onAssign:()=>{}}));
  assert.deepEqual(Array.from(document.querySelectorAll("[data-panel-id]")).map(e=>e.dataset.panelId),libraryEntries(working).map(e=>e.panel.id));cleanup();
  console.log("PASS: real UI chapter switching, purpose editing, split, remove/undo, sequence reader, prompt editor, image upload, page library order");

  localStorage.clear();localStorage.setItem("comicbook-ai.locale","sv");localStorage.setItem("comicbook-ai.projects",JSON.stringify([working]));
  render(React.createElement(App));
  await user.click(screen.getByRole("button",{name:/Workflow fixture/}));
  await user.click(screen.getByRole("button",{name:/Öppna album för redigering/}));
  const nav=screen.getByRole("group",{name:"Projektinnehåll"});
  assert.deepEqual(Array.from(nav.querySelectorAll(":scope > button")).map(b=>b.textContent),["1Manus","2Beats","3Bildmanus","4Bilder","5Sidor"]);
  await user.selectOptions(screen.getByRole("combobox",{name:"Kapitel"}),b.id);
  await user.click(within(nav).getByRole("button",{name:"Beats",exact:true}));
  assert.equal(document.querySelectorAll(".workflow-beat").length,1,"selected manuscript chapter follows into Beats");
  await user.click(screen.getByRole("button",{name:/Till bildmanus/}));
  assert.equal(document.querySelectorAll("[data-storyboard-panel]").length,2);
  await user.click(screen.getByRole("button",{name:/Till bilder/}));
  await user.click(screen.getByRole("button",{name:/Till sidor/}));
  assert.ok(document.querySelector(".page-workspace"));
  await user.click(within(nav).getByRole("button",{name:"Manus",exact:true}));
  assert.equal(screen.getByRole("combobox",{name:"Kapitel"}).value,b.id,"chapter survives travelling through pages and back");
  assert.equal(networkRequests,0,"navigation, manual editing and image handling never automatically contact AI");
  cleanup();
  console.log("PASS: integrated App five-step navigation, shared chapter, real page-builder handoff, return to source, no automatic AI requests");
} finally { rmSync(temporary,{recursive:true,force:true});dom.window.close(); }
