import type { IllustrationStyle } from "./stylesLibrary";

export type ColorMode = 'color' | 'grayscale' | 'line-art';
export const COLOR_MODES: ColorMode[] = ['color', 'grayscale', 'line-art'];
export type RenderOptions = { linesOnly: boolean; colorMode?: ColorMode };
export function supportedColorModes(style: IllustrationStyle): ColorMode[] {
  const modes = Array.isArray(style.supportedColorModes) ? style.supportedColorModes.filter(mode => COLOR_MODES.includes(mode)) : undefined;
  return modes?.length ? modes : [...COLOR_MODES];
}
export function resolveColorMode(style: IllustrationStyle, options?: Partial<RenderOptions>): ColorMode {
  const requested = options?.colorMode ?? (options?.linesOnly ? 'line-art' : 'color');
  const modes = supportedColorModes(style);
  return modes.includes(requested) ? requested : modes[0];
}
export function renderOptionsForStyle(style: IllustrationStyle, options?: Partial<RenderOptions>): RenderOptions {
  const colorMode = resolveColorMode(style, options);
  return { colorMode, linesOnly: colorMode === 'line-art' };
}
export const grayscaleModifier = 'Render entirely in black, white, and neutral grayscale, with a full tonal range. Preserve the selected medium, texture, brushwork or halftone technique. No color, sepia, beige paper, tinted highlights, or selective color.';
export function stylePromptForMode(style: IllustrationStyle, mode: ColorMode): string {
  return style.modePromptText?.[mode] ?? style.promptText;
}
