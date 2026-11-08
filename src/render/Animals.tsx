import { Circle, Group, RoundedRect, vec } from '@shopify/react-native-skia';
import React from 'react';
import { CHARGE_WARN_LEAD } from '../constants';
import { AnimalId, CarrierState, GameMode, PlayerId } from '../types';
import { AnimalFigure } from './Animal';

interface AnimalsProps {
  mode: GameMode;
  elapsed: number;
  react1: number;
  react2: number;
  carrier1: CarrierState;
  carrier2: CarrierState;
  p1Animal: AnimalId;
  p2Animal: AnimalId;
  scale1: number; // パンダの必殺技中は1.6(見た目と判定を一致させる)
  scale2: number;
}

// 各プレイヤーの動物。中央ラインの自分側レーンをそれぞれ独立に
// うろつき(歩く/ダッシュ/立ち止まる)、空腹になると突進してくる。
export function Animals({
  mode,
  elapsed,
  react1,
  react2,
  carrier1,
  carrier2,
  p1Animal,
  p2Animal,
  scale1,
  scale2,
}: AnimalsProps) {
  return (
    <Group>
      <FieldAnimal
        animal={p1Animal}
        carrier={carrier1}
        owner={1}
        t={elapsed}
        reactT={react1}
        scale={scale1}
      />
      {/* 練習モードは自分の動物だけ */}
      {mode !== 'practice' && (
        <FieldAnimal
          animal={p2Animal}
          carrier={carrier2}
          owner={2}
          t={elapsed + 0.4}
          reactT={react2}
          scale={scale2}
        />
      )}
    </Group>
  );
}

function FieldAnimal({
  animal,
  carrier,
  owner,
  t,
  reactT,
  scale,
}: {
  animal: AnimalId;
  carrier: CarrierState;
  owner: PlayerId;
  t: number;
  reactT: number;
  scale: number;
}) {
  const flip = owner === 2;
  const charging = carrier.mode === 'charging';

  // 演出: ダッシュは進行方向へ前傾、突進は激しく揺れる
  let tilt = 0;
  if (charging) tilt = Math.sin(t * 24) * 0.06;
  else if (carrier.mode === 'center' && carrier.plan === 'dash') tilt = carrier.dir * 0.12;
  // 足の動き: 速いほど細かくバウンド
  const tScale = carrier.speed > 250 || charging ? 3 : carrier.speed > 0 ? 1.6 : 0.6;

  // AnimalFigureは体の中心が基準なので、判定矩形の中心(carrier.x/y)に合わせて描く
  const bodyY = carrier.y + 6;

  return (
    <Group origin={vec(carrier.x, carrier.y)} transform={[{ rotate: tilt }]}>
      {/* P2の動物は上下反転して上側プレイヤーから正しく見える */}
      <Group origin={vec(carrier.x, carrier.y)} transform={flip ? [{ scaleY: -1 }] : []}>
        <AnimalFigure
          animal={animal}
          x={carrier.x}
          y={bodyY}
          dir={carrier.dir}
          scale={scale}
          t={t * tScale}
          reactT={reactT}
          team={owner}
        />
      </Group>
      <WarnMark carrier={carrier} flip={flip} t={t} />
    </Group>
  );
}

// 突進予告と突進中の「!」マーク(点滅)
function WarnMark({ carrier, flip, t }: { carrier: CarrierState; flip: boolean; t: number }) {
  const warning =
    carrier.mode === 'center' && carrier.hunger >= carrier.hungerLimit - CHARGE_WARN_LEAD;
  const charging = carrier.mode === 'charging';
  if (!warning && !charging) return null;
  if (Math.sin(t * (charging ? 10 : 8)) < -0.3) return null; // 点滅
  // 頭の上(P2は反転しているので下=P2視点の上)
  const my = flip ? carrier.y + 52 : carrier.y - 52;
  return (
    <Group>
      <Circle cx={carrier.x} cy={my} r={13} color="#FFEB3B" />
      <Circle cx={carrier.x} cy={my} r={13} style="stroke" strokeWidth={2} color="#F57F17" />
      <RoundedRect x={carrier.x - 2} y={my - 8} width={4} height={9} r={2} color="#D84315" />
      <Circle cx={carrier.x} cy={my + 6} r={2.2} color="#D84315" />
    </Group>
  );
}
