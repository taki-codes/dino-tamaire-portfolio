import { Circle, Group, Oval, Path, RoundedRect } from '@shopify/react-native-skia';
import React from 'react';
import { BALL_RADIUS, COLORS } from '../constants';
import { Ball, ScorePop } from '../types';

// 飛んでいるえさの一括描画(P1=りんご、P2=おにぎり)。速度から残像トレイルを描く
export function Balls({ balls }: { balls: Ball[] }) {
  return (
    <Group>
      {balls.map((b) => {
        const color = b.owner === 1 ? COLORS.p1 : COLORS.p2;
        const r = BALL_RADIUS * b.scale;
        return (
          <Group key={b.id}>
            {/* 残像(現在の速度から逆算するので状態を持たない) */}
            {[1, 2, 3].map((i) => (
              <Circle
                key={i}
                cx={b.x - b.vx * 0.02 * i}
                cy={b.y - b.vy * 0.02 * i}
                r={r * (1 - i * 0.18)}
                color={color}
                opacity={0.22 - i * 0.06}
              />
            ))}
            {b.owner === 1 ? <Apple x={b.x} y={b.y} r={r} /> : <Onigiri x={b.x} y={b.y} r={r} />}
            {/* かめの必殺技: 2ポイントえさの金リング */}
            {b.points >= 2 && (
              <Circle cx={b.x} cy={b.y} r={r + 3} style="stroke" strokeWidth={2.5} color="#FFD700" />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

// りんご: 赤丸+ヘタ+葉っぱ
function Apple({ x, y, r }: { x: number; y: number; r: number }) {
  const k = r / BALL_RADIUS;
  return (
    <Group>
      <Circle cx={x} cy={y} r={r} color={COLORS.p1} />
      <Circle cx={x} cy={y} r={r - 0.75} style="stroke" strokeWidth={1.5} color={COLORS.p1Dark} opacity={0.6} />
      <RoundedRect x={x - 1 * k} y={y - r - 4 * k} width={2 * k} height={5 * k} r={1} color="#5D4037" />
      <Oval x={x + 1 * k} y={y - r - 4 * k} width={7 * k} height={4 * k} color="#66BB6A" />
      <Circle cx={x - 3 * k} cy={y - 3 * k} r={3 * k} color="rgba(255,255,255,0.6)" />
    </Group>
  );
}

// おにぎり: 白い角丸三角+海苔
function Onigiri({ x, y, r }: { x: number; y: number; r: number }) {
  const k = r / BALL_RADIUS;
  const w = r * 1.15;
  return (
    <Group>
      <Path
        path={`M ${x} ${y - w} Q ${x + w} ${y - w * 0.15} ${x + w * 0.72} ${y + w * 0.72} Q ${x} ${y + w * 1.05} ${x - w * 0.72} ${y + w * 0.72} Q ${x - w} ${y - w * 0.15} ${x} ${y - w} Z`}
        color={COLORS.p2}
      />
      <Path
        path={`M ${x} ${y - w} Q ${x + w} ${y - w * 0.15} ${x + w * 0.72} ${y + w * 0.72} Q ${x} ${y + w * 1.05} ${x - w * 0.72} ${y + w * 0.72} Q ${x - w} ${y - w * 0.15} ${x} ${y - w} Z`}
        style="stroke"
        strokeWidth={1.5}
        color={COLORS.p2Dark}
        opacity={0.6}
      />
      {/* 海苔 */}
      <RoundedRect x={x - 4.5 * k} y={y + 1 * k} width={9 * k} height={7 * k} r={1.5} color="#263238" />
      <Circle cx={x - 3 * k} cy={y - 4 * k} r={2.5 * k} color="rgba(255,255,255,0.8)" />
    </Group>
  );
}

// ゴール時に広がるリングエフェクト
export function ScorePops({ pops }: { pops: ScorePop[] }) {
  return (
    <Group>
      {pops.map((p) => (
        <Group key={p.id}>
          <Circle
            cx={p.x}
            cy={p.y}
            r={12 + p.age * 80}
            color={p.owner === 1 ? COLORS.p1 : COLORS.p2}
            style="stroke"
            strokeWidth={4}
            opacity={Math.max(0, 1 - p.age * 2)}
          />
          <Circle
            cx={p.x}
            cy={p.y}
            r={6 + p.age * 130}
            color="#FFF176"
            style="stroke"
            strokeWidth={2}
            opacity={Math.max(0, 0.8 - p.age * 2)}
          />
        </Group>
      ))}
    </Group>
  );
}
