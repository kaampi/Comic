export type PageTemplate = {
  id: string;
  name: string;
  slots: Array<{ col: number; row: number; colSpan: number; rowSpan: number }>;
};

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: "four-equal", name: "4 lika rutor", slots: [
    { col: 1, row: 1, colSpan: 2, rowSpan: 2 }, { col: 3, row: 1, colSpan: 2, rowSpan: 2 },
    { col: 1, row: 3, colSpan: 2, rowSpan: 2 }, { col: 3, row: 3, colSpan: 2, rowSpan: 2 }
  ]},
  { id: "wide-plus-two", name: "Bred + två", slots: [
    { col: 1, row: 1, colSpan: 4, rowSpan: 2 }, { col: 1, row: 3, colSpan: 2, rowSpan: 2 },
    { col: 3, row: 3, colSpan: 2, rowSpan: 2 }
  ]},
  { id: "hero-plus-three", name: "Stor + tre", slots: [
    { col: 1, row: 1, colSpan: 3, rowSpan: 3 }, { col: 4, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 4, row: 2, colSpan: 1, rowSpan: 1 }, { col: 4, row: 3, colSpan: 1, rowSpan: 1 }
  ]},
  { id: "six-grid", name: "6 rutor", slots: [
    { col: 1, row: 1, colSpan: 2, rowSpan: 1 }, { col: 3, row: 1, colSpan: 2, rowSpan: 1 },
    { col: 1, row: 2, colSpan: 2, rowSpan: 1 }, { col: 3, row: 2, colSpan: 2, rowSpan: 1 },
    { col: 1, row: 3, colSpan: 2, rowSpan: 1 }, { col: 3, row: 3, colSpan: 2, rowSpan: 1 }
  ]}
];
