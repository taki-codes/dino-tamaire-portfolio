import { Circle, Group, Line, RoundedRect, vec } from '@shopify/react-native-skia';
import React from 'react';
import { logRect } from '../game/physics';
import { Layout, PlayerId } from '../types';

interface LogsProps {
  layout: Layout;
  elapsed: number;
}

// ギミックモードの丸太: 各陣地の発射台と動物の間を往復して、えさを跳ね返す
export function Logs({ layout, elapsed }: LogsProps) {
  return (
    <Group>
      <Log layout={layout} owner={1} elapsed={elapsed} />
      <Log layout={layout} owner={2} elapsed={elapsed} />
    </Group>
  );
}

function Log({ layout, owner, elapsed }: { layout: Layout; owner: PlayerId; elapsed: number }) {
  const r = logRect(layout, owner, elapsed);
  const cy = r.y + r.h / 2;
  return (
    <Group>
      {/* 影 */}
      <RoundedRect x={r.x + 2} y={r.y + 4} width={r.w} height={r.h} r={r.h / 2} color="rgba(0,0,0,0.2)" />
      {/* 本体と木目 */}
      <RoundedRect x={r.x} y={r.y} width={r.w} height={r.h} r={r.h / 2} color="#8D6E63" />
      <Line
        p1={vec(r.x + 16, cy - 4)}
        p2={vec(r.x + r.w - 20, cy - 4)}
        color="#6D4C41"
        strokeWidth={2}
      />
      <Line
        p1={vec(r.x + 22, cy + 4)}
        p2={vec(r.x + r.w - 14, cy + 4)}
        color="#6D4C41"
        strokeWidth={2}
      />
      {/* 切り口(年輪) */}
      <Circle cx={r.x + r.h / 2} cy={cy} r={r.h / 2 - 1} color="#D7CCC8" />
      <Circle cx={r.x + r.h / 2} cy={cy} r={r.h / 4} style="stroke" strokeWidth={2} color="#A1887F" />
      <Circle cx={r.x + r.w - r.h / 2} cy={cy} r={r.h / 2 - 1} color="#D7CCC8" />
      <Circle cx={r.x + r.w - r.h / 2} cy={cy} r={r.h / 4} style="stroke" strokeWidth={2} color="#A1887F" />
    </Group>
  );
}
