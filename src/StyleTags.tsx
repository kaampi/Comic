import { useState } from "react";
import { builtinTags, type StyleOrganization } from "./styleOrganization";
import type { IllustrationStyle } from "./stylesLibrary";
import "./styleOrganization.css";

export function StyleTags({ style, value, onChange, sv }: { style: IllustrationStyle; value: StyleOrganization; onChange: (next: StyleOrganization) => void; sv: boolean }) {
  const [name, setName] = useState("");
  const assigned = value.assignments[style.id] ?? [];
  const toggle = (id: string) => onChange({ ...value, assignments: { ...value.assignments, [style.id]: assigned.includes(id) ? assigned.filter(x => x !== id) : [...assigned, id] } });
  return <div className="style-tags" onClick={e => e.stopPropagation()}>
    <button type="button" className="text-button" aria-label={`${sv ? "Favorit" : "Favorite"}: ${style.name}`} aria-pressed={value.favorites.includes(style.id)} onClick={() => onChange({ ...value, favorites: value.favorites.includes(style.id) ? value.favorites.filter(id => id !== style.id) : [...value.favorites, style.id] })}>{value.favorites.includes(style.id) ? "★" : "☆"} {sv ? "Favorit" : "Favorite"}</button>
    <div className="style-tag-chips">{[...new Set([...builtinTags(style, sv), ...assigned.map(id => value.tags[id])])].map(tag => <span key={tag}>{tag}</span>)}</div>
    <details><summary>{sv ? "Hantera taggar" : "Manage tags"}</summary>
      {Object.entries(value.tags).map(([id, label]) => <label key={id}><input type="checkbox" checked={assigned.includes(id)} onChange={() => toggle(id)} />{label}</label>)}
      <form onSubmit={e => { e.preventDefault(); const label = name.trim().slice(0, 80); if (!label) return; const id = Object.keys(value.tags).find(id => value.tags[id].toLocaleLowerCase() === label.toLocaleLowerCase()) ?? `tag-${crypto.randomUUID()}`; onChange({ ...value, tags: { ...value.tags, [id]: value.tags[id] ?? label }, assignments: { ...value.assignments, [style.id]: [...new Set([...assigned, id])] } }); setName(""); }}><input aria-label={sv ? "Ny tagg" : "New tag"} placeholder={sv ? "Ny tagg" : "New tag"} maxLength={80} value={name} onChange={e => setName(e.target.value)} /><button type="submit">{sv ? "Lägg till" : "Add"}</button></form>
    </details>
  </div>;
}

export function OwnTagManager({ value, onChange, sv }: { value: StyleOrganization; onChange: (next: StyleOrganization) => void; sv: boolean }) {
  return <details className="own-tag-manager"><summary>{sv ? "Redigera egna taggar" : "Edit personal tags"}</summary>{Object.entries(value.tags).map(([id, name]) => <form key={id} onSubmit={e => { e.preventDefault(); const label = String(new FormData(e.currentTarget).get("name")).trim(); if (label && !Object.entries(value.tags).some(([other, text]) => other !== id && text.toLocaleLowerCase() === label.toLocaleLowerCase())) onChange({ ...value, tags: { ...value.tags, [id]: label } }); }}><input key={name} name="name" defaultValue={name} maxLength={80} aria-label={sv ? `Byt namn på ${name}` : `Rename ${name}`} required /><button type="submit">{sv ? "Spara" : "Save"}</button><button type="button" onClick={() => { const tags = { ...value.tags }; delete tags[id]; onChange({ ...value, tags, assignments: Object.fromEntries(Object.entries(value.assignments).map(([style, ids]) => [style, ids.filter(x => x !== id)])) }); }}>{sv ? "Ta bort" : "Delete"}</button></form>)}</details>;
}
