import { useState } from "react";
import type { ComicProject, PageLayer } from "./project";
import type { Locale } from "./settings";
import type { PanelSide } from "./panelGeometry";
export function PanelEdgeFitControls({page,layer,locale,onFit}:{page:ComicProject["pages"][number];layer:PageLayer;locale:Locale;onFit:(neighborId:string,side:PanelSide,margin:number)=>boolean}) {
  const neighbors=page.placements.filter(p=>p.id!==layer.id),sv=locale==="sv";
  const [neighborId,setNeighborId]=useState(neighbors[0]?.id??"");
  const [side,setSide]=useState<PanelSide>("left"),[margin,setMargin]=useState(2),[result,setResult]=useState<"success"|"error"|null>(null);
  if(!neighbors.length)return null;
  const selected=neighbors.some(p=>p.id===neighborId)?neighborId:neighbors[0].id;
  const neighbor=neighbors.find(p=>p.id===selected)!;
  const position=sv?{left:"till vänster om",right:"till höger om",above:"ovanför",below:"under"}:{left:"to the left of",right:"to the right of",above:"above",below:"below"};
  return <div className="panel-edge-fit-controls"><strong>{sv?"Passa mot grannruta":"Fit to neighboring panel"}</strong>
    <label>{sv?"Grannruta":"Neighboring panel"}<select value={selected} onChange={e=>{setNeighborId(e.target.value);setResult(null);}}>{neighbors.map(p=><option key={p.id} value={p.id}>{sv?"Ruta":"Panel"} {p.readingOrder}</option>)}</select></label>
    <label>{sv?"Placera på sidan":"Place on side"}<select value={side} onChange={e=>{setSide(e.target.value as PanelSide);setResult(null);}}><option value="left">{sv?"Till vänster":"Left"}</option><option value="right">{sv?"Till höger":"Right"}</option><option value="above">{sv?"Ovanför":"Above"}</option><option value="below">{sv?"Under":"Below"}</option></select></label>
    <label>{sv?"Marginal mellan rutor (mm)":"Gap between panels (mm)"}<input type="number" min="0" max="20" step=".5" value={margin} onChange={e=>{setMargin(Math.max(0,Math.min(20,Number(e.target.value)||0)));setResult(null);}}/></label>
    <p>{sv?`Ruta ${layer.readingOrder} anpassas ${position[side]} ruta ${neighbor.readingOrder}. Klicka på Passa kanten för att utföra ändringen.`:`Panel ${layer.readingOrder} will fit ${position[side]} panel ${neighbor.readingOrder}. Click Fit edge to apply.`}</p>
    <button type="button" className="primary-button compact-button" onClick={()=>setResult(onFit(selected,side,margin)?"success":"error")}>{sv?"Passa kanten":"Fit edge"}</button>
    {result==="success"?<p role="status">{sv?`Kanten på ruta ${layer.readingOrder} har passats mot ruta ${neighbor.readingOrder}.`:`Panel ${layer.readingOrder} fitted to panel ${neighbor.readingOrder}.`}</p>:null}
    <p className="quiet">{sv?"Rutan utökas och beskärs längs grannrutans kant. Avståndet mäts mellan ramarna. Passa kanten igen om grannrutan ändras.":"Expand and clip this panel along its neighbor’s edge. The gap is measured between borders. Fit again after changing the neighbor."}</p>
    {result==="error"?<p role="alert">{sv?"Formen ryms inte eller krockar med en annan ruta. Prova en annan sida eller marginal.":"The shape does not fit or collides with another panel. Try another side or gap."}</p>:null}
  </div>;
}

