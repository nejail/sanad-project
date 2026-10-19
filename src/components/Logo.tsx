import React, { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** SANAD mark: an "S" drawn as a road with a dashed centre line and a small pin. */
export function Logo({ size = 80, tile = false }: { size?: number; tile?: boolean }) {
  // Unique gradient id per instance: duplicate SVG ids break rendering on web.
  const gid = `road${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#38bdf8" />
          <Stop offset="1" stopColor="#0284c7" />
        </LinearGradient>
      </Defs>
      {tile && <Rect x="0" y="0" width="100" height="100" rx="24" fill="#0f172a" />}
      <Path
        d="M68 24 C 52 14, 28 20, 32 36 C 36 50, 66 46, 68 62 C 70 78, 46 86, 30 76"
        stroke={`url(#${gid})`}
        strokeWidth={15}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M68 24 C 52 14, 28 20, 32 36 C 36 50, 66 46, 68 62 C 70 78, 46 86, 30 76"
        stroke="#e0f2fe"
        strokeWidth={2}
        strokeDasharray="5 5"
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M70 6 c-5 0 -8 4 -8 8 c0 6 8 13 8 13 s8 -7 8 -13 c0 -4 -3 -8 -8 -8z" fill="#d4af37" />
      <Circle cx="70" cy="14" r="3" fill="#0f172a" />
      <Rect x="22" y="72" width="14" height="8" rx="3" fill="#f8fafc" />
    </Svg>
  );
}
