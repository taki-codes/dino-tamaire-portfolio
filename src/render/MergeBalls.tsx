import { Circle, Group, Oval, Path, RoundedRect } from '@shopify/react-native-skia';
import React from 'react';
import { ANIMALS } from '../characters';
import { MERGE_CHAIN, MergeBall, isHungry } from '../game/merge';

// どうぶつマージのボール描画: 当たり判定の円いっぱいに描く丸い動物。
// 数十個並ぶので1匹あたりの要素数は少なめに保つ(顔+耳+個体差パーツ程度)

export function MergeBalls({ balls, t }: { balls: MergeBall[]; t: number }) {
  return (
    <Group>
      {balls.map((ball) =>
        ball.kind === 'zombie' ? (
          <ZombieBallFig key={ball.id} ball={ball} t={t} />
        ) : (
          <MergeAnimal key={ball.id} ball={ball} t={t} />
        ),
      )}
    </Group>
  );
}

function MergeAnimal({ ball, t }: { ball: MergeBall; t: number }) {
  const animal = MERGE_CHAIN[ball.tier];
  const spec = ANIMALS[animal];
  const r = ball.r;
  // 合体直後は大きめから縮んで着地するポップ演出
  const scale = 1 + ball.flashT * 0.6;
  // 転がっている方向を向く(ほぼ止まっていれば右向き)
  const dir = ball.vx < -12 ? -1 : 1;

  return (
    <Group transform={[{ translateX: ball.x }, { translateY: ball.y }, { scale }]}>
      <BallBody animal={animal} r={r} spec={spec} />
      {/* 目とほっぺ(全動物共通) */}
      <Circle cx={dir * r * 0.32} cy={-r * 0.08} r={r * 0.16} color="white" />
      <Circle cx={dir * r * 0.36} cy={-r * 0.08} r={r * 0.08} color="black" />
      <Circle cx={-dir * r * 0.28} cy={-r * 0.08} r={r * 0.16} color="white" />
      <Circle cx={-dir * r * 0.24} cy={-r * 0.08} r={r * 0.08} color="black" />
      <Circle cx={dir * r * 0.5} cy={r * 0.22} r={r * 0.1} color="#F48FB1" opacity={0.6} />
      <Circle cx={-dir * r * 0.5} cy={r * 0.22} r={r * 0.1} color="#F48FB1" opacity={0.6} />
      {/* おなかすきの「!」(怒って跳ね回るサイン) */}
      {isHungry(ball) && <AngryMark r={r} t={t} phase={ball.id} />}
      {/* 合体フラッシュ */}
      {ball.flashT > 0 && <Circle cx={0} cy={0} r={r} color="white" opacity={ball.flashT * 2.2} />}
    </Group>
  );
}

// おなかすきの「!」マーク(点滅)。ローカル座標(ボール中心が原点)に描く
function AngryMark({ r, t, phase }: { r: number; t: number; phase: number }) {
  const blink = Math.sin(t * 7 + phase) > -0.4 ? 1 : 0.15;
  const my = -r - 14;
  return (
    <Group opacity={blink}>
      <Circle cx={0} cy={my} r={9} color="#FF7043" />
      <RoundedRect x={-1.7} y={my - 5.5} width={3.4} height={6.5} r={1.7} color="#FFFFFF" />
      <Circle cx={0} cy={my + 4.5} r={1.7} color="#FFFFFF" />
    </Group>
  );
}

