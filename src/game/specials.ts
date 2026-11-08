import { AnimalId } from '../types';

// 必殺技の効果パラメータ。非発動時は全て等倍(NEUTRAL)
export interface SpecialMods {
  cooldownScale: number; // 発射クールダウン倍率(現在は全動物1)
  powerScale: number; // 初速倍率(くま=1.5)
  speedScale: number; // 弾速倍率(うさぎ=1.3)
  shotCount: number; // 同時発射数(うさぎ=2、ライオン=3)
  pointsPerGoal: number; // 1ゴールの得点(かめ=2)
  animalScale: number; // 自分の動物の大きさ倍率=当たり判定(パンダ=1.6)
  opponentHungerScale: number; // 相手の空腹の進み倍率(ねこ=3)
  ballScale: number; // えさの見た目倍率(パンダ=1.6)
  homing: number; // えさが自分の動物へ曲がる強さ(犬=1、0=なし)
}

export const NEUTRAL_MODS: SpecialMods = {
  cooldownScale: 1,
  powerScale: 1,
  speedScale: 1,
  shotCount: 1,
  pointsPerGoal: 1,
  animalScale: 1,
  opponentHungerScale: 1,
  ballScale: 1,
  homing: 0,
};

const ACTIVE_MODS: Record<AnimalId, Partial<SpecialMods>> = {
  rabbit: { shotCount: 2, speedScale: 1.3 },
  turtle: { pointsPerGoal: 2 },
  dog: { homing: 1 },
  panda: { animalScale: 1.6, ballScale: 1.6 },
  cat: { opponentHungerScale: 3 },
  bear: { powerScale: 1.5 },
  lion: { shotCount: 3, speedScale: 1.15 },
};

// ゾンビモードでは意味が変わる必殺技の説明(ねこ=釘付け、かめ=貫通)。
// 効果の実装は physics.ts(stepZombies のslow / stepBallsの貫通)側にある
export const SPECIAL_INFO_ZOMBIE: Partial<Record<AnimalId, { name: string; desc: string }>> = {
  cat: { name: 'ねこじゃらし', desc: 'ゾンビがくぎづけで止まる!' },
  turtle: { name: 'こうらパワー', desc: 'エサがつらぬいて飛ぶ!' },
};

// まとあて射的で意味が変わる/伝え方を変える必殺技の説明。
// 効果の実装は physics.ts(stepGalleryのcat停止 / まと得点×pointsPerGoal / homingのまと追尾)側にある
export const SPECIAL_INFO_GALLERY: Partial<Record<AnimalId, { name: string; desc: string }>> = {
  cat: { name: 'ねこじゃらし', desc: '動物たちが立ち止まる!' },
  turtle: { name: 'こうらパワー', desc: 'まとの点数が2倍!' },
  panda: { name: 'ころころ大玉', desc: '大きなエサで当てやすい!' },
  dog: { name: 'くんくんホーミング', desc: 'エサがまとへ曲がっていく!' },
};

// バナー・説明表示用
export const SPECIAL_INFO: Record<AnimalId, { name: string; desc: string }> = {
  rabbit: { name: 'ぴょんぴょんツイン', desc: 'エサが2個同時に飛ぶ!' },
  turtle: { name: 'こうらパワー', desc: '1ゴールで2ポイント!' },
  dog: { name: 'くんくんホーミング', desc: 'エサがにおいをたどって曲がる!' },
  panda: { name: 'ころころ大玉', desc: '動物が大きくなる!' },
  cat: { name: 'ねこじゃらし', desc: '相手がおなかすく!' },
  bear: { name: 'パワースロー', desc: '速い玉が飛ぶ!' },
  lion: { name: 'おうさまキャノン', desc: 'エサが3個同時に飛ぶ!' },
};

export function getMods(animal: AnimalId, active: boolean): SpecialMods {
  if (!active) return NEUTRAL_MODS;
  return { ...NEUTRAL_MODS, ...ACTIVE_MODS[animal] };
}
