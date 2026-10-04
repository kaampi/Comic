import type { ComicProject, OverlayType } from "./project";
import type { Locale } from "./settings";
import {
  overlayDefaults,
  OVERLAY_FONTS,
  type OverlayTypography,
} from "./overlayTypography";
export function OverlayDefaultsEditor({
  project,
  locale,
  onChange,
}: {
  project: ComicProject;
  locale: Locale;
  onChange: (type: OverlayType, value: OverlayTypography) => void;
}) {
  const sv = locale === "sv";
  return (
    <details className="panel-tool-card">
      <summary>
        {sv
          ? "Standardvärden för text och bubblor"
          : "Text and bubble defaults"}
      </summary>
      <p className="quiet">
        {sv
          ? "Gäller nya textlager i detta album. Befintliga texter behåller sina värden."
          : "Applies to new text layers in this album. Existing text keeps its settings."}
      </p>
      {(["speech", "thought", "caption", "sfx"] as OverlayType[]).map(
        (type, index) => {
          const value = overlayDefaults(project, type),
            patch = (part: Partial<OverlayTypography>) =>
              onChange(type, { ...value, ...part });
          return (
            <details key={type}>
              <summary>
                {
                  (sv
                    ? [
                        "Pratbubbla",
                        "Tankebubbla",
                        "Berättartext",
                        "Ljudeffekt",
                      ]
                    : ["Speech", "Thought", "Caption", "Sound effect"])[index]
                }
              </summary>
              <label>
                {sv ? "Rundning" : "Roundness"}
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={value.roundness}
                  onChange={(e) =>
                    patch({
                      roundness: Math.max(
                        0,
                        Math.min(100, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
              <label>
                {sv ? "Font" : "Font"}
                <select
                  value={value.fontFamily}
                  onChange={(e) => patch({ fontFamily: e.target.value })}
                >
                  {OVERLAY_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font.split(",")[0]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {sv ? "Textstorlek" : "Text size"}
                <input
                  type="number"
                  min="1"
                  max="120"
                  step="0.5"
                  value={value.fontSize}
                  onChange={(e) =>
                    patch({
                      fontSize: Math.max(
                        1,
                        Math.min(120, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
              <label>
                {sv ? "Textvikt" : "Text weight"}
                <select
                  value={value.fontWeight}
                  onChange={(e) =>
                    patch({ fontWeight: Number(e.target.value) })
                  }
                >
                  {[300, 400, 500, 600, 700, 800, 900].map((weight) => (
                    <option key={weight} value={weight}>
                      {weight}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {sv ? "Textjustering" : "Text alignment"}
                <select
                  value={value.textAlign}
                  onChange={(e) =>
                    patch({
                      textAlign: e.target
                        .value as OverlayTypography["textAlign"],
                    })
                  }
                >
                  {["left", "center", "right"].map((align, i) => (
                    <option key={align} value={align}>
                      {
                        (sv
                          ? ["Vänster", "Centrerad", "Höger"]
                          : ["Left", "Center", "Right"])[i]
                      }
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {sv ? "Sidmarginal (%)" : "Side padding (%)"}
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={value.textPadding}
                  onChange={(e) =>
                    patch({
                      textPadding: Math.max(
                        0,
                        Math.min(25, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
            </details>
          );
        },
      )}
    </details>
  );
}
