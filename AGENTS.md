# Arbetsregler för kaampi Comic

## Produktgräns

kaampi Comic är en fristående desktopapp med lokal projektlagring. AI-generering får använda molntjänster.

**Ändra aldrig kaampi Write:s repository, data, filer eller inställningar som del av arbete i detta projekt.**

Kopplingen till StoryBook är enbart skrivskyddad import av en användarvald exportfil. Importen skapar en självständig kopia. Ingen direkt åtkomst till StoryBooks lagring, synkronisering eller återskrivning får införas.

kaampi Codex är en framtida möjlighet, inte ett implementationsberoende.

## Arbete i detta repository

- Läs PROJECT_SPEC.md före implementationsarbete.
- Skilj överenskomna produktkrav från ännu inte beslutade teknikval.
- Bevara stabila ID:n och lokala bildversioner.
- Spara inte manus, användarprojekt, API-nycklar eller andra hemligheter i git.
- Import och lokal redigering får inte automatiskt skicka data till en AI-tjänst.
- Kontrollera att import inte ändrar källfilen och att genereringsfel inte skadar projektet.
