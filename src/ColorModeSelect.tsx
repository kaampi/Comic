import type { IllustrationStyle } from "./stylesLibrary";
import { COLOR_MODES, renderOptionsForStyle, resolveColorMode, supportedColorModes, type ColorMode, type RenderOptions } from "./styleColorMode";

export function ColorModeSelect({ style, options, locale, onChange }: { style: IllustrationStyle; options?: RenderOptions; locale: string; onChange: (options: RenderOptions) => void }) {
  const sv = locale === 'sv', nb = locale === 'nb';
  const names: Record<ColorMode, string> = sv ? { color: 'Färg', grayscale: 'Svartvitt (gråskala)', 'line-art': 'Enbart linjer' } : nb ? { color: 'Farge', grayscale: 'Svart-hvitt (gråtoner)', 'line-art': 'Bare linjer' } : { color: 'Color', grayscale: 'Black and white (grayscale)', 'line-art': 'Lines only' };
  const modes = supportedColorModes(style);
  return <label>{sv ? 'Färgläge' : nb ? 'Fargemodus' : 'Color mode'}<select value={resolveColorMode(style, options)} onChange={e => onChange(renderOptionsForStyle(style, { colorMode: e.target.value as ColorMode }))}>{COLOR_MODES.map(mode => <option key={mode} value={mode} disabled={!modes.includes(mode)}>{names[mode]}</option>)}</select>{modes.length === 1 ? <small>{sv ? 'Den här stilen stöder endast ' : nb ? 'Denne stilen støtter bare ' : 'This style only supports '}{names[modes[0]].toLowerCase()}.</small> : null}</label>;
}
