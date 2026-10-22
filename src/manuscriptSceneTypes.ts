export type ManuscriptScene = {
  id:string; chapterId?:string; sourceChapterId?:string; origin:'storybook'|'manual';
  title:string; purpose:string; preserve:string; originalText:string;
  start?:number; end?:number; needsReview?:boolean; omitted:boolean;
};
/** Move anchors with edits; changes inside a scene require explicit review. */
export function moveSceneAnchors(scenes:ManuscriptScene[]|undefined,start:number,oldEnd:number,newEnd:number):ManuscriptScene[]|undefined {
  const delta=newEnd-oldEnd;
  return scenes?.map(scene=>{
    if(scene.start===undefined||scene.end===undefined||scene.end<=start)return scene;
    if(scene.start>=oldEnd)return {...scene,start:scene.start+delta,end:scene.end+delta};
    const a=Math.min(scene.start,start),b=scene.end>oldEnd?scene.end+delta:newEnd;
    return {...scene,start:a,end:Math.max(a,b),needsReview:true};
  });
}
export function validateManuscriptScenes(value:unknown,source:string):void {
  if(value===undefined)return;
  const fail=()=>{throw new Error('invalid-backup');};
  if(!Array.isArray(value))fail();const ids=new Set();
  for(const s of value as ManuscriptScene[]){
    if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||!['manual','storybook'].includes(s.origin)||typeof s.omitted!=='boolean')fail();ids.add(s.id);
    for(const k of ['title','purpose','preserve','originalText'] as const)if(typeof s[k]!=='string')fail();
    for(const k of ['chapterId','sourceChapterId'] as const)if(s[k]!==undefined&&typeof s[k]!=='string')fail();
    if(s.needsReview!==undefined&&typeof s.needsReview!=='boolean')fail();
    if((s.start===undefined)!==(s.end===undefined))fail();
    if(s.start!==undefined){const end=s.end!;if(!Number.isInteger(s.start)||!Number.isInteger(end)||s.start<0||end<s.start||end>source.length)fail();}
  }
}
