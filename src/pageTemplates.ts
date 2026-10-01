export type LayoutRect = { x: number; y: number; width: number; height: number };

export type PagePreset = { id: string; name: string; panels: LayoutRect[] };

export const PAGE_PRESETS: PagePreset[] = [
  { id: "four", name: "4 rutor", panels: [
    { x:0,y:0,width:3,height:2 }, { x:0,y:2,width:1,height:3 },
    { x:1,y:2,width:2,height:1 }, { x:1,y:3,width:2,height:2 }
  ]},
  { id: "wide-two", name: "Bred + två", panels: [
    { x:0,y:0,width:3,height:2 }, { x:0,y:2,width:1,height:3 }, { x:1,y:2,width:2,height:3 }
  ]},
  { id: "five", name: "5 rutor", panels: [
    { x:0,y:0,width:2,height:2 }, { x:2,y:0,width:1,height:2 },
    { x:0,y:2,width:1,height:3 }, { x:1,y:2,width:2,height:1 }, { x:1,y:3,width:2,height:2 }
  ]},
  { id: "six", name: "6 rutor", panels: [
    { x:0,y:0,width:1,height:2 }, { x:1,y:0,width:2,height:2 },
    { x:0,y:2,width:2,height:1 }, { x:2,y:2,width:1,height:1 },
    { x:0,y:3,width:1,height:2 }, { x:1,y:3,width:2,height:2 }
  ]}
];

export function overlaps(a: LayoutRect, b: LayoutRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
