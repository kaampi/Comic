import { ColorInput } from "./ColorInput";
import { useEffect, useState } from "react";
import type { PanelBorderStyle } from "./panelBorder";
import type { Locale } from "./settings";
export function PanelBorderControls({value,locale,onChange,inherited,onInherit}:{value:PanelBorderStyle;locale:Locale;onChange:(value:PanelBorderStyle)=>void;inherited?:boolean;onInherit?:(value:boolean)=>void}) {
  const sv=locale==="sv",[hex,setHex]=useState(value.color);
  useEffect(()=>setHex(value.color),[value.color]);
  return <fieldset className="panel-border-controls"><legend>{onInherit?(sv?"Rutans ram":"Panel border"):(sv?"Standardram för rutor":"Default panel border")}</legend>
    {onInherit?<label><input type="checkbox" checked={inherited} onChange={e=>onInherit(e.target.checked)}/>{sv?"Använd albumets standardram":"Use album default border"}</label>:null}
    <label>{sv?"Visa ram":"Show border"}<input type="checkbox" checked={value.visible} onChange={e=>onChange({...value,visible:e.target.checked})}/></label>
    <label>{sv?"Ramfärg":"Border color"}<ColorInput value={value.color} onChange={color=>onChange({...value,color})}/></label>
    <label>{sv?"Ramfärg (hex)":"Border color (hex)"}<input type="text" maxLength={7} value={hex} onChange={e=>{setHex(e.target.value);if(/^#[0-9a-f]{6}$/i.test(e.target.value))onChange({...value,color:e.target.value});}} onBlur={()=>{if(!/^#[0-9a-f]{6}$/i.test(hex))setHex(value.color);}}/></label>
    <label>{sv?"Ramtjocklek (pt)":"Border thickness (pt)"}<input type="number" min="0" max="24" step=".25" value={Number(value.thicknessPt.toFixed(2))} onChange={e=>onChange({...value,thicknessPt:Math.max(0,Math.min(24,Number(e.target.value)||0))})}/></label>
    <p className="quiet">{sv?"Passa kanten igen efter ändrad tjocklek för att behålla önskad marginal mellan ramarna.":"Fit the edge again after changing thickness to retain the desired gap between borders."}</p>
  </fieldset>;
}