// はらぺこゾンビ: 合体できないおじゃまボール。そばの合体2回で退治できる
function ZombieBallFig({ ball, t }: { ball: MergeBall; t: number }) {
  const r = ball.r;
  const scale = 1 + ball.flashT * 0.5;
  const damaged = ball.hp <= 1;
  const wobble = Math.sin(t * 5 + ball.id) * 0.06; // ゆらゆら不気味に揺れる

  return (
    <Group transform={[{ translateX: ball.x }, { translateY: ball.y }, { scale }, { rotate: wobble }]}>
      <Circle cx={0} cy={0} r={r} color="#8A9A5B" />
      <Circle cx={0} cy={r * 0.25} r={r * 0.5} color="#77875A" />
      {/* ギザギザ前髪 */}
      <Path
        path={`M ${-r * 0.7} ${-r * 0.55} L ${-r * 0.4} ${-r * 0.95} L ${-r * 0.15} ${-r * 0.6} L ${r * 0.15} ${-r * 0.98} L ${r * 0.45} ${-r * 0.6} L ${r * 0.7} ${-r * 0.85} L ${r * 0.8} ${-r * 0.4} L ${-r * 0.8} ${-r * 0.4} Z`}
        color="#556B2F"
      />
      {/* ぐるぐる目(怒り) */}
      <Circle cx={-r * 0.3} cy={-r * 0.05} r={r * 0.17} color="#FFEB3B" />
      <Circle cx={r * 0.34} cy={-r * 0.05} r={r * 0.17} color="#FFEB3B" />
      <Circle cx={-r * 0.3} cy={-r * 0.05} r={r * 0.08} color="#B71C1C" />
      <Circle cx={r * 0.34} cy={-r * 0.05} r={r * 0.08} color="#B71C1C" />
      {/* 怒りまゆ */}
      <Path
        path={`M ${-r * 0.5} ${-r * 0.32} L ${-r * 0.12} ${-r * 0.18}`}
        style="stroke"
        strokeWidth={Math.max(2, r * 0.08)}
        strokeCap="round"
        color="#37474F"
      />
      <Path
        path={`M ${r * 0.54} ${-r * 0.32} L ${r * 0.16} ${-r * 0.18}`}
        style="stroke"
        strokeWidth={Math.max(2, r * 0.08)}
        strokeCap="round"
        color="#37474F"
      />
      {/* ギザギザの口 */}
      <Path
        path={`M ${-r * 0.35} ${r * 0.35} L ${-r * 0.15} ${r * 0.48} L ${0} ${r * 0.35} L ${r * 0.18} ${r * 0.48} L ${r * 0.38} ${r * 0.35}`}
        style="stroke"
        strokeWidth={Math.max(2, r * 0.07)}
        strokeCap="round"
        color="#37474F"
      />
      {/* ダメージ済みならヒビ */}
      {damaged && (
        <Path
          path={`M ${-r * 0.1} ${-r * 0.95} L ${-r * 0.25} ${-r * 0.55} L ${-r * 0.05} ${-r * 0.3} L ${-r * 0.3} ${r * 0.05}`}
          style="stroke"
          strokeWidth={Math.max(2, r * 0.07)}
          strokeCap="round"
          color="#37474F"
        />
      )}
      {/* はらぺこ「!」はゾンビにも出す */}
      {isHungry(ball) && <AngryMark r={r} t={t} phase={ball.id} />}
      {ball.flashT > 0 && <Circle cx={0} cy={0} r={r} color="white" opacity={ball.flashT * 2.2} />}
    </Group>
  );
}

interface BodyProps {
  animal: string;
  r: number;
  spec: (typeof ANIMALS)[keyof typeof ANIMALS];
}

