import { SFX_SHAPES } from "./sfxShapes";
import { SfxArtwork } from "./SfxArtwork";
import type { Locale } from "./settings";
import "./sfxPicker.css";
export function SfxPicker({
  value,
  locale,
  onChange,
}: {
  value: string;
  locale: Locale;
  onChange: (id: string) => void;
}) {
  return (
    <section className="sfx-picker">
      <p className="eyebrow">
        {locale === "sv" ? "SFX-bibliotek" : "SFX library"}
      </p>
      <div className="sfx-picker-grid">
        {SFX_SHAPES.map((shape) => (
          <button
            type="button"
            key={shape.id}
            aria-pressed={value === shape.id}
            onClick={() => onChange(shape.id)}
          >
            <svg viewBox="0 0 100 60" aria-hidden="true">
              <SfxArtwork shape={shape.id} width={100} height={60} />
              {shape.id === "none" ? (
                <text
                  x="50"
                  y="37"
                  fontSize="24"
                  fontWeight="800"
                  textAnchor="middle"
                  fill="#171411"
                >
                  BOOM!
                </text>
              ) : null}
            </svg>
            <span>{locale === "sv" ? shape.sv : shape.en}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
