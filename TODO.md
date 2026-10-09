# ComicBook AI — aktuella uppgifter

Uppdaterad 2026-10-09. Genomförda ändringar på testgrenen behöver slås ihop innan de finns på main.

## Genomfört på testgrenen

- [x] Sidmarginaler för överkant, underkant, vänster och höger i millimeter.
- [x] Mellanrum mellan bildrutornas kolumner och rader i millimeter.
- [x] Gemensam geometri för sidvy, export och drag/släpp; inställningar följer med backup.
- [x] IDML-export med separata lager, länkade bilder och redigerbar text/vektorgeometri.

## Pågående

- [ ] Importtesta IDML i InDesign och Affinity och jämför med samma album som PDF.
- [ ] Rätta eventuella problem med bildlänkar, fontstilar, textöverflöd och lagerordning.
- [ ] Beskära text och bubbelgrafik vid panelkonturer i IDML-exporten.

## Nästa funktioner

- [ ] Länka textbubblor med förbindelser som i användarens exempel; behåll separata redigerbara textområden och svansar. Stöd sammanhängande konturer utan invändiga ramlinjer.
- [ ] Blandad typografi inom en textruta: markera text och ändra typsnitt, storlek och vikt/stil för just markeringen. Radbrytning ska ta hänsyn till varje textdel. Bevara vanliga textlager och stöd export inklusive IDML:s teckenformat.
- [ ] Kontroller före export: text som inte får plats, saknade bilder och låg effektiv bildresolution.

## Senare

- [ ] Desktoplagring med projektmappar, separata bildfiler, atomisk sparning och återställning.
- [ ] Tryckexport med utfall och färghantering.
- [ ] CBZ-export.

Se PROJECT_SPEC.md för produktgränser och den övergripande planen. StoryBook får endast läsas genom användarvald export och får aldrig ändras av ComicBook.
