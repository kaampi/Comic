import { ManuscriptExportError, parseManuscriptExport, type ManuscriptExport } from "@ocedo-apps/storycore";

export type StoryBookImport = {
  kind: "storybook-ai.manuscript";
  format: 1;
  sourceBookId: string;
  title: string;
  text: string;
  illustrationStyle: string;
  chapters: Array<{ id: string; title: string; text: string }>;
  characters: Array<{ id: string; name: string; description: string; pronoun?: string; approximateAge?: number }>;
  locations: Array<{ id: string; name: string; description: string }>;
};

export type StoryBookCard = {
  id: string; name: string; personality: string; appearance: string; pronoun?: string;
  approximateAge?: number; portraitDataUrl?: string;
};
export type StoryBookCardsImport = { kind: "ai-sandbox-library"; format: 1; characters: StoryBookCard[] };

const array = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

type ExportedBibleEntity = ManuscriptExport["bible"][number]["entities"][number];

function entitiesOfKind(manuscript: ManuscriptExport, kind: "characters" | "locations"): ExportedBibleEntity[] {
  return manuscript.bible.find((section) => section.kind === kind)?.entities ?? [];
}

/**
 * One description string per entity, from every structured field StoryCore
 * gives us — looks, personality, and every locked fact's value — instead of
 * the old guessed import's "pick the first field that happens to exist"
 * (description/summary/profile/notes/personality/looks). StoryCore has
 * already resolved status, visibility, and classification; nothing here
 * needs to guess at any of that again.
 */
function describeEntity(entity: ExportedBibleEntity): string {
  const parts: string[] = [];
  if (entity.looks) parts.push(entity.looks);
  if (entity.personality) parts.push(entity.personality);
  for (const fact of entity.facts) parts.push(fact.value);
  return parts.join("\n");
}

/**
 * Reads a StoryBook AI export produced by its "Export for other apps"
 * button (StoryCore's `ManuscriptExportSchema`) — not StoryBook AI's own
 * internal backup/restore format, which is a different, much larger shape
 * not meant for other apps to read directly.
 *
 * Replaces an earlier version of this function that duck-typed StoryBook
 * AI's internal backup JSON directly (guessed field names, inferred entity
 * kind from ad-hoc heuristics). That version only ever recognized
 * characters and locations — objects, groups, events, and concepts were
 * silently dropped — and read every fact regardless of whether the author
 * had actually approved and locked it, or hidden it from the model.
 * StoryCore's export already excludes anything not locked, visible, and
 * not hidden, so none of that filtering needs reimplementing here.
 *
 * Objects/groups/events/concepts aren't surfaced into `StoryBookImport`
 * yet — `ComicProject` (`project.ts`) and the import review UI
 * (`App.tsx`) only have fields for characters and locations today. Adding
 * the other four kinds is a separate, larger change to that data model and
 * UI, not folded in here.
 */
export function parseStoryBookExport(raw: string): StoryBookImport {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Filen är inte giltig JSON.");
  }

  let manuscript: ManuscriptExport;
  try {
    manuscript = parseManuscriptExport(data);
  } catch (err) {
    if (err instanceof ManuscriptExportError) {
      if (err.code === "newer-format") {
        throw new Error("Den här exporten använder en nyare version av StoryCore-formatet än den här appen förstår än. Uppdatera ComicBook AI och försök igen.");
      }
      throw new Error(
        "Filen är inte en StoryBook AI-export. Exportera på nytt från StoryBook AI med knappen \"Exportera för andra appar\" (bredvid Backup)."
      );
    }
    throw err;
  }

  return {
    kind: "storybook-ai.manuscript",
    format: 1,
    sourceBookId: manuscript.sourceBookId,
    title: manuscript.title || "Importerat StoryBook-manus",
    text: manuscript.chapters.map((chapter) => chapter.prose).filter(Boolean).join("\n\n"),
    illustrationStyle: manuscript.illustrationStyle,
    chapters: manuscript.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title || "Kapitel", text: chapter.prose })),
    characters: entitiesOfKind(manuscript, "characters").map((entity) => ({
      id: entity.entity_ref,
      name: entity.name,
      description: describeEntity(entity),
      ...(entity.pronoun ? { pronoun: entity.pronoun } : {}),
      ...(entity.approximateAge !== undefined ? { approximateAge: entity.approximateAge } : {})
    })),
    locations: entitiesOfKind(manuscript, "locations").map((entity) => ({
      id: entity.entity_ref,
      name: entity.name,
      description: describeEntity(entity)
    }))
  };
}

export function parseStoryBookCards(raw: string): StoryBookCardsImport {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Cards-filen är inte giltig JSON.");
  }
  if (data?.kind !== "ai-sandbox-library" || data?.format !== 1) throw new Error("Filen är inte en StoryBook Cards-export i format 1.");
  const characters = array(data.characters)
    .map((item) => {
      const pronoun = str(item?.pronoun) || undefined;
      const approximateAge = num(item?.approximateAge);
      const portraitDataUrl = str(item?.portraitDataUrl) || undefined;
      return {
        id: str(item?.id),
        name: str(item?.name),
        personality: str(item?.personality),
        appearance: str(item?.appearance),
        ...(pronoun ? { pronoun } : {}),
        ...(approximateAge !== undefined ? { approximateAge } : {}),
        ...(portraitDataUrl ? { portraitDataUrl } : {})
      };
    })
    .filter((x) => x.name);
  return { kind: data.kind, format: 1, characters };
}

export function cardMatchesBook(card: StoryBookCard, bookId: string): boolean {
  return Boolean(bookId) && card.id.startsWith(`sb-${bookId}-`);
}
