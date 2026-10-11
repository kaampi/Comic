import type { PanelImage } from "./adaptation/types";
import type { Locale } from "./settings";
import { uiText } from "./i18n";
import { normalizedImageRotation } from "./imageView";

export function PanelImageControls({ image, locale, editing, onToggle, onRemove, onChange, onReset }: {
  image: PanelImage;
  locale: Locale;
  editing: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (patch: { flipX?: boolean; flipY?: boolean; zoom?: number; rotation?: number; offsetX?: number; offsetY?: number }) => void;
  onReset: () => void;
}) {
  const tr = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);
  return <section className="panel-image-controls" aria-label={tr("imageControls")}>
    <div className={editing ? "panel-image-controls-head is-editing" : "panel-image-controls-head"}>
      <button className={editing ? "primary-button compact-button" : "secondary-button compact-button"} type="button" aria-pressed={editing} onClick={onToggle}>
        {editing ? tr("finishImageEdit") : tr("editImage")}
      </button>
      {editing ? <p className="quiet image-edit-help">{tr("dragImageHint")}</p> : null}
      <button className="text-button danger-text" type="button" onClick={onRemove}>{tr("deleteImage")}</button>
    </div>
    <div className="image-position-row">
    <div className="image-position-grid">
      <label>{tr("imageX")} (%)<input type="number" min="-100" max="100" step="1" value={Math.round(image.offsetX ?? 0)} onChange={e => onChange({ offsetX: Math.max(-100, Math.min(100, Number(e.target.value) || 0)) })}/></label>
      <label>{tr("imageY")} (%)<input type="number" min="-100" max="100" step="1" value={Math.round(image.offsetY ?? 0)} onChange={e => onChange({ offsetY: Math.max(-100, Math.min(100, Number(e.target.value) || 0)) })}/></label>
      <label>{tr("zoom")} (%)<input type="number" min="10" max="400" step="5" value={Math.round((image.zoom ?? 1) * 100)} onChange={e => onChange({ zoom: Math.max(10, Math.min(400, Number(e.target.value) || 10)) / 100 })}/></label>
      <label>{tr("imageRotation")} (°)<input type="number" min="-180" max="180" step="1" value={image.rotation ?? 0} onChange={e => onChange({ rotation: normalizedImageRotation(Number(e.target.value) || 0) })}/></label>
    </div>
    {editing ? <div className="image-transform-actions">
      <button className="secondary-button compact-button" type="button" aria-pressed={!!image.flipX} onClick={() => onChange({ flipX: !image.flipX })}>{tr("flipImageHorizontal")}</button>
      <button className="secondary-button compact-button" type="button" aria-pressed={!!image.flipY} onClick={() => onChange({ flipY: !image.flipY })}>{tr("flipImageVertical")}</button>
      <button className="secondary-button compact-button image-reset-button" type="button" onClick={onReset}>{tr("resetImageView")}</button>
    </div> : null}
    </div>
  </section>;
}
