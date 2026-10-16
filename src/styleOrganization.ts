import type { IllustrationStyle } from "./stylesLibrary";

export type StyleOrganization = { tags: Record<string, string>; assignments: Record<string, string[]>; favorites: string[] };
const KEY = "comicbook-ai.style-organization.v1";
export const emptyOrganization = (): StyleOrganization => ({ tags: {}, assignments: {}, favorites: [] });
export function parseOrganization(value: unknown): StyleOrganization {
  if (!value || typeof value !== "object") throw new Error("invalid-style-organization");
  const v = value as StyleOrganization;
  if (!v.tags || !v.assignments || Array.isArray(v.tags) || Array.isArray(v.assignments) || typeof v.tags !== "object" || typeof v.assignments !== "object" || !Array.isArray(v.favorites) || !v.favorites.every(x => typeof x === "string")) throw new Error("invalid-style-organization");
  if (!Object.entries(v.tags).every(([id, name]) => id.startsWith("tag-") && typeof name === "string" && name.trim().length > 0 && name.length <= 80)) throw new Error("invalid-style-organization");
  if (!Object.values(v.assignments).every(ids => Array.isArray(ids) && ids.every(id => typeof id === "string" && Object.hasOwn(v.tags, id)))) throw new Error("invalid-style-organization");
  return structuredClone({ tags: v.tags, assignments: v.assignments, favorites: [...new Set(v.favorites)] });
}
export function readOrganization(): StyleOrganization {
  try { const raw = localStorage.getItem(KEY); return raw ? parseOrganization(JSON.parse(raw)) : emptyOrganization(); } catch { return emptyOrganization(); }
}
export function saveOrganization(value: StyleOrganization) { localStorage.setItem(KEY, JSON.stringify(value)); }
export function mergeOrganization(current: StyleOrganization, incoming: StyleOrganization): StyleOrganization {
  const next = structuredClone(current), ids: Record<string, string> = {};
  for (const [id, name] of Object.entries(incoming.tags)) {
    const existing = Object.entries(next.tags).find(([, n]) => n.toLocaleLowerCase() === name.toLocaleLowerCase());
    const target = existing?.[0] ?? (Object.hasOwn(next.tags, id) ? `tag-${crypto.randomUUID()}` : id);
    ids[id] = target; next.tags[target] = existing?.[1] ?? name;
  }
  for (const [style, tags] of Object.entries(incoming.assignments)) next.assignments[style] = [...new Set([...(next.assignments[style] ?? []), ...tags.map(id => ids[id])])];
  next.favorites = [...new Set([...next.favorites, ...incoming.favorites])];
  return next;
}
export function builtinTags(style: IllustrationStyle, sv: boolean): string[] {
  if (style.id.startsWith("custom-")) return [];
  const tags = [style.genre];
  if (["anchor-2", "eu-rounded-caricature", "eu-economical-figures", "hum-3"].includes(style.id)) tags.push(sv ? "Humor" : "Humour");
  if (["paint-gouache", "draw-colored-pencil"].includes(style.id)) tags.push(sv ? "Barnbok" : "Children’s books");
  if (["fb-1", "anchor-2", "eu-rounded-caricature", "eu-economical-figures"].includes(style.id)) tags.push(sv ? "Äventyr" : "Adventure");
  return tags;
}
