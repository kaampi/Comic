export const SFX_SHAPES = [
  { id: "none", sv: "Enbart text", en: "Text only" },
  { id: "burst", sv: "Explosion", en: "Explosion" },
  { id: "impact", sv: "Smäll", en: "Impact" },
  { id: "cloud", sv: "Puff", en: "Puff" },
  { id: "lightning", sv: "Blixt", en: "Lightning" },
  { id: "speed", sv: "Fartstreck", en: "Speed lines" },
  { id: "sweep", sv: "Svep", en: "Sweep" },
  { id: "spiral", sv: "Spiral", en: "Spiral" },
  { id: "star", sv: "Stjärna", en: "Star" },
  { id: "stars", sv: "Stjärnkluster", en: "Star cluster" },
  { id: "exclamation", sv: "Utrop", en: "Exclamation" },
  { id: "question", sv: "Frågetecken", en: "Question" },
  { id: "heart", sv: "Hjärta", en: "Heart" },
  { id: "arrow", sv: "Pil", en: "Arrow" },
];
export type SfxPrimitive = { d: string; fill: boolean };
function star(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points: number,
  inner: number,
  phase = -Math.PI / 2,
) {
  return (
    Array.from({ length: points * 2 }, (_, i) => {
      const a = phase + (i * Math.PI) / points,
        r = i % 2 ? inner : 1;
      return `${i ? "L" : "M"} ${cx + Math.cos(a) * rx * r} ${cy + Math.sin(a) * ry * r}`;
    }).join(" ") + " Z"
  );
}
export function sfxPrimitives(id: string): SfxPrimitive[] {
  const filled = (d: string) => ({ d, fill: true }),
    line = (d: string) => ({ d, fill: false });
  switch (id) {
    case "burst":
      return [filled(star(50, 30, 47, 27, 13, 0.63))];
    case "impact":
      return [
        filled(
          "M 10 17 Q 24 19 22 5 Q 37 16 42 3 Q 50 18 64 4 Q 65 19 87 12 Q 75 29 96 35 Q 78 35 87 54 Q 67 43 62 58 Q 53 44 36 57 Q 38 42 13 50 Q 27 34 3 28 Q 21 26 10 17 Z",
        ),
      ];
    case "cloud":
      return [
        filled(
          "M 14 39 C 1 40 0 20 15 20 C 12 6 31 1 40 12 C 48 -1 67 2 70 15 C 90 8 102 23 88 34 C 104 46 79 61 67 49 C 58 62 39 59 36 48 C 18 58 6 48 14 39 Z",
        ),
      ];
    case "lightning":
      return [filled("M 64 3 L 29 32 L 47 32 L 34 57 L 76 23 L 55 25 Z")];
    case "speed":
      return [
        line(
          "M 5 17 L 84 15 M 19 23 L 95 22 M 4 30 L 89 29 M 16 37 L 97 35 M 8 44 L 79 43",
        ),
      ];
    case "sweep":
      return [
        line("M 6 48 Q 42 8 94 15 M 14 50 Q 47 18 96 23 M 31 47 Q 60 28 92 31"),
      ];
    case "spiral": {
      let d = "";
      for (let i = 0; i <= 150; i++) {
        const t = i / 150,
          a = t * Math.PI * 6,
          r = 2 + t * 24;
        d += `${i ? "L" : "M"} ${50 + Math.cos(a) * r * 1.65} ${30 + Math.sin(a) * r}`;
      }
      return [line(d)];
    }
    case "star":
      return [filled(star(50, 30, 32, 27, 5, 0.43))];
    case "stars":
      return [
        filled(star(33, 30, 23, 23, 5, 0.43)),
        filled(star(74, 15, 13, 12, 5, 0.43)),
        filled(star(73, 47, 9, 8, 5, 0.43)),
      ];
    case "exclamation":
      return [
        filled(
          "M 30 5 L 41 7 L 34 39 L 29 39 Z M 28 45 C 18 43 18 56 26 56 C 35 57 37 46 28 45 Z M 59 3 L 70 5 L 62 37 L 56 37 Z M 55 44 C 47 44 47 56 55 56 C 64 56 64 44 55 44 Z",
        ),
      ];
    case "question":
      return [
        line("M 27 17 C 27 0 72 -2 72 17 C 72 30 50 29 50 40"),
        filled("M 55 50 A 5 5 0 1 1 45 50 A 5 5 0 1 1 55 50 Z"),
      ];
    case "heart":
      return [
        filled(
          "M 50 55 C 36 46 12 31 16 15 C 20 0 40 3 50 17 C 60 3 80 0 84 15 C 88 31 64 46 50 55 Z",
        ),
      ];
    case "arrow":
      return [
        filled(
          "M 8 24 Q 42 13 62 20 L 61 6 L 95 30 L 63 55 L 63 40 Q 35 34 9 41 Z",
        ),
      ];
    default:
      return [];
  }
}
