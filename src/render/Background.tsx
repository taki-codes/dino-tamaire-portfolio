import { Circle, Group, Line, LinearGradient, Oval, Rect, vec } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { COLORS } from '../constants';

interface BackgroundProps {
  width: number;
  height: number;
  centerY: number;
  t: number; // 経過時間(雲を流す)
}

// フィールド背景: グラデーション芝生+流れる雲+草花+センターライン
export function Background({ width, height, centerY, t }: BackgroundProps) {
  // 草と花の位置は画面サイズから決定的に生成(毎フレーム同じ)
  const decorations = useMemo(() => makeDecorations(width, height, centerY), [width, height, centerY]);

  return (
    <Group>
      {/* 上側(P2)の芝生: 奥へ行くほど涼しい色 */}
      <Rect x={0} y={0} width={width} height={centerY}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, centerY)}
          colors={[COLORS.fieldP2Deep, COLORS.fieldP2]}
        />
      </Rect>
      {/* 下側(P1)の芝生 */}
      <Rect x={0} y={centerY} width={width} height={height - centerY}>
        <LinearGradient
          start={vec(0, centerY)}
          end={vec(0, height)}
          colors={[COLORS.fieldP1, COLORS.fieldP1Deep]}
        />
      </Rect>

      {/* 流れる雲(各陣地の奥=画面端側を漂う) */}
      <Clouds width={width} baseY={40} t={t} seed={0} />
      <Clouds width={width} baseY={height - 40} t={t} seed={3} />

      {/* 草むらと花 */}
      {decorations.map((d, i) =>
        d.kind === 'grass' ? (
          <Group key={i}>
            <Line
              p1={vec(d.x, d.y)}
              p2={vec(d.x - 3, d.y - 8)}
              color="rgba(255,255,255,0.18)"
              strokeWidth={2}
            />
            <Line
              p1={vec(d.x, d.y)}
              p2={vec(d.x + 3, d.y - 9)}
              color="rgba(255,255,255,0.14)"
              strokeWidth={2}
            />
          </Group>
        ) : (
          <Group key={i}>
            <Circle cx={d.x} cy={d.y} r={3} color={d.color} opacity={0.7} />
            <Circle cx={d.x} cy={d.y} r={1.2} color="#FFF9C4" />
          </Group>
        ),
      )}

      {/* センターライン: 淡いグロー+点線 */}
      <Line
        p1={vec(0, centerY)}
        p2={vec(width, centerY)}
        color={COLORS.centerLine}
        strokeWidth={12}
        opacity={0.12}
      />
      {Array.from({ length: Math.ceil(width / 24) }, (_, i) => (
        <Line
          key={i}
          p1={vec(i * 24, centerY)}
          p2={vec(i * 24 + 14, centerY)}
          color={COLORS.centerLine}
          strokeWidth={3}
        />
      ))}
    </Group>
  );
}

function Clouds({ width, baseY, t, seed }: { width: number; baseY: number; t: number; seed: number }) {
  return (
    <Group>
      {[0, 1, 2].map((i) => {
        const n = seed + i;
        const speed = 10 + (n % 3) * 4;
        const span = width + 180;
        const x = ((n * 137 + t * speed) % span) - 90;
        const y = baseY + ((n * 53) % 24) - 12;
        return (
          <Group key={i} opacity={0.16}>
            <Oval x={x - 26} y={y - 8} width={52} height={18} color="#FFFFFF" />
            <Oval x={x - 10} y={y - 14} width={30} height={16} color="#FFFFFF" />
            <Oval x={x + 4} y={y - 8} width={34} height={14} color="#FFFFFF" />
          </Group>
        );
      })}
    </Group>
  );
}

type Decoration =
  | { kind: 'grass'; x: number; y: number }
  | { kind: 'flower'; x: number; y: number; color: string };

const FLOWER_COLORS = ['#F8BBD0', '#FFF176', '#B3E5FC'];

// 疑似乱数(決定的)で草と花を散らす
function makeDecorations(width: number, height: number, centerY: number): Decoration[] {
  const items: Decoration[] = [];
  const rand = (i: number, salt: number) => {
    const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let i = 0; i < 14; i++) {
    const x = rand(i, 1) * width;
    // 各陣地の中でも端寄り(発射台のまわり)に置く
    const topSide = i % 2 === 0;
    const y = topSide ? 30 + rand(i, 2) * (centerY - 140) : centerY + 110 + rand(i, 2) * (height - centerY - 140);
    if (rand(i, 3) < 0.3) {
      items.push({ kind: 'flower', x, y, color: FLOWER_COLORS[i % FLOWER_COLORS.length] });
    } else {
      items.push({ kind: 'grass', x, y });
    }
  }
  return items;
}
