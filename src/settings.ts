export type Theme = "dark" | "light";
export type Locale = "sv" | "en" | "nb";
const THEME_KEY = "comicbook-ai.theme";
const LOCALE_KEY = "comicbook-ai.locale";
export const LOCALES: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: "sv", label: "Svenska" }, { id: "en", label: "English" }, { id: "nb", label: "Norsk" }
];
export function readTheme(): Theme { try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; } catch { return "dark"; } }
export function applyTheme(theme: Theme): void { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; try { localStorage.setItem(THEME_KEY, theme); } catch {} }
export function readLocale(): Locale {
  try { const stored = localStorage.getItem(LOCALE_KEY); if (stored === "sv" || stored === "en" || stored === "nb") return stored; } catch {}
  const language = typeof navigator === "undefined" ? "" : navigator.language.toLowerCase();
  if (language.startsWith("sv")) return "sv";
  if (language.startsWith("nb") || language.startsWith("no")) return "nb";
  return "en";
}
export function applyLocale(locale: Locale): void { document.documentElement.lang = locale; document.documentElement.dataset.locale = locale; try { localStorage.setItem(LOCALE_KEY, locale); } catch {} }
export type PageGridDefaults = { gridColumns: number; gridRows: number };
const PAGE_GRID_KEY = "comicbook-ai.page-grid";
export function readPageGridDefaults(): PageGridDefaults {
  try { const value = JSON.parse(localStorage.getItem(PAGE_GRID_KEY) ?? "null"); if (value && Number.isInteger(value.gridColumns) && Number.isInteger(value.gridRows)) return value; } catch {}
  return { gridColumns: 3, gridRows: 5 };
}
export function savePageGridDefaults(value: PageGridDefaults): void {
  try { localStorage.setItem(PAGE_GRID_KEY, JSON.stringify(value)); } catch {}
}
