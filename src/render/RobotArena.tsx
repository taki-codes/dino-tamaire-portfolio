import { Circle, Group, RoundedRect, vec } from '@shopify/react-native-skia';
import React from 'react';
import { BALL_RADIUS, COLORS } from '../constants';
import {
  PANEL_INFO,
  PANEL_SIZE,
  RobotAttackKind,
  RobotFighter,
  RobotState,
  robotPositions,
} from '../game/robot';
import { Layout, PlayerId } from '../types';
import { AnimalFigure } from './Animal';

interface RobotArenaProps {
  state: RobotState;
  layout: Layout;
  t: number;
  // CPUが狙いをつけているパネル(黄色いリングで見せる)
  telegraph: { x: number; y: number } | null;
}

// 闘魂ロボットバトルのフィールド描画: パネル・ロボット・弾・エフェクト
export function RobotArena({ state, layout, t, telegraph }: RobotArenaProps) {
  const pos = robotPositions(layout);
  // 相手がふりかぶり中なら、同じ技のパネル=カウンターチャンスを光らせる
  const counterKind1 =
    state.p2.attack && state.p2.attack.kind !== 'special' ? state.p2.attack.kind : null;
  const counterKind2 =
    state.p1.attack && state.p1.attack.kind !== 'special' ? state.p1.attack.kind : null;
  return (
    <Group>
      <PanelRects fighter={state.p1} panels={state.panels1} t={t} counterKind={counterKind1} />
      <PanelRects fighter={state.p2} panels={state.panels2} t={t} counterKind={counterKind2} />
      {telegraph && (
        <Circle
          cx={telegraph.x}
          cy={telegraph.y}
          r={PANEL_SIZE / 2 + 6}
          style="stroke"
          strokeWidth={3.5}
          color="#FFEB3B"
          opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 10))}
        />
      )}
      <Robot owner={2} fighter={state.p2} x={pos.robot2.x} y={pos.robot2.y} t={t} state={state} />
      <Robot owner={1} fighter={state.p1} x={pos.robot1.x} y={pos.robot1.y} t={t} state={state} />
      {/* ロボットが撃つ攻撃弾(緑/青) */}
      {state.projectiles.map((p) => {
        const spec = PANEL_INFO[p.kind];
        const r = p.kind === 'blue' ? 13 : 9;
        const dir = p.owner === 1 ? 1 : -1;
        return (
          <Group key={p.id}>
            {[1, 2, 3].map((i) => (
              <Circle key={i} cx={p.x} cy={p.y + dir * i * 10} r={r * (1 - i * 0.2)} color={spec.color} opacity={0.25 - i * 0.06} />
            ))}
            <Circle cx={p.x} cy={p.y} r={r + 3} color={spec.color} opacity={0.3} />
            <Circle cx={p.x} cy={p.y} r={r} color={spec.color} />
            <Circle cx={p.x - r * 0.3} cy={p.y - r * 0.3} r={r * 0.3} color="rgba(255,255,255,0.8)" />
          </Group>
        );
      })}
      {/* プレイヤーの操作用ビーダマ */}
      {state.balls.map((b) => {
        const color = b.owner === 1 ? COLORS.p1 : COLORS.p2;
        return (
          <Group key={b.id}>
            {[1, 2, 3].map((i) => (
              <Circle
                key={i}
                cx={b.x - b.vx * 0.018 * i}
                cy={b.y - b.vy * 0.018 * i}
                r={BALL_RADIUS * (1 - i * 0.18)}
                color={color}
                opacity={0.2 - i * 0.05}
              />
            ))}
            {/* ガラスのビー玉風 */}
            <Circle cx={b.x + 2} cy={b.y + 3} r={BALL_RADIUS} color="rgba(0,0,0,0.22)" />
            <Circle cx={b.x} cy={b.y} r={BALL_RADIUS} color={color} />
            <Circle cx={b.x} cy={b.y} r={BALL_RADIUS - 1} style="stroke" strokeWidth={2} color="rgba(255,255,255,0.35)" />
            <Circle cx={b.x - 3.5} cy={b.y - 3.5} r={3} color="rgba(255,255,255,0.85)" />
          </Group>
        );
      })}
    </Group>
  );
}

