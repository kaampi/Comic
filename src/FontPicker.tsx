import { useEffect, useId, useRef, useState } from "react";
import { OVERLAY_FONTS } from "./overlayTypography";

export function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (font: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: "", time: 0 });
  const fonts = OVERLAY_FONTS.includes(value) ? OVERLAY_FONTS : [value, ...OVERLAY_FONTS];
  const selected = Math.max(0, fonts.indexOf(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  function choose(index: number) {
    onChange(fonts[index]);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className="font-picker" ref={root} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <span className="font-picker-label" id={id + "-label"}>{label}</span>
      <button
        ref={trigger}
        type="button"
        className="font-picker-trigger"
        role="combobox"
        aria-labelledby={id + "-label"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id + "-list" : undefined}
        aria-activedescendant={open ? id + "-option-" + active : undefined}
        onClick={() => { setActive(selected); search.current.text = ""; setOpen(!open); }}
        onKeyDown={event => {
          const key = event.key;
          if (key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (key === "ArrowDown" || key === "ArrowUp") {
            event.preventDefault();
            if (!open) { setActive(selected); setOpen(true); }
            else setActive(index => (index + (key === "ArrowDown" ? 1 : -1) + fonts.length) % fonts.length);
          } else if (open && (key === "Home" || key === "End")) {
            event.preventDefault();
            setActive(key === "Home" ? 0 : fonts.length - 1);
          } else if (open && (key === "Enter" || key === " ")) {
            event.preventDefault();
            choose(active);
          } else if (key.length === 1 && key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            const now = Date.now();
            search.current.text = (now - search.current.time < 700 ? search.current.text : "") + key.toLowerCase();
            search.current.time = now;
            const index = fonts.findIndex(font => font.toLowerCase().startsWith(search.current.text));
            if (index >= 0) { setActive(index); setOpen(true); }
          }
        }}
      >
        <span className="font-picker-preview" style={{ fontFamily: value }}>{value.split(",")[0]}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="font-picker-list" id={id + "-list"} role="listbox" aria-labelledby={id + "-label"}>
          {fonts.map((font, index) => (
            <button
              key={font}
              id={id + "-option-" + index}
              type="button"
              role="option"
              aria-selected={font === value}
              tabIndex={-1}
              className="font-picker-option"
              data-active={index === active}
              onPointerMove={() => setActive(index)}
              onPointerDown={event => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span className="font-picker-preview" style={{ fontFamily: font }}>{font.split(",")[0]}</span>
              <span className="font-picker-check" aria-hidden="true">{font === value ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
