import { Circle, Group, Oval, RoundedRect } from '@shopify/react-native-skia';
import React from 'react';
import { ANIMALS } from '../characters';
import { GALLERY_TARGET_LIFT, GALLERY_TARGET_R } from '../constants';
import { GalleryWalker } from '../types';

// ちびキャラの大きさ倍率(Zombies.tsxと同じ流儀)
const K = 1.15;

// まとあて射的: まとを掲げて行進する動物たち。
// 群れで出るためZombies.tsx同様の軽量ちびキャラ(1匹あたり十数要素)で描く。
// side=2の個体は上側プレイヤーから見て正しい向きになるよう上下反転する
export function GalleryWalkers({ walkers, t }: { walkers: GalleryWalker[]; t: number }) {
  return (
    <Group>
      {walkers.map((w) => {
        if (w.dead) return null;
        const spec = ANIMALS[w.animal];
        const flip = w.side === 2 ? -1 : 1; // 上側プレイヤーのまとは上下反転
        const bob = Math.abs(Math.sin(t * 6 + w.phase)) * 3;
        const y = w.y - bob * flip;
        const dir = w.dir; // 進行方向に顔を向ける
        const hy = y - 13 * K * flip; // 頭の中心
        // まとの中心(当たり判定と同じ位置)。撃つ人側=手前に差し出して掲げる
        const ty = w.y + GALLERY_TARGET_LIFT * flip;
        const holdsTarget = !w.exiting && w.hold !== 'baby';

        return (
          <Group key={w.id}>
            {/* まとを差し出す棒(退場中は消える=まとが割れた) */}
            {holdsTarget && (
              <RoundedRect
                x={w.x - 1.5}
                y={Math.min(ty, y)}
                width={3}
                height={Math.abs(ty - y)}
                r={1.5}
                color="#8D6E63"
              />
            )}
            {/* 体とおなか */}
            <Oval x={w.x - 16 * K} y={y - 11 * K} width={32 * K} height={24 * K} color={spec.body} />
            <Oval x={w.x - 9 * K} y={y - 4 * K} width={18 * K} height={13 * K} color={spec.belly} />
            {/* 頭と耳 */}
            <Circle cx={w.x + dir * 7 * K} cy={hy} r={10 * K} color={spec.body} />
            <Circle cx={w.x + dir * 2 * K} cy={hy - 8 * K * flip} r={3.6 * K} color={spec.accent} />
            <Circle cx={w.x + dir * 11 * K} cy={hy - 8 * K * flip} r={3.6 * K} color={spec.accent} />
            {/* 目 */}
            <Circle cx={w.x + dir * 10 * K} cy={hy - 2 * K * flip} r={2.6 * K} color="#FFFFFF" />
            <Circle cx={w.x + dir * 11 * K} cy={hy - 2 * K * flip} r={1.4 * K} color="#000000" />

            {/* あかちゃんおんぶ(撃っちゃダメ!): 背中に小さい子が乗っている */}
            {w.hold === 'baby' && (
              <Group>
                <Oval
                  x={w.x - dir * 10 * K - 8 * K}
                  y={hy - 10 * K * flip - 6 * K}
                  width={16 * K}
                  height={12 * K}
                  color={spec.body}
                />
                <Circle cx={w.x - dir * 7 * K} cy={hy - 15 * K * flip} r={6 * K} color={spec.body} />
                <Circle cx={w.x - dir * 6 * K} cy={hy - 15 * K * flip} r={1.6 * K} color="#000000" />
                {/* ほっぺとおしゃぶりで「あかちゃん」だと分かるように */}
                <Circle cx={w.x - dir * 10 * K} cy={hy - 13 * K * flip} r={2 * K} color="#F48FB1" />
              </Group>
            )}

            {/* まと: ふつうは紅白のまと、レアはパンダの顔 */}
            {holdsTarget &&
              (w.hold === 'rare' ? (
                <Group>
                  {/* パンダまと(大得点) */}
                  <Circle cx={w.x - 8} cy={ty - 8 * flip} r={6} color="#212121" />
                  <Circle cx={w.x + 8} cy={ty - 8 * flip} r={6} color="#212121" />
                  <Circle cx={w.x} cy={ty} r={GALLERY_TARGET_R - 8} color="#FFFFFF" />
                  <Oval x={w.x - 10} y={ty - 5 * flip - 3.5} width={7} height={7} color="#212121" />
                  <Oval x={w.x + 3} y={ty - 5 * flip - 3.5} width={7} height={7} color="#212121" />
                  <Circle cx={w.x} cy={ty + 4 * flip} r={2.4} color="#212121" />
                  {/* 金の縁でレア感を出す */}
                  <Circle cx={w.x} cy={ty} r={GALLERY_TARGET_R - 7} color="#FFD700" style="stroke" strokeWidth={2.5} />
                </Group>
              ) : (
                <Group>
                  {/* 紅白のまと */}
                  <Circle cx={w.x} cy={ty} r={GALLERY_TARGET_R - 6} color="#E53935" />
                  <Circle cx={w.x} cy={ty} r={GALLERY_TARGET_R - 11} color="#FFFFFF" />
                  <Circle cx={w.x} cy={ty} r={GALLERY_TARGET_R - 16} color="#E53935" />
                </Group>
              ))}

            {/* 被弾フラッシュ(まと命中は白、体は見た目で分かるよう赤め) */}
            <Circle cx={w.x} cy={y - 5 * K * flip} r={19 * K} color="#FFFFFF" opacity={w.hitT > 0 ? 0.55 : 0} />
          </Group>
        );
      })}
    </Group>
  );
}
