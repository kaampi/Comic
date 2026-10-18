import type { ComicProject, PageLayer, TextOverlay } from "./project";
import type { PanelImage } from "./adaptation/types";
type Page = ComicProject['pages'][number];

export function createForeground(page: Page, name: string, dataUrl: string): PageLayer {
  return { id:'foreground-'+crypto.randomUUID(), x:0, y:0, width:page.gridColumns, height:page.gridRows, readingOrder:0, overlays:[], moveWithText:false,
    image:{name,dataUrl,zoom:1,offsetX:0,offsetY:0,positionMode:'frame',fit:'contain'} };
}
export function reorderForegrounds(page: Page, id: string, direction: -1 | 1): Page {
  const layers=[...(page.foregrounds??[])],index=layers.findIndex(layer=>layer.id===id),target=index+direction;
  if(index<0||target<0||target>=layers.length)return page;
  [layers[index],layers[target]]=[layers[target],layers[index]];
  return {...page,foregrounds:layers};
}
// Project a page-wide foreground into the existing text/image editor, then put
// it back in its original stack position. It never becomes a layout frame.
export function editPageForeground(project: ComicProject, pageId: string, id: string, update: (p: ComicProject)=>ComicProject): ComicProject {
  const page=project.pages.find(p=>p.id===pageId),layer=page?.foregrounds?.find(l=>l.id===id);
  if(!page||!layer)return update(project);
  const projected={...project,pages:project.pages.map(p=>p.id!==pageId?p:{...p,foregrounds:p.foregrounds?.filter(l=>l.id!==id),placements:[...p.placements,{...layer,x:0,y:0,width:p.gridColumns,height:p.gridRows}]})};
  const result=update(projected);
  return {...result,pages:result.pages.map(p=>p.id!==pageId?p:{...p,foregrounds:page.foregrounds!.map(l=>l.id===id?(p.placements.find(l=>l.id===id)??layer):p.foregrounds?.find(item=>item.id===l.id)??l),placements:p.placements.filter(l=>l.id!==id)})};
}
function translateText(o: TextOverlay,dx:number,dy:number):TextOverlay {
  return {...o,x:o.x+dx,y:o.y+dy,...(o.tailX===undefined?{}:{tailX:o.tailX+dx}),...(o.tailY===undefined?{}:{tailY:o.tailY+dy})};
}
export function changeForegroundImage(layer: PageLayer, image: PanelImage): PageLayer {
  const dx=(image.offsetX??0)-(layer.image?.offsetX??0),dy=(image.offsetY??0)-(layer.image?.offsetY??0);
  return {...layer,image,overlays:layer.moveWithText&&(dx||dy)?layer.overlays.map(o=>translateText(o,dx,dy)):layer.overlays};
}
