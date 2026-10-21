import { useEffect, useReducer } from "react";
import type { TextOverlay } from "./project";
import type { LayerTextMetrics } from "./pageTypography";
import { textOverflows } from "./exportPreflight";
import type { Locale } from "./settings";
export function TextOverflowNotice({overlay,metrics,locale}:{overlay:TextOverlay;metrics:LayerTextMetrics;locale:Locale}) {
  const [,refresh]=useReducer((n:number)=>n+1,0);
  useEffect(()=>{const fonts=typeof document!=="undefined"?document.fonts:undefined;if(!fonts)return;const update=()=>refresh();let active=true;fonts.addEventListener("loadingdone",update);fonts.ready.then(()=>{if(active)refresh();});return()=>{active=false;fonts.removeEventListener("loadingdone",update);};},[]);
  if(!overlay.bubbleShapePoints||!textOverflows(overlay,metrics))return null;
  return <p className="text-contour-overflow" role="status">{locale==="sv"?"Texten ryms inte. Förstora bubblan, ändra formen eller justera texten. Hela texten är sparad; teckenstorleken har inte ändrats.":"The text does not fit. Enlarge the bubble, change its shape or edit the text. All text is saved; the font size is unchanged."}</p>;
}
