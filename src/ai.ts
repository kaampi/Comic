export type AiMode = "prompt" | "api" | "local";

export const AI_MODES: ReadonlyArray<{
  id: AiMode;
  label: string;
  description: string;
  available: boolean;
}> = [
  {
    id: "prompt",
    label: "Skapa prompter",
    description: "kaampi Comic skapar färdiga bildprompter som du kan kopiera till valfri bild-AI.",
    available: true
  },
  {
    id: "api",
    label: "API-nyckel",
    description: "Generera bilder via en extern AI-tjänst direkt från appen.",
    available: false
  },
  {
    id: "local",
    label: "Lokal AI",
    description: "Anslut en lokal bildmodell som körs på din egen dator.",
    available: false
  }
];