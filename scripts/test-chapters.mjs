import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".chapters-test-"));
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
  const React=await import('react');
  const {render,screen,within,fireEvent,waitFor,cleanup,act}=await import('@testing-library/react');
  const {default:userEvent}=await import('@testing-library/user-event');
  const local=path=>import(pathToFileURL(join(temporary,path+'.mjs')));
  const {parseStoryBookExport}=await local('storybookImport');
  const {importManuscriptChapters,manuscriptChapters,validManuscriptChapters}=await local('manuscriptChapters');
  const {createProject,normalizeStoredProjects}=await local('project');
  const {addManualBeat,editManuscriptChapter,activeManuscriptAdaptation,patchBeatPanel,generateBeatPanelPrompt}=await local('manuscriptModel');
  const {packAlbumBackup,parseAlbumBackup}=await local('albumBackup');
  const {App}=await local('App');
  const {manuscriptHtml}=await local('manuscriptFormatting');
  const formattedText='First <paragraph> & a face 🙂.\r\n\r\nSecond line.\nA soft break.\n  \nLast paragraph.';
  const divider=formattedText.indexOf('\r\n');
  const formatBeats=[{id:'first',sourceStart:0,sourceEnd:divider+2},{id:'second',sourceStart:divider+2,sourceEnd:formattedText.length}];
  const formatted=document.createElement('div');formatted.innerHTML=manuscriptHtml(formattedText,formatBeats,'second');
  assert.equal(formatted.textContent,formattedText,'paragraph display preserves every source character and CRLF');
  assert.equal(formatted.querySelectorAll('.manuscript-paragraph-break').length,2);
  assert.equal(formatted.querySelector('.manuscript-paragraph-break').textContent,'\r\n\r\n','beat boundary inside separator stays one visual paragraph gap');
  assert.ok(formatted.querySelector('.manuscript-beat.is-selected'));
  const excerptStart=formattedText.indexOf('Second');
  const chapterFormatted=document.createElement('div');chapterFormatted.innerHTML=manuscriptHtml(formattedText,formatBeats,null,excerptStart,formattedText.length);
  assert.equal(chapterFormatted.textContent,formattedText.slice(excerptStart),'chapter rendering preserves global source offsets');
  console.log('PASS: compact paragraph display preserves exact text, CRLF, single line breaks, markup escaping and beat boundaries');

  const raw={kind:'storycore.manuscript-export',format:1,sourceApp:'storybook-ai',exportedAt:'2026-10-18T17:00:00Z',sourceBookId:'source-book',title:'Chapter fixture',illustrationStyle:'',bible:[],chapters:[
    {id:'c3',sequence_index:2,title:'Return',prose:'He returns to the gate.\r\n"Wait," he says.'},
    {id:'c1',sequence_index:0,title:'Arrival',prose:'He arrives at the gate.\r\n"Wait," he says.'},
    {id:'c2',sequence_index:1,title:'Interlude',prose:''}
  ]};
  const originalRaw=JSON.stringify(raw),parsed=parseStoryBookExport(originalRaw);
  assert.deepEqual(parsed.chapters.map(c=>c.id),['c1','c2','c3']);
  const imported=importManuscriptChapters(parsed.chapters);
  assert.equal(imported.text,parsed.text);
  assert.equal(validManuscriptChapters(imported.chapters,imported.text),true);
  assert.equal(imported.chapters[1].start,imported.chapters[1].end,'empty chapters preserved');
  assert.deepEqual(imported.chapters.map(c=>c.sourceId),['c1','c2','c3']);
  assert.ok(imported.chapters.every(c=>c.id!==c.sourceId));
  let project=createProject('Chapters','storybook');
  project.source={type:'storybook',storyBookId:raw.sourceBookId,textSnapshot:imported.text,chapters:imported.chapters};
  const c1=project.source.chapters[0],empty=project.source.chapters[1],c3=project.source.chapters[2];
  const b1=addManualBeat(project,{start:c1.start,end:c1.end});project=b1.project;
  const b3=addManualBeat(project,{start:c3.start,end:c3.end});project=b3.project;
  assert.equal(project.adaptations[0].beats[1].chapterId,c3.id);
  const plan=project.adaptations[0].panelPlans.find(p=>p.chapterId===c3.id);
  project=patchBeatPanel(project,plan.id,{image:{name:'original.png',dataUrl:'data:image/png;base64,AA=='},visualDescription:'An authored scene'});
  project=generateBeatPanelPrompt(project,plan.id);
  project.pages=[{id:'page',number:1,gridColumns:1,gridRows:1,placements:[{id:'frame',x:0,y:0,width:1,height:1,readingOrder:1,panelId:project.panels.find(p=>p.adaptationPanelPlanId===plan.id).id,image:project.adaptations[0].panelPlans.find(p=>p.id===plan.id).image,overlays:[]}]}];
  const before=structuredClone(project),originalSnapshots=project.source.chapters.map(c=>c.originalText);
  project=editManuscriptChapter(project,c1.id,'Prelude. '+originalSnapshots[0]);
  assert.equal(project.source.chapters[2].start,c3.start+9);
  assert.equal(project.adaptations[0].beats.find(b=>b.id===b3.beatId).sourceStart,c3.start+9);
  assert.deepEqual(project.adaptations[0].panelPlans.find(p=>p.id===plan.id),before.adaptations[0].panelPlans.find(p=>p.id===plan.id));
  assert.deepEqual(project.pages,before.pages);
  assert.deepEqual(project.source.chapters.map(c=>c.originalText),originalSnapshots,'imported truth snapshots cannot change on local edit');
  const thirdText=project.source.textSnapshot.slice(project.source.chapters[2].start,project.source.chapters[2].end);
  project=editManuscriptChapter(project,c3.id,thirdText.replace('returns','runs back'));
  assert.equal(project.adaptations[0].beats.find(b=>b.id===b3.beatId).sourceNeedsReview,true);
  assert.equal(project.adaptations[0].panelPlans.find(p=>p.id===plan.id).sourceNeedsReview,true);
  project=editManuscriptChapter(project,empty.id,'An inserted scene.');
  assert.equal(validManuscriptChapters(project.source.chapters,project.source.textSnapshot),true);
  assert.equal(project.source.chapters[1].originalText,'');
  assert.equal(project.source.textSnapshot.slice(project.source.chapters[2].start,project.source.chapters[2].end),thirdText.replace('returns','runs back'));
  const packed=JSON.parse(JSON.stringify(packAlbumBackup(project)));
  assert.deepEqual(parseAlbumBackup(packed).source,project.source);
  assert.deepEqual(normalizeStoredProjects(JSON.parse(JSON.stringify([project])))[0].source,project.source);
  for(const corrupt of [p=>p.source.chapters[1].id=p.source.chapters[0].id,p=>p.source.chapters[1].start=0,p=>p.source.chapters[0].end=999999,p=>p.adaptations[0].beats[0].chapterId='missing',p=>p.panels[0].chapterId='missing']){
    const value=structuredClone(packed);corrupt(value.project);assert.throws(()=>parseAlbumBackup(value),/invalid-backup/);
  }
  const old=createProject('Old','storybook');old.source.textSnapshot='One\n\nTwo';old.scenes=[{id:'old1',title:'First',sourceText:'One',panelIds:[]},{id:'old2',title:'Second',sourceText:'Two',panelIds:[]}];
  const recovered=manuscriptChapters(old);assert.equal(recovered.length,2);assert.deepEqual(manuscriptChapters(old),recovered);
  assert.equal(manuscriptChapters({...old,source:{...old.source,textSnapshot:'Edited source'}}).length,0,'never guess boundaries for an edited legacy manuscript');
  assert.equal(manuscriptChapters(createProject('Plain','text')).length,0);
  assert.equal(JSON.stringify(raw),originalRaw);

  localStorage.clear();localStorage.setItem('comicbook-ai.locale','en');
  const user=userEvent.setup({document});render(React.createElement(App));
  await user.click(screen.getByRole('button',{name:'New comic album',exact:true}));
  await user.click(screen.getByRole('radio',{name:'Import from StoryBook'}));
  const file=new window.File([originalRaw],'synthetic-export.json',{type:'application/json'});
  file.text=()=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(file);});
  await user.upload(screen.getByLabelText('StoryBook export for other apps (.json)'),file);
  const importButton=screen.getByRole('button',{name:'Import and create project'});
  await waitFor(()=>assert.equal(importButton.disabled,false));
  await user.click(importButton);
  const current=()=>JSON.parse(localStorage.getItem('comicbook-ai.projects'))[0];
  await waitFor(()=>assert.equal(current().source.chapters.length,3));
  const choose=screen.getByRole('combobox',{name:'Chapter'}),editor=screen.getByRole('textbox',{name:'Manus'});
  assert.equal(editor.textContent,raw.chapters[1].prose);
  assert.equal(document.querySelector('.manuscript-original pre').textContent,raw.chapters[1].prose);
  assert.equal(networkRequests,0,'import and chapter navigation never call AI');
  await user.click(screen.getByRole('button',{name:'Next chapter'}));
  assert.equal(editor.textContent,'');
  assert.equal(screen.getByRole('button',{name:'Suggest beats for chapter'}).disabled,true);
  await user.click(screen.getByRole('button',{name:'Next chapter'}));
  assert.equal(editor.textContent,raw.chapters[0].prose);
  const chapterStart=current().source.chapters[2].start;
  const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(editor);selection.removeAllRanges();selection.addRange(range);fireEvent.mouseUp(editor);
  await user.click(screen.getByRole('button',{name:'Create beat',exact:true}));
  assert.equal(current().adaptations[0].beats[0].sourceStart,chapterStart);
  assert.equal(current().adaptations[0].beats[0].chapterId,current().source.chapters[2].id);
  assert.equal(document.querySelectorAll('.manuscript-beat-list button').length,1);
  await user.selectOptions(choose,current().source.chapters[0].id);
  assert.equal(document.querySelectorAll('.manuscript-beat-list button').length,0,'beat navigation is chapter-scoped');
  await user.selectOptions(choose,current().source.chapters[2].id);
  const edited=editor.textContent+'\nA final glance.';editor.textContent=edited;fireEvent.input(editor);
  assert.equal(current().source.textSnapshot.slice(current().source.chapters[2].start,current().source.chapters[2].end),edited);
  assert.equal(current().source.chapters[0].originalText,raw.chapters[1].prose);
  assert.equal(current().source.chapters[2].originalText,raw.chapters[0].prose);
  assert.equal(JSON.stringify(raw),originalRaw);
  assert.equal(await act(async()=>await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(file);})),originalRaw,'user-selected export bytes unchanged');
  assert.equal(networkRequests,0);
  const importedProject=current();
  cleanup();
  const {ManuscriptWorkspace}=await local('ManuscriptWorkspace');
  const {defaultLocalAiSettings}=await local('localAi');
  const settings=defaultLocalAiSettings();settings.servers.ollama.model='fixture-model';
  let working=structuredClone(importedProject),aiCalls=0;
  globalThis.fetch=async(url,init)=>{
    aiCalls++;
    assert.equal(url,'http://localhost:11434/api/chat');
    const input=JSON.parse(JSON.parse(init.body).messages[1].content);
    assert.ok(input.segments.some(s=>s.text.includes('final glance')));
    assert.ok(input.segments.every(s=>!s.text.includes('arrives')),'chapter analysis never sends another chapter');
    return new Response(JSON.stringify({message:{content:JSON.stringify({beats:[{from:1,to:1,title:'Return to the gate',summary:'The traveller comes back.',visualDescription:'At the gate, the traveller pauses with his hand on the gatepost.',beatType:'action'}]})},done_reason:'stop'}));
  };
  function Harness(){const [p,set]=React.useState(working);return React.createElement(ManuscriptWorkspace,{project:p,locale:'en',settings,onSettings(){},onUpdate(fn){set(old=>{working=fn(old);return working;});}});}
  render(React.createElement(Harness));
  await user.selectOptions(screen.getByRole('combobox',{name:'Chapter'}),working.source.chapters[2].id);
  await user.click(screen.getByRole('button',{name:'Suggest beats for chapter'}));
  await screen.findByText('Review AI suggestions');
  assert.equal(aiCalls,1);
  await user.click(screen.getByRole('button',{name:'Add selected beats'}));
  const aiBeat=working.adaptations[0].beats.find(b=>b.title==='Return to the gate');
  assert.equal(aiBeat.chapterId,working.source.chapters[2].id);
  assert.equal(aiBeat.sourceStart,working.source.chapters[2].start);
  assert.equal(working.source.textSnapshot.slice(aiBeat.sourceStart,aiBeat.sourceEnd),aiBeat.sourceTextExcerpt);
  assert.deepEqual(working.source,importedProject.source);
  cleanup();
  console.log('PASS: ordered chapter import and empty chapters, original file/snapshots unchanged, stable local/source IDs, chapter-scoped UI and global beat offsets, local edits, exact legacy recovery, backup and normalization');
} finally { rmSync(temporary,{recursive:true,force:true});dom.window.close(); }
