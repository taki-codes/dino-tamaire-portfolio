import { Circle, Group, Line, Oval, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import React from 'react';
import { ANIMALS } from '../characters';
import { COLORS, REACT_DURATION } from '../constants';
import { AnimalId, PlayerId } from '../types';

interface AnimalFigureProps {
  animal: AnimalId;
  x: number; // 体の中心x(ワールド座標)
  y: number; // 体の中心y(ワールド座標)
  dir: 1 | -1; // 顔の向き
  scale?: number;
  t?: number; // 経過時間(アイドルの上下バウンス用)
  reactT?: number; // ゴール直後の喜びリアクション残り時間
  team?: PlayerId; // チーム色ハチマキ(未指定なら無し)
  crowned?: boolean; // 勝者の王冠(リザルト用)
}

// えさを待つ動物1匹。ローカル座標は体の中心が原点、下向きがy+
export function AnimalFigure({
  animal,
  x,
  y,
  dir,
  scale = 1,
  t = 0,
  reactT = 0,
  team,
  crowned,
}: AnimalFigureProps) {
  const spec = ANIMALS[animal];

  // アイドル: ゆっくり上下に揺れる。リアクション: 放物線ジャンプ
  const idle = Math.sin(t * 4) * 2;
  const jump = reactT > 0 ? Math.sin((1 - reactT / REACT_DURATION) * Math.PI) * 14 : 0;
  const offsetY = idle - jump;

  const hx = dir * 30; // 頭の中心(ローカル)
  const hy = -26;

  return (
    <Group transform={[{ translateX: x }, { translateY: y + offsetY }, { scale }]}>
      <BehindParts animal={animal} dir={dir} hx={hx} hy={hy} spec={spec} />

      {/* 胴体まわり(旧DinoBodyの骨格) */}
      {animal !== 'rabbit' && (
        <Oval
          x={-dir * 52 - 14}
          y={-8}
          width={28}
          height={14}
          color={animal === 'panda' ? spec.accent : spec.body}
        />
      )}
      <Oval x={-34} y={-24} width={68} height={48} color={spec.body} />
      <Oval x={-22} y={-12} width={44} height={32} color={spec.belly} />
      {/* 足 */}
      <RoundedRect
        x={-24}
        y={16}
        width={14}
        height={16}
        r={5}
        color={animal === 'panda' ? spec.accent : spec.body}
      />
      <RoundedRect
        x={10}
        y={16}
        width={14}
        height={16}
        r={5}
        color={animal === 'panda' ? spec.accent : spec.body}
      />

      <FrontParts animal={animal} dir={dir} hx={hx} hy={hy} spec={spec} />

      {/* 頭 */}
      <Circle cx={hx} cy={hy} r={17} color={spec.body} />
      <HeadParts animal={animal} dir={dir} hx={hx} hy={hy} spec={spec} />

      {/* チーム色ハチマキ */}
      {team && (
        <>
          <RoundedRect
            x={hx - 17}
            y={hy - 14}
            width={34}
            height={7}
            r={3.5}
            color={team === 1 ? COLORS.p1 : COLORS.p2}
          />
          {/* 結び目のたれ(後頭部側) */}
          <Oval
            x={hx - dir * 17 - (dir === 1 ? 8 : 0)}
            y={hy - 18}
            width={8}
            height={12}
            color={team === 1 ? COLORS.p1 : COLORS.p2}
          />
        </>
      )}

      {/* 目(最前面) */}
      <Circle cx={hx + dir * 6} cy={hy - 4} r={5} color="white" />
      <Circle cx={hx + dir * 7} cy={hy - 4} r={2.5} color="black" />

      {/* 勝者の王冠 */}
      {crowned && (
        <Group>
          <Path
            path={`M ${hx - 12} ${hy - 18} L ${hx - 12} ${hy - 32} L ${hx - 5} ${hy - 24} L ${hx} ${hy - 35} L ${hx + 5} ${hy - 24} L ${hx + 12} ${hy - 32} L ${hx + 12} ${hy - 18} Z`}
            color="#FFD700"
          />
          <Circle cx={hx} cy={hy - 22} r={2.5} color="#E53935" />
        </Group>
      )}
    </Group>
  );
}

interface PartsProps {
  animal: AnimalId;
  dir: 1 | -1;
  hx: number;
  hy: number;
  spec: (typeof ANIMALS)[AnimalId];
}

// 頭より後ろに描くパーツ(長い耳・しっぽなど)
function BehindParts({ animal, dir, hx, hy, spec }: PartsProps) {
  switch (animal) {
    case 'rabbit':
      return (
        <Group>
          {/* 長い耳2本+丸いしっぽ */}
          <Oval x={hx - 13} y={hy - 44} width={10} height={30} color={spec.body} />
          <Oval x={hx + 3} y={hy - 44} width={10} height={30} color={spec.body} />
          <Oval x={hx - 10.5} y={hy - 39} width={5} height={20} color={spec.accent} />
          <Oval x={hx + 5.5} y={hy - 39} width={5} height={20} color={spec.accent} />
          <Circle cx={-dir * 40} cy={-4} r={8} color="#FFFFFF" />
        </Group>
      );
    case 'cat':
      return (
        // しなるしっぽ(ストロークの曲線)
        <Path
          path={`M ${-dir * 34} -4 Q ${-dir * 56} -10 ${-dir * 52} -28`}
          style="stroke"
          strokeWidth={7}
          strokeCap="round"
          color={spec.body}
        />
      );
    case 'dog':
      return (
        // 垂れ耳(頭の描画後にも前側の耳を重ねる)
        <Oval x={hx - dir * 17 - 5} y={hy - 10} width={11} height={24} color={spec.accent} />
      );
    case 'lion':
      return (
        <Group>
          {/* たてがみ: 頭を囲む大きな円+ギザ感を出す小円 */}
          <Circle cx={hx} cy={hy} r={26} color={spec.accent} />
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Circle
                key={deg}
                cx={hx + Math.cos(rad) * 24}
                cy={hy + Math.sin(rad) * 24}
                r={7}
                color={spec.accent}
              />
            );
          })}
          {/* 房付きの尻尾 */}
          <Path
            path={`M ${-dir * 34} -4 Q ${-dir * 58} -8 ${-dir * 54} -26`}
            style="stroke"
            strokeWidth={6}
            strokeCap="round"
            color={spec.body}
          />
          <Circle cx={-dir * 54} cy={-28} r={6} color={spec.accent} />
        </Group>
      );
    default:
      return null;
  }
}

