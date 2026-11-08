import { Circle, Group, Oval, RoundedRect } from '@shopify/react-native-skia';
import React from 'react';
import { ANIMALS } from '../characters';
import { Zombie } from '../types';

// ちびキャラの大きさ倍率(ここを変えるだけでサイズ調整できる)。
// 実際の倍率はこれ×z.size(通常1/中ボス1.45/ボス2.3)
const BASE_K = 1.35;

// ゾンビサバイバル: 迫ってくるおなかすき動物の群れ。
// 群れで大量に出るため、フル描画のAnimalFigure(1匹25〜35要素)ではなく
// 動物の色だけ引き継いだ約11要素のちびキャラで描き、20匹表示でも重くならないようにする。
// 「!」の点滅も要素の生成破棄ではなくopacityで行う(ツリー構造を毎フレーム変えない)
export function Zombies({ zombies, t }: { zombies: Zombie[]; t: number }) {
  return (
    <Group>
      {zombies.map((z) => {
        if (z.dead) return null;
        const spec = ANIMALS[z.animal];
        const K = BASE_K * z.size; // 中ボス・ボスは大きい
        const flip = z.target === 2 ? -1 : 1; // P2へ向かう個体は上下反転
        const bob = Math.abs(Math.sin(t * 6 + z.phase)) * 3 * K; // 歩きバウンス
        const y = z.y - bob * flip;
        const dir = Math.cos(t * 1.6 + z.phase) >= 0 ? 1 : -1; // ゆらゆらに合わせた向き
        const hy = y - 15 * K * flip; // 頭の中心
        const my = y - 42 * K * flip; // おこりマーク
        const warn = Math.sin(t * 7 + z.phase) > -0.4 ? 1 : 0.15; // 点滅

        return (
          <Group key={z.id}>
            {/* 体とおなか */}
            <Oval x={z.x - 17 * K} y={y - 12 * K} width={34 * K} height={26 * K} color={spec.body} />
            <Oval x={z.x - 10 * K} y={y - 5 * K} width={20 * K} height={15 * K} color={spec.belly} />
            {/* 頭と耳 */}
            <Circle cx={z.x + dir * 7 * K} cy={hy} r={11 * K} color={spec.body} />
            <Circle cx={z.x + dir * 2 * K} cy={hy - 9 * K * flip} r={4 * K} color={spec.accent} />
            <Circle cx={z.x + dir * 12 * K} cy={hy - 9 * K * flip} r={4 * K} color={spec.accent} />
            {/* 目 */}
            <Circle cx={z.x + dir * 11 * K} cy={hy - 2 * K * flip} r={3 * K} color="#FFFFFF" />
            <Circle cx={z.x + dir * 12 * K} cy={hy - 2 * K * flip} r={1.6 * K} color="#000000" />
            {/* おこりマーク「!」 */}
            <Group opacity={warn}>
              <Circle cx={z.x} cy={my} r={8 * K} color="#FF7043" />
              <RoundedRect
                x={z.x - 1.5 * K}
                y={my - 5 * K}
                width={3 * K}
                height={6 * K}
                r={1.5 * K}
                color="#FFFFFF"
              />
              <Circle cx={z.x} cy={my + 4.5 * K * flip} r={1.5 * K} color="#FFFFFF" />
            </Group>
            {/* 被弾フラッシュ(硬いやつに当てたときの手応え) */}
            <Circle cx={z.x} cy={y - 6 * K * flip} r={20 * K} color="#FFFFFF" opacity={z.hitT > 0 ? 0.55 : 0} />
            {/* 中ボス・ボスのHPバー */}
            {z.maxHp > 1 && (
              <Group>
                <RoundedRect
                  x={z.x - 24 * K}
                  y={my - 16 * K * flip - 3}
                  width={48 * K}
                  height={6}
                  r={3}
                  color="rgba(0,0,0,0.55)"
                />
                <RoundedRect
                  x={z.x - 24 * K + 1}
                  y={my - 16 * K * flip - 2}
                  width={Math.max(2, (48 * K - 2) * (z.hp / z.maxHp))}
                  height={4}
                  r={2}
                  color={z.kind === 'boss' ? '#E53935' : '#FFB300'}
                />
              </Group>
            )}
          </Group>
        );
      })}
    </Group>
  );
}
