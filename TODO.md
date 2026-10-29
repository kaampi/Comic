# kaampi Comic — aktuella uppgifter

Uppdaterad 2026-10-19. Exportkontroller, albumkort och den nya startguiden finns på main.

## Genomfört

- [x] Sidmarginaler för överkant, underkant, vänster och höger i millimeter.
- [x] Mellanrum mellan bildrutornas kolumner och rader i millimeter.
- [x] Gemensam geometri för sidvy, export och drag/släpp; inställningar följer med backup.
- [x] IDML-export med separata lager, länkade bilder och redigerbar text/vektorgeometri.

- [x] Startguide för namn, bildstil och textutseende; stora stilbilder med lightbox.
- [x] Albumkort med omslag, introduktion och StoryBook-märkning; thumbnails på startsidan och i projektlistan.
- [x] Kapitel från StoryBook och flödet Manus → Beats → Bildmanus → Bilder → Sidor.
- [x] Flytt av paneler inom sidan med långtryck, fri dragning och geléeffekt.
- [x] Sidövergripande förgrundsbilder med egna textlager.

- [x] IndexedDB-skydd mot överskrivning från gamla flikar/appinstanser och upp till tre atomiska återställningspunkter med nedladdning som albumbackup. Orsaken till tidigare rapporterad projektförlust är ännu inte fastställd.

- [x] Diskret röd Backup-påminnelse per album efter aktiv arbetstid eller nya bilder/paneler; kort puls, minskad rörelse, återställning vid skapad backup och tydliga Create/Restore backup-knappar.

## Pågående

- [ ] Kompilera och provköra Tauri-prototypen på Windows: omstart/lagring, backup, drag/släpp, export och NSIS-installation. Desktopskal och byggkommandon finns; Windows-bygge är ännu inte verifierat. Se DESKTOP.md.
- [ ] Importtesta IDML i InDesign och Affinity och jämför med samma album som PDF.
- [ ] Rätta eventuella problem med bildlänkar, fontstilar, textöverflöd och lagerordning.
- [ ] Beskära text och bubbelgrafik vid panelkonturer i IDML-exporten.

## Nästa funktioner

- [x] Länka prat- och tankebubblor med förbindelser; separata redigerbara textområden och svansar, justerbar förbindelsebredd, gemensam kontur utan invändiga ramlinjer samt export inklusive IDML.
- [x] Blandad typografi inom en textruta: markera text och ändra typsnitt, storlek och vikt för just markeringen. Radbrytning och radhöjd följer textdelarna. Direktredigering, återställning, lokal lagring, backup och export inklusive IDML:s teckenformat.
- [x] Kontroller före export: uppskattad textöverfyllnad, tomma/oläsbara bilder och låg effektiv bildupplösning vid exportens fysiska storlek. Visa öppnar berörd panel/text. Varningar tillåter läskopior; oläsbara bilder stoppar exporten.
- [x] Panelpool och väntande paneler per sida: flytta flera hela paneler, skapa målsida, dra/placera tillbaka, ångra, backup och exportpåminnelser. Sidborttagning och byte av rutnät bevarar panelerna i poolen.

## Senare

- [ ] Desktoplagring med projektmappar, separata bildfiler, atomisk sparning och återställning.
- [ ] Tryckexport med utfall och färghantering.
- [ ] CBZ-export.

Se PROJECT_SPEC.md för produktgränser och den övergripande planen. StoryBook får endast läsas genom användarvald export och får aldrig ändras av kaampi Comic.
