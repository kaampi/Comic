# ComicBook AI

En fristående desktopapp som omvandlar litterär text till illustrerade serier med redigerbart manus, karaktärsreferenser, sidlayout och pratbubblor.

**Status:** planering. Repot innehåller projektspecifikation och arbetsregler; ingen körbar app ännu.

## Grundprinciper

- Projekt, text, referensbilder och genererade bilder sparas lokalt.
- AI-generering kan använda molntjänster. Manusmodell och bildmodell väljs separat.
- Redigering, sidplanering och export ska fungera utan internet när projektets resurser finns lokalt.
- StoryBook AI kopplas in enbart genom import av exportfiler.
- **ComicBook AI får aldrig ändra StoryBook AI:s data, filer, inställningar eller repository.**
- Import skapar en självständig kopia. Ingen återskrivning, synkronisering eller direkt åtkomst till StoryBooks lagring.
- StoryCore är en möjlig framtida integration, inte ett beroende för första versionen.

## Dokumentation

- [PROJECT_SPEC.md](PROJECT_SPEC.md): funktioner, arkitektur, datamodell och utvecklingsplan.
- [AGENTS.md](AGENTS.md): regler för arbete i detta repository.

## Första milstolpen

Ett komplett flöde för en kort serie på 1–3 sidor: text eller StoryBook-import → redigerbart seriemanus → sidmallar → bildgenerering → textlager → export.

Teknikförslaget är React, TypeScript, Vite och Tauri. Val av AI-tjänster och övriga bibliotek fastställs vid implementation.
