import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { PanelImage } from "./adaptation/types";
import { imagePlacement, imageViewStyle } from "./imageView";

// Size the image element to the entire fitted original. Only its parent clips it.
// Moving a frame-sized object-fit element would move an already cropped bitmap.
export function PositionedImage({ image, className }: { image: PanelImage; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState({ source: "", width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const measure = () => {
    const img = ref.current, parent = img?.parentElement;
    if (!img || !parent) return;
    const box = parent.getBoundingClientRect();
    const next = { source: image.dataUrl, width: parent.clientWidth || box.width, height: parent.clientHeight || box.height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
    setSize(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
  };
  useLayoutEffect(() => {
    measure();
    const parent = ref.current?.parentElement;
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : undefined;
    if (parent) observer?.observe(parent);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [image.dataUrl]);
  let style: CSSProperties = imageViewStyle(image);
  if (size.source === image.dataUrl && size.width > 0 && size.height > 0 && size.naturalWidth > 0 && size.naturalHeight > 0) {
    const placed = imagePlacement(image, size.width, size.height, size.naturalWidth, size.naturalHeight);
    style = { position: "absolute", inset: "auto", left: placed.x, top: placed.y, width: placed.width, height: placed.height, maxWidth: "none", maxHeight: "none", objectFit: "fill", transform: image.rotation ? `rotate(${image.rotation}deg)` : "none", transformOrigin: "center center" };
  }
  return <img ref={ref} className={className} src={image.dataUrl} alt="" draggable={false} onLoad={measure} style={style} />;
}
