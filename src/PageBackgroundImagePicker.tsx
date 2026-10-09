import { useRef } from "react";

export function PageBackgroundImagePicker({ image, locale, onUpload, onRemove }: {
  image?: { name: string; dataUrl: string };
  locale: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const change = locale === "sv" ? "Byt bakgrundsbild" : locale === "nb" ? "Bytt bakgrunnsbilde" : "Change background image";
  const upload = locale === "sv" ? "Ladda upp bakgrundsbild" : locale === "nb" ? "Last opp bakgrunnsbilde" : "Upload background image";
  const remove = locale === "sv" ? "Ta bort bakgrundsbild" : locale === "nb" ? "Fjern bakgrunnsbilde" : "Remove background image";
  return <div className="page-background-image-picker">
    <input ref={input} className="page-background-file-input" type="file" aria-label={image ? change : upload} accept="image/png,image/jpeg,image/webp" onChange={event => {
      const file = event.target.files?.[0];
      if (file) onUpload(file);
      event.currentTarget.value = "";
    }} />
    {image ? <>
      <img className="page-background-thumbnail" src={image.dataUrl} alt={image.name} />
      <span className="page-background-filename" title={image.name}>{image.name}</span>
      <div className="page-background-image-actions">
        <button type="button" className="page-background-icon-button" aria-label={change} title={change} onClick={() => input.current?.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-3-3L6 16l-2 4Z" /></svg>
        </button>
        <button type="button" className="page-background-icon-button danger-button" aria-label={remove} title={remove} onClick={onRemove}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
        </button>
      </div>
    </> : <button type="button" className="page-background-action-button" onClick={() => input.current?.click()}>{upload}</button>}
  </div>;
}
