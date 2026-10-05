import type { PanelImage } from "./adaptation/types";
export function imageViewStyle(image: PanelImage) {
  return {
    objectFit: image.fit ?? "cover",
    objectPosition: image.positionMode === "frame" ? "50% 50%" : `${50+(image.offsetX??0)/2}% ${50+(image.offsetY??0)/2}%`,
    transform: image.positionMode === "frame" ? `translate(${image.offsetX??0}%, ${image.offsetY??0}%) scale(${image.zoom??1})` : `scale(${image.zoom??1})`,
  };
}
export function imagePlacement(image: PanelImage, width: number, height: number, naturalWidth: number, naturalHeight: number) {
  const factor=(image.fit==="contain"?Math.min:Math.max)(width/naturalWidth,height/naturalHeight);
  const baseWidth=naturalWidth*factor,baseHeight=naturalHeight*factor,zoom=image.zoom??1;
  const dx=image.positionMode==="frame" ? (image.offsetX??0)/100*width : (width-baseWidth)*(image.offsetX??0)/200*zoom;
  const dy=image.positionMode==="frame" ? (image.offsetY??0)/100*height : (height-baseHeight)*(image.offsetY??0)/200*zoom;
  return {x:(width-baseWidth*zoom)/2+dx,y:(height-baseHeight*zoom)/2+dy,width:baseWidth*zoom,height:baseHeight*zoom};
}
// Preserve an older crop when its controls are first edited. Unedited albums
// continue to render their original object-position coordinates.
export function framePosition(image: PanelImage, width: number, height: number, naturalWidth: number, naturalHeight: number) {
  if(image.positionMode==="frame")return {offsetX:image.offsetX??0,offsetY:image.offsetY??0};
  if(width<=0||height<=0||naturalWidth<=0||naturalHeight<=0)return {offsetX:0,offsetY:0};
  const placed=imagePlacement(image,width,height,naturalWidth,naturalHeight);
  return {offsetX:(placed.x-(width-placed.width)/2)/width*100,offsetY:(placed.y-(height-placed.height)/2)/height*100};
}
export function panFramePosition(start:{offsetX:number;offsetY:number},dx:number,dy:number,width:number,height:number) {
  return {offsetX:Math.max(-100,Math.min(100,start.offsetX+dx/width*100)),offsetY:Math.max(-100,Math.min(100,start.offsetY+dy/height*100))};
}
