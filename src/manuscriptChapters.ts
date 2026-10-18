import type { ComicProject } from "./project";

export type ManuscriptChapter = {
  id: string;
  sourceId?: string;
  sourceIndex?: number;
  title: string;
  order: number;
  start: number;
  end: number;
  originalText: string;
};
export function importManuscriptChapters(chapters: Array<{id: string; title: string; text: string; sourceIndex?:number}>): {text: string; chapters: ManuscriptChapter[]} {
  let text = '';
  const result = chapters.map((chapter, index) => {
    if (index) text += '\n\n';
    const start = text.length; text += chapter.text;
    return {id:'chapter-'+crypto.randomUUID(),sourceId:chapter.id,...(chapter.sourceIndex===undefined?{}:{sourceIndex:chapter.sourceIndex}),title:chapter.title,order:index+1,start,end:text.length,originalText:chapter.text};
  });
  return {text,chapters:result};
}
export function validManuscriptChapters(value: unknown, source: string): value is ManuscriptChapter[] {
  if (!Array.isArray(value)) return false;
  const ids=new Set<string>(); let previousEnd=0;
  for (const [index,chapter] of value.entries()) {
    if (!chapter || typeof chapter.id!=='string' || !chapter.id || ids.has(chapter.id) || typeof chapter.title!=='string' ||
        (chapter.sourceId!==undefined && typeof chapter.sourceId!=='string') || (chapter.sourceIndex!==undefined&&(!Number.isInteger(chapter.sourceIndex)||chapter.sourceIndex<0)) || typeof chapter.originalText!=='string' || chapter.order!==index+1 ||
        !Number.isInteger(chapter.start) || !Number.isInteger(chapter.end) || chapter.start!==previousEnd+(index?2:0) || chapter.end<chapter.start || chapter.end>source.length ||
        (index>0 && source.slice(previousEnd,chapter.start)!=='\n\n')) return false;
    ids.add(chapter.id); previousEnd=chapter.end;
  }
  return !value.length || previousEnd===source.length;
}
export function manuscriptChapters(project: ComicProject): ManuscriptChapter[] {
  const text=project.source.textSnapshot??'';
  if (project.source.chapters!==undefined) return validManuscriptChapters(project.source.chapters,text)?project.source.chapters:[];
  // Older imports retained chapter snapshots as scenes. Recover only when the
  // entire source matches exactly; never infer boundaries in an edited book.
  if (project.source.type!=='storybook') return [];
  const scenes=project.scenes.filter(s=>!s.id.startsWith('scene-adaptation-') && s.sourceText.length>0);
  if (!scenes.length || scenes.map(s=>s.sourceText).join('\n\n')!==text) return [];
  let start=0;
  return scenes.map((scene,index)=>{
    const chapter={id:'chapter-legacy-'+scene.id,title:scene.title,order:index+1,start,end:start+scene.sourceText.length,originalText:scene.sourceText};
    start=chapter.end+2;return chapter;
  });
}
export function chapterForRange(project: ComicProject, start?: number, end?: number): ManuscriptChapter | undefined {
  if (start===undefined || end===undefined || end<=start) return undefined;
  return manuscriptChapters(project).find(chapter=>start>=chapter.start && end<=chapter.end);
}
