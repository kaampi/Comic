import { useState } from "react";
import type { ComicProject, PageLayer } from "./project";
import type { Locale } from "./settings";
import type { PanelSide } from "./panelGeometry";
export function PanelEdgeFitControls({page,layer,locale,onFit}:{page:ComicProject["pages"][number];layer:PageLayer;locale:Locale;onFit:(neighborId:string,side:PanelSide,margin:number)=>boolean}) {
  const neighbors=page.placements.filter(p=>p.id!==layer.id),sv=locale==="sv";
  const [neighborId,setNeighborId]=useState(neighbors[0]?.id??"");
  const [side,setSide]=useState<PanelSide>("left"),[margin,setMargin]=useState(2),[error,setError]=useState(false);
  if(!neighbors.length)return null;
  const selected=neighbors.some(p=>p.id===neighborId)?neighborId:neighbors[0].id;
  return <div className="panel-edge-fit-controls"><strong>{sv?"Passa mot grannruta":"Fit to neighboring panel"}</strong>
    <label>{sv?"Grannruta":"Neighboring panel"}<select value={selected} onChange={e=>{setNeighborId(e.target.value);setError(false);}}>{neighbors.map(p=><option key={p.id} value={p.id}>{sv?"Ruta":"Panel"} {p.readingOrder}</option>)}</select></label>
    <label>{sv?"Placera på sidan":"Place on side"}<select value={side} onChange={e=>{setSide(e.target.value as PanelSide);setError(false);}}><option value="left">{sv?"Till vänster":"Left"}</option><option value="right">{sv?"Till höger":"Right"}</option><option value="above">{sv?"Ovanför":"Above"}</option><option value="below">{sv?"Under":"Below"}</option></select></label>
    <label>{sv?"Marginal mellan rutor (mm)":"Gap between panels (mm)"}<input type="number" min="0" max="20" step=".5" value={margin} onChange={e=>{setMargin(Math.max(0,Math.min(20,Number(e.target.value)||0)));setError(false);}}/></label>
    <button type="button" className="text-button" onClick={()=>setError(!onFit(selected,side,margin))}>{sv?"Passa kanten":"Fit edge"}</button>
    <p className="quiet">{sv?"Rutan utökas och beskärs längs grannrutans kant. Avståndet mäts mellan ramarna. Passa kanten igen om grannrutan ändras.":"Expand and clip this panel along its neighbor’s edge. The gap is measured between borders. Fit again after changing the neighbor."}</p>
    {error?<p role="alert">{sv?"Formen ryms inte eller krockar med en annan ruta. Prova en annan sida eller marginal.":"The shape does not fit or collides with another panel. Try another side or gap."}</p>:null}
  </div>;
}
