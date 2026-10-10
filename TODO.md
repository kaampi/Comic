# ComicBook AI — aktuella uppgifter

Uppdaterad 2026-10-09. IDML-export (beta), sidmarginaler och mellanrum mellan bildrutor finns på main.

## Genomfört

- [x] Sidmarginaler för överkant, underkant, vänster och höger i millimeter.
- [x] Mellanrum mellan bildrutornas kolumner och rader i millimeter.
- [x] Gemensam geometri för sidvy, export och drag/släpp; inställningar följer med backup.
- [x] IDML-export med separata lager, länkade bilder och redigerbar text/vektorgeometri.

## Pågående

- [ ] Importtesta IDML i InDesign och Affinity och jämför med samma album som PDF.
- [ ] Rätta eventuella problem med bildlänkar, fontstilar, textöverflöd och lagerordning.
- [ ] Beskära text och bubbelgrafik vid panelkonturer i IDML-exporten.

## Nästa funktioner

- [x] Länka prat- och tankebubblor med förbindelser; separata redigerbara textområden och svansar, justerbar förbindelsebredd, gemensam kontur utan invändiga ramlinjer samt export inklusive IDML.
- [ ] Blandad typografi inom en textruta: markera text och ändra typsnitt, storlek och vikt/stil för just markeringen. Radbrytning ska ta hänsyn till varje textdel. Bevara vanliga textlager och stöd export inklusive IDML:s teckenformat.
- [ ] Kontroller före export: text som inte får plats, saknade bilder och låg effektiv bildresolution.

## Senare

- [ ] Desktoplagring med projektmappar, separata bildfiler, atomisk sparning och återställning.
- [ ] Tryckexport med utfall och färghantering.
- [ ] CBZ-export.

Se PROJECT_SPEC.md för produktgränser och den övergripande planen. StoryBook får endast läsas genom användarvald export och får aldrig ändras av ComicBook.