// 胴体の上・頭の下に描くパーツ(甲羅など)
function FrontParts({ animal, spec }: PartsProps) {
  if (animal !== 'turtle') return null;
  return (
    <Group>
      {/* 甲羅ドーム+こうらの模様 */}
      <Oval x={-30} y={-28} width={60} height={40} color={spec.accent} />
      <Circle cx={0} cy={-9} r={7} color={spec.body} />
      <Circle cx={-14} cy={-13} r={5} color={spec.body} />
      <Circle cx={14} cy={-13} r={5} color={spec.body} />
    </Group>
  );
}

// 頭の上に描くパーツ(耳・マズル・模様など)
function HeadParts({ animal, dir, hx, hy, spec }: PartsProps) {
  switch (animal) {
    case 'dog':
      return (
        <Group>
          {/* 前側の垂れ耳とマズル */}
          <Oval x={hx + dir * 8 - 3} y={hy - 12} width={11} height={24} color={spec.accent} />
          <Oval x={hx + dir * 6 - 8} y={hy + 2} width={16} height={11} color={spec.belly} />
          <Circle cx={hx + dir * 13} cy={hy + 5} r={3} color="#3E2723" />
        </Group>
      );
    case 'panda':
      return (
        <Group>
          <Circle cx={hx - 11} cy={hy - 13} r={7} color={spec.accent} />
          <Circle cx={hx + 11} cy={hy - 13} r={7} color={spec.accent} />
          {/* 目のまわりの模様(目はこの上に描かれる) */}
          <Oval x={hx + dir * 6 - 7} y={hy - 11} width={14} height={15} color={spec.accent} />
          <Circle cx={hx + dir * 2} cy={hy + 6} r={3} color={spec.accent} />
        </Group>
      );
    case 'cat':
      return (
        <Group>
          {/* 三角耳(外+内) */}
          <Path
            path={`M ${hx - 16} ${hy - 8} L ${hx - 12} ${hy - 24} L ${hx - 2} ${hy - 13} Z`}
            color={spec.body}
          />
          <Path
            path={`M ${hx + 16} ${hy - 8} L ${hx + 12} ${hy - 24} L ${hx + 2} ${hy - 13} Z`}
            color={spec.body}
          />
          <Path
            path={`M ${hx - 13} ${hy - 11} L ${hx - 11.5} ${hy - 20} L ${hx - 6} ${hy - 13} Z`}
            color={spec.accent}
          />
          <Path
            path={`M ${hx + 13} ${hy - 11} L ${hx + 11.5} ${hy - 20} L ${hx + 6} ${hy - 13} Z`}
            color={spec.accent}
          />
          {/* ひげ */}
          <Line p1={vec(hx + dir * 10, hy + 3)} p2={vec(hx + dir * 22, hy + 1)} strokeWidth={1.5} color="#5D4037" />
          <Line p1={vec(hx + dir * 10, hy + 6)} p2={vec(hx + dir * 22, hy + 7)} strokeWidth={1.5} color="#5D4037" />
          <Circle cx={hx + dir * 9} cy={hy + 3} r={2.5} color="#F48FB1" />
        </Group>
      );
    case 'rabbit':
      return (
        <Group>
          {/* 前歯 */}
          <RoundedRect x={hx + dir * 6 - 3} y={hy + 8} width={6} height={7} r={2} color="#FFFFFF" />
          <Circle cx={hx + dir * 7} cy={hy + 5} r={2.5} color={spec.accent} />
        </Group>
      );
    case 'turtle':
      return (
        // ほっぺ
        <Circle cx={hx + dir * 2} cy={hy + 6} r={3} color={spec.accent} opacity={0.5} />
      );
    case 'bear':
      return (
        <Group>
          <Circle cx={hx - 11} cy={hy - 13} r={6.5} color={spec.accent} />
          <Circle cx={hx + 11} cy={hy - 13} r={6.5} color={spec.accent} />
          <Circle cx={hx - 11} cy={hy - 13} r={3.5} color={spec.belly} />
          <Circle cx={hx + 11} cy={hy - 13} r={3.5} color={spec.belly} />
          <Oval x={hx + dir * 6 - 8} y={hy + 1} width={16} height={12} color={spec.belly} />
          <Circle cx={hx + dir * 8} cy={hy + 4} r={3} color="#3E2723" />
        </Group>
      );
    case 'lion':
      return (
        <Group>
          {/* 丸耳(たてがみの上)+マズル+鼻 */}
          <Circle cx={hx - 12} cy={hy - 14} r={5.5} color={spec.body} />
          <Circle cx={hx + 12} cy={hy - 14} r={5.5} color={spec.body} />
          <Oval x={hx + dir * 6 - 8} y={hy + 1} width={16} height={11} color={spec.belly} />
          <Circle cx={hx + dir * 8} cy={hy + 3} r={3} color="#6D4C41" />
        </Group>
      );
    default:
      return null;
  }
}
