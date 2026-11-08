import { Circle, Group, Line, vec } from '@shopify/react-native-skia';
import React from 'react';
import { BALL_RADIUS, COLORS } from '../constants';
import { clampDrag, trajectoryDots } from '../game/physics';
import { Aim, Layout, PlayerId } from '../types';

interface LauncherProps {
  owner: PlayerId;
  layout: Layout;
  aim: Aim | null;
  t?: number; // 経過時間(待機中のパルス演出)
  velScale?: number; // 必殺技中の弾速倍率(軌道ガイドを実弾に合わせる)
  ready?: boolean; // 発射可能か(クールダウン・こおり中はfalse=灰色でパルスなし)
  gravityScale?: number; // ゾンビモードの弱重力(軌道ガイドを実弾に合わせる)
}

// 発射台 + ドラッグ中のゴム紐と軌道ガイド
export function Launcher({
  owner,
  layout,
  aim,
  t = 0,
  velScale = 1,
  ready = true,
  gravityScale = 1,
}: LauncherProps) {
  const pos = owner === 1 ? layout.launcher1 : layout.launcher2;
  const color = owner === 1 ? COLORS.p1 : COLORS.p2;
  const dark = owner === 1 ? COLORS.p1Dark : COLORS.p2Dark;

  const clamped = aim ? clampDrag(aim) : null;
  const pullX = clamped ? pos.x + clamped.dx : pos.x;
  const pullY = clamped ? pos.y + clamped.dy : pos.y;
  const dots = aim ? trajectoryDots(owner, aim, layout, 8, velScale, gravityScale) : [];

  // 待機中はゆっくり脈打つリングで「撃てるよ」を伝える
  const pulse = 1 + Math.sin(t * 3 + owner * 2) * 0.06;

  return (
    <Group>
      {/* 軌道ガイド(点線) */}
      {dots.map((d, i) => (
        <Circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={4 - i * 0.3}
          color={color}
          opacity={0.7 - i * 0.07}
        />
      ))}
      {/* パチンコのゴム紐(左右のアンカーから引っ張り点へ2本) */}
      {clamped && (
        <Group>
          <Line p1={vec(pos.x - 16, pos.y)} p2={vec(pullX, pullY)} color={dark} strokeWidth={4} />
          <Line p1={vec(pos.x + 16, pos.y)} p2={vec(pullX, pullY)} color={dark} strokeWidth={4} />
        </Group>
      )}
      {/* 発射台の土台(「撃てるよ」のパルスリングはready時だけ) */}
      {!clamped && ready && (
        <Circle cx={pos.x} cy={pos.y} r={26 * pulse} style="stroke" strokeWidth={2} color={color} opacity={0.35} />
      )}
      <Circle cx={pos.x} cy={pos.y + 2} r={22} color="rgba(0,0,0,0.2)" />
      <Circle cx={pos.x} cy={pos.y} r={22} color={dark} />
      <Circle cx={pos.x} cy={pos.y} r={16} color={ready ? color : '#9E9E9E'} />
      <Circle cx={pos.x - 5} cy={pos.y - 5} r={5} color="rgba(255,255,255,0.35)" />
      {/* 引っ張っている玉 */}
      {clamped && (
        <Group>
          <Circle cx={pullX + 2} cy={pullY + 3} r={BALL_RADIUS} color="rgba(0,0,0,0.25)" />
          <Circle cx={pullX} cy={pullY} r={BALL_RADIUS} color={color} />
          <Circle cx={pullX - 3} cy={pullY - 3} r={3} color="rgba(255,255,255,0.7)" />
        </Group>
      )}
    </Group>
  );
}
