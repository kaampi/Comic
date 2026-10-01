export type StoryBookImport = {
  kind: "storybook-ai.manuscript";
  format: 1;
  title: string;
  text: string;
  chapters: Array<{ id: string; title: string; text: string }>;
  characters: Array<{ id: string; name: string; description: string }>;
  locations: Array<{ id: string; name: string; description: string }>;
};

const array = (value: unknown): any[] => Array.isArray(value) ? value : [];
const str = (value: unknown): string => typeof value === "string" ? value : "";

export function parseStoryBookExport(raw: string): StoryBookImport {
  let data: any;
  try { data = JSON.parse(raw); } catch { throw new Error("Filen är inte giltig JSON."); }
  if (data?.kind !== "storybook-ai.manuscript" || data?.format !== 1) throw new Error("Filen är inte en StoryBook AI-manusexport i format 1.");

  const manuscript = data.manuscript ?? data;
  const chapters = array(manuscript.chapters ?? data.chapters).map((item) => ({
    id: str(item?.id), title: str(item?.title ?? item?.name) || "Kapitel", text: str(item?.text ?? item?.content)
  })).filter((item) => item.text || item.title);
  const characters = array(data.characters ?? manuscript.characters).map((item) => ({
    id: str(item?.id), name: str(item?.name), description: str(item?.description ?? item?.profile ?? item?.notes)
  })).filter((item) => item.name);
  const locations = array(data.locations ?? data.places ?? manuscript.locations ?? manuscript.places).map((item) => ({
    id: str(item?.id), name: str(item?.name), description: str(item?.description ?? item?.profile ?? item?.notes)
  })).filter((item) => item.name);
  const text = str(manuscript.text ?? manuscript.content ?? data.text) || chapters.map((item) => item.text).join("\n\n");

  return { kind: data.kind, format: 1, title: str(manuscript.title ?? data.title) || "Importerat StoryBook-manus", text, chapters, characters, locations };
}