// 体(丸)+動物ごとの個性パーツ。ローカル座標は中心が原点
function BallBody({ animal, r, spec }: BodyProps) {
  switch (animal) {
    case 'dog':
      return (
        <Group>
          <Circle cx={0} cy={0} r={r} color={spec.body} />
          {/* 垂れ耳 */}
          <Oval x={-r * 0.95} y={-r * 0.55} width={r * 0.4} height={r * 0.85} color={spec.accent} />
          <Oval x={r * 0.55} y={-r * 0.55} width={r * 0.4} height={r * 0.85} color={spec.accent} />
          <Oval x={-r * 0.35} y={r * 0.15} width={r * 0.7} height={r * 0.5} color={spec.belly} />
          <Circle cx={0} cy={r * 0.28} r={r * 0.1} color="#3E2723" />
        </Group>
      );
    case 'panda':
      return (
        <Group>
          <Circle cx={-r * 0.6} cy={-r * 0.65} r={r * 0.32} color={spec.accent} />
          <Circle cx={r * 0.6} cy={-r * 0.65} r={r * 0.32} color={spec.accent} />
          <Circle cx={0} cy={0} r={r} color={spec.body} />
          {/* 目のまわりの模様 */}
          <Oval x={-r * 0.55} y={-r * 0.32} width={r * 0.55} height={r * 0.6} color={spec.accent} />
          <Oval x={r * 0.0} y={-r * 0.32} width={r * 0.55} height={r * 0.6} color={spec.accent} />
          <Circle cx={0} cy={r * 0.3} r={r * 0.1} color={spec.accent} />
        </Group>
      );
    case 'cat':
      return (
        <Group>
          {/* 三角耳 */}
          <Path
            path={`M ${-r * 0.85} ${-r * 0.45} L ${-r * 0.6} ${-r * 1.05} L ${-r * 0.2} ${-r * 0.85} Z`}
            color={spec.body}
          />
          <Path
            path={`M ${r * 0.85} ${-r * 0.45} L ${r * 0.6} ${-r * 1.05} L ${r * 0.2} ${-r * 0.85} Z`}
            color={spec.body}
          />
          <Circle cx={0} cy={0} r={r} color={spec.body} />
          <Oval x={-r * 0.35} y={r * 0.15} width={r * 0.7} height={r * 0.5} color={spec.belly} />
          <Circle cx={0} cy={r * 0.26} r={r * 0.08} color="#F48FB1" />
        </Group>
      );
    case 'rabbit':
      return (
        <Group>
          {/* 長い耳 */}
          <Oval x={-r * 0.55} y={-r * 1.55} width={r * 0.42} height={r * 1.1} color={spec.body} />
          <Oval x={r * 0.13} y={-r * 1.55} width={r * 0.42} height={r * 1.1} color={spec.body} />
          <Oval x={-r * 0.45} y={-r * 1.4} width={r * 0.22} height={r * 0.8} color={spec.accent} />
          <Oval x={r * 0.23} y={-r * 1.4} width={r * 0.22} height={r * 0.8} color={spec.accent} />
          <Circle cx={0} cy={0} r={r} color={spec.body} />
          {/* 前歯 */}
          <RoundedRect x={-r * 0.12} y={r * 0.3} width={r * 0.24} height={r * 0.28} r={r * 0.08} color="#FFFFFF" />
          <Circle cx={0} cy={r * 0.22} r={r * 0.09} color={spec.accent} />
        </Group>
      );
    case 'turtle':
      return (
        <Group>
          <Circle cx={0} cy={0} r={r} color={spec.accent} />
          {/* 甲羅の模様と顔まわり */}
          <Circle cx={0} cy={0} r={r * 0.8} color={spec.body} />
          <Circle cx={0} cy={r * 0.45} r={r * 0.22} color={spec.belly} />
          <Circle cx={-r * 0.42} cy={r * 0.18} r={r * 0.16} color={spec.belly} />
          <Circle cx={r * 0.42} cy={r * 0.18} r={r * 0.16} color={spec.belly} />
        </Group>
      );
    case 'bear':
      return (
        <Group>
          <Circle cx={-r * 0.6} cy={-r * 0.68} r={r * 0.3} color={spec.body} />
          <Circle cx={r * 0.6} cy={-r * 0.68} r={r * 0.3} color={spec.body} />
          <Circle cx={-r * 0.6} cy={-r * 0.68} r={r * 0.16} color={spec.belly} />
          <Circle cx={r * 0.6} cy={-r * 0.68} r={r * 0.16} color={spec.belly} />
          <Circle cx={0} cy={0} r={r} color={spec.body} />
          <Oval x={-r * 0.35} y={r * 0.12} width={r * 0.7} height={r * 0.52} color={spec.belly} />
          <Circle cx={0} cy={r * 0.26} r={r * 0.11} color="#3E2723" />
        </Group>
      );
    case 'lion':
      return (
        <Group>
          {/* たてがみ(ギザ感の小円つき) */}
          <Circle cx={0} cy={0} r={r} color={spec.accent} />
          {[30, 90, 150, 210, 270, 330].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Circle
                key={deg}
                cx={Math.cos(rad) * r * 0.92}
                cy={Math.sin(rad) * r * 0.92}
                r={r * 0.22}
                color={spec.accent}
              />
            );
          })}
          <Circle cx={0} cy={0} r={r * 0.72} color={spec.body} />
          <Circle cx={-r * 0.45} cy={-r * 0.6} r={r * 0.15} color={spec.body} />
          <Circle cx={r * 0.45} cy={-r * 0.6} r={r * 0.15} color={spec.body} />
          <Oval x={-r * 0.28} y={r * 0.1} width={r * 0.56} height={r * 0.42} color={spec.belly} />
          <Circle cx={0} cy={r * 0.2} r={r * 0.09} color="#6D4C41" />
        </Group>
      );
    default:
      return <Circle cx={0} cy={0} r={r} color={spec.body} />;
  }
}
