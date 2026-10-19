import type { ComicProject, PageLayer } from "./project";
import type { PageGrid } from "./pageFormat";
import { panelMoveAllowed } from "./panelMove";
export const POOL_DRAG_TYPE="application/x-comicbook-pooled-panel";
export type PooledPanel={layer:PageLayer;sourceGrid:PageGrid;targetPageId?:string};
export type PanelSelection={pageId:string;layerId:string};
export type PoolUndo={projectId:string;beforePages:ComicProject["pages"];afterPages:ComicProject["pages"];beforePool:ComicProject["unplacedPanels"];afterPool:ComicProject["unplacedPanels"]};
export function parkPanels(project:ComicProject, selections:PanelSelection[], targetPageId?:string):ComicProject {
  if(targetPageId&&!project.pages.some(page=>page.id===targetPageId))return project;
  const selected=new Set(selections.map(s=>`${s.pageId}:${s.layerId}`)), added:PooledPanel[]=[];
  const pages=project.pages.map(page=>{
    const moving=page.placements.filter(layer=>selected.has(`${page.id}:${layer.id}`));
    if(!moving.length)return page;
    for(const layer of moving)added.push({layer,sourceGrid:{gridColumns:page.gridColumns,gridRows:page.gridRows},targetPageId});
    return {...page,placements:page.placements.filter(layer=>!selected.has(`${page.id}:${layer.id}`)).map((layer,index)=>({...layer,readingOrder:index+1}))};
  });
  if(!added.length)return project;
  return {...project,pages,unplacedPanels:[...(project.unplacedPanels??[]),...added]};
}
export function retargetPooledPanel(project:ComicProject,id:string,targetPageId?:string):ComicProject {
  if(targetPageId&&!project.pages.some(page=>page.id===targetPageId))return project;
  const item=project.unplacedPanels?.find(item=>item.layer.id===id);
  if(!item||item.targetPageId===targetPageId)return project;
  return {...project,unplacedPanels:project.unplacedPanels!.map(item=>item.layer.id===id?{...item,targetPageId}:item)};
}
export function pooledCandidate(project:ComicProject,id:string,pageId:string,x:number,y:number){
  const item=project.unplacedPanels?.find(item=>item.layer.id===id),page=project.pages.find(page=>page.id===pageId);
  if(!item||!page)return null;
  const layer={...item.layer,x,y,readingOrder:Math.max(0,...page.placements.map(layer=>layer.readingOrder))+1};
  if(!panelMoveAllowed(project,page,layer))return null;
  return layer;
}
export function placePooledPanel(project:ComicProject,id:string,pageId:string,x:number,y:number):ComicProject {
  const candidate=pooledCandidate(project,id,pageId,x,y);if(!candidate)return project;
  return {...project,unplacedPanels:project.unplacedPanels!.filter(item=>item.layer.id!==id),pages:project.pages.map(page=>page.id===pageId?{...page,placements:[...page.placements,candidate]}:page)};
}
export function removePooledPanel(project:ComicProject,id:string):ComicProject {
  if(!project.unplacedPanels?.some(item=>item.layer.id===id))return project;
  return {...project,unplacedPanels:project.unplacedPanels.filter(item=>item.layer.id!==id)};
}
export function deletePageToPool(project:ComicProject,id:string):ComicProject {
  const page=project.pages.find(page=>page.id===id);if(!page)return project;
  const lifted=parkPanels(project,page.placements.map(layer=>({pageId:id,layerId:layer.id})));
  return {...lifted,pages:lifted.pages.filter(page=>page.id!==id).map((page,index)=>({...page,number:index+1})),unplacedPanels:lifted.unplacedPanels?.map(item=>item.targetPageId===id?{...item,targetPageId:undefined}:item)};
}
export function poolUndo(before:ComicProject,after:ComicProject):PoolUndo {
  return {projectId:before.id,beforePages:before.pages,afterPages:after.pages,beforePool:before.unplacedPanels,afterPool:after.unplacedPanels};
}
export function canUndoPool(project:ComicProject,undo:PoolUndo){return project.id===undo.projectId&&project.pages===undo.afterPages&&project.unplacedPanels===undo.afterPool;}
export function undoPool(project:ComicProject,undo:PoolUndo):ComicProject {
  return canUndoPool(project,undo)?{...project,pages:undo.beforePages,unplacedPanels:undo.beforePool}:project;
}
