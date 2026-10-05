import { sfxPrimitives } from "./sfxShapes";
export function SfxArtwork({
  shape,
  width,
  height,
  fill = "#fffdf7",
  stroke = "#171411",
  strokeWidth = 2,
  opacity = 1,
}: {
  shape: string;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  return (
    <g
      className="sfx-artwork"
      data-sfx-shape={shape}
      transform={`scale(${width / 100} ${height / 60})`}
    >
      {sfxPrimitives(shape).map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill ? fill : "none"}
          fillOpacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
