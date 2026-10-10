import { useEffect, useRef } from "react";
import type { TextOverlay } from "./project";
import { overlayTextLayout, type LayerTextMetrics } from "./pageTypography";

// Use SvgOverlay's physical text coordinates for the same scale and rotation.
export function InlineOverlayEditor({ overlay, textMetrics, label, onChange, onFinish, onCancel }: {
  overlay: TextOverlay;
  textMetrics: LayerTextMetrics;
  label: string;
  onChange: (text: string) => void;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
    const outside = (event: PointerEvent) => {
      if (!ref.current?.closest(".inline-overlay-editor")?.contains(event.target as Node)) finishRef.current();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [overlay.id]);
  const layout = overlayTextLayout(overlay, textMetrics);
  const padding = layout.width * Math.max(0, Math.min(25, overlay.textPadding ?? 4)) / 100;
  return <g className="inline-overlay-editor" transform={`translate(${overlay.x} ${overlay.y}) scale(${100 / textMetrics.width} ${100 / textMetrics.height}) rotate(${overlay.rotation} ${layout.width / 2} ${layout.height / 2})`}>
    <foreignObject width={layout.width} height={layout.height}>
      <div className="inline-overlay-editor-body" style={{ paddingInline: padding }} onPointerDown={event => event.stopPropagation()}>
        <textarea
          ref={ref}
          aria-label={label}
          spellCheck={false}
          value={overlay.text}
          style={{
            fontFamily: overlay.fontFamily ?? (overlay.type === "sfx" ? "Impact, sans-serif" : "Comic Neue, sans-serif"),
            fontSize: layout.fontSize,
            fontWeight: overlay.fontWeight ?? (overlay.type === "sfx" ? 800 : 600),
            textAlign: overlay.textAlign ?? "center",
            color: overlay.sfxTextColor ?? "#171411",
            height: Math.max(1, layout.textLines.length) * layout.fontSize * 1.15,
          }}
          onChange={event => onChange(event.target.value)}
          onBlur={onFinish}
          onPointerDown={event => event.stopPropagation()}
          onDoubleClick={event => event.stopPropagation()}
          onKeyDown={event => {
            event.stopPropagation();
            if (event.key === "Escape" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
    </foreignObject>
  </g>;
}