// 操作パネル6枚。ゲージが足りない技は薄く、必殺はゲージ満タンで金色に光る
function PanelRects({
  fighter,
  panels,
  t,
  counterKind,
}: {
  fighter: RobotFighter;
  panels: RobotState['panels1'];
  t: number;
  counterKind: RobotAttackKind | null;
}) {
  const half = PANEL_SIZE / 2;
  return (
    <Group>
      {panels.map((p, i) => {
        const spec = PANEL_INFO[p.kind];
        const usable =
          p.kind === 'special' ? fighter.gauge >= 1 : spec.cost <= 0 || fighter.gauge >= spec.cost;
        const specialReady = p.kind === 'special' && fighter.gauge >= 1;
        const counterChance = p.kind === counterKind;
        return (
          <Group key={i}>
            <RoundedRect x={p.x - half + 2} y={p.y - half + 3} width={PANEL_SIZE} height={PANEL_SIZE} r={14} color="rgba(0,0,0,0.25)" />
            <RoundedRect
              x={p.x - half}
              y={p.y - half}
              width={PANEL_SIZE}
              height={PANEL_SIZE}
              r={14}
              color={spec.color}
              opacity={usable ? 1 : 0.38}
            />
            <RoundedRect
              x={p.x - half}
              y={p.y - half}
              width={PANEL_SIZE}
              height={PANEL_SIZE}
              r={14}
              style="stroke"
              strokeWidth={specialReady ? 3.5 : 2}
              color={specialReady ? '#FFD700' : 'rgba(255,255,255,0.55)'}
              opacity={specialReady ? 0.6 + 0.4 * Math.abs(Math.sin(t * 6)) : usable ? 0.9 : 0.35}
            />
            {/* カウンターチャンス: 相手と同じ技のパネルが金色に点滅 */}
            {counterChance && (
              <Group>
                <RoundedRect
                  x={p.x - half - 5}
                  y={p.y - half - 5}
                  width={PANEL_SIZE + 10}
                  height={PANEL_SIZE + 10}
                  r={17}
                  style="stroke"
                  strokeWidth={4}
                  color="#FFD700"
                  opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 12))}
                />
                <RoundedRect
                  x={p.x - half}
                  y={p.y - half}
                  width={PANEL_SIZE}
                  height={PANEL_SIZE}
                  r={14}
                  color="#FFD700"
                  opacity={0.18 + 0.14 * Math.abs(Math.sin(t * 12))}
                />
              </Group>
            )}
            {/* 被弾フラッシュ */}
            {p.flashT > 0 && (
              <RoundedRect
                x={p.x - half}
                y={p.y - half}
                width={PANEL_SIZE}
                height={PANEL_SIZE}
                r={14}
                color="#FFFFFF"
                opacity={p.flashT * 2.5}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

// ロボット(動物)1体。ふりかぶり・踏み込み・ガード・被弾・KOの演出つき
function Robot({
  owner,
  fighter,
  x,
  y,
  t,
  state,
}: {
  owner: PlayerId;
  fighter: RobotFighter;
  x: number;
  y: number;
  t: number;
  state: RobotState;
}) {
  // 相手方向(P1は画面上へ、P2は画面下へ)
  const forward = owner === 1 ? -1 : 1;
  let dy = 0;
  let dx = 0;
  if (fighter.attack) {
    // ふりかぶり: 少し下がってプルプル
    const k = 1 - fighter.attack.t / fighter.attack.windup;
    dy = -forward * (8 + k * 6);
    dx = Math.sin(t * 42) * 1.8;
  } else if (fighter.strikeT > 0) {
    // 踏み込み: 相手に向かってダッシュ
    dy = forward * Math.sin(Math.PI * (1 - fighter.strikeT / 0.3)) * 44;
  }
  if (fighter.hitT > 0) {
    dx += Math.sin(t * 60) * 4 * fighter.hitT;
  }

  const ko = state.over && state.winner !== null && state.winner !== 0 && state.winner !== owner;
  const win = state.over && state.winner === owner;
  // 勝者は喜びジャンプをくり返す
  const reactT = win ? 0.4 * ((t * 1.2) % 1) : 0;

  return (
    <Group origin={vec(x, y)} transform={ko ? [{ rotate: owner === 1 ? 1.35 : -1.35 }] : []}>
      {/* ガードのバリア */}
      {fighter.guardT > 0 && (
        <Group>
          <Circle cx={x + dx} cy={y + dy} r={54} style="stroke" strokeWidth={4} color="#4FC3F7" opacity={0.85} />
          <Circle cx={x + dx} cy={y + dy} r={54} color="#4FC3F7" opacity={0.12 + 0.06 * Math.sin(t * 8)} />
        </Group>
      )}
      {/* 必殺技の金色オーラ */}
      {fighter.specialFlashT > 0 && (
        <Circle
          cx={x + dx}
          cy={y + dy}
          r={50 + (1.4 - fighter.specialFlashT) * 70}
          style="stroke"
          strokeWidth={5}
          color="#FFD700"
          opacity={Math.max(0, fighter.specialFlashT / 1.4)}
        />
      )}
      <AnimalFigure animal={fighter.animal} x={x + dx} y={y + dy} dir={1} scale={0.92} t={t} reactT={reactT} team={owner} crowned={win} />
      {/* 被弾フラッシュ */}
      {fighter.hitT > 0 && <Circle cx={x + dx} cy={y + dy} r={46} color="#FF5252" opacity={fighter.hitT * 1.3} />}
      {/* しびれ */}
      {fighter.stunT > 0 && (
        <Circle cx={x} cy={y - 42} r={6 + Math.sin(t * 9) * 2} style="stroke" strokeWidth={3} color="#FFEB3B" opacity={0.9} />
      )}
    </Group>
  );
}
