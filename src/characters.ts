import { AnimalId, CpuLevel } from './types';

// 動物キャラの見た目定義。描画は src/render/Animal.tsx が担当する
export interface AnimalSpec {
  id: AnimalId;
  nameJa: string;
  emoji: string;
  body: string; // 体のメインカラー
  belly: string; // お腹
  accent: string; // 耳の内側・ほっぺ等のアクセント
}

export const ANIMALS: Record<AnimalId, AnimalSpec> = {
  dog: { id: 'dog', nameJa: 'いぬ', emoji: '🐶', body: '#D7A86E', belly: '#F3E1C2', accent: '#8D6E63' },
  panda: { id: 'panda', nameJa: 'パンダ', emoji: '🐼', body: '#FAFAFA', belly: '#FFFFFF', accent: '#212121' },
  cat: { id: 'cat', nameJa: 'ねこ', emoji: '🐱', body: '#FFA726', belly: '#FFE0B2', accent: '#F48FB1' },
  rabbit: { id: 'rabbit', nameJa: 'うさぎ', emoji: '🐰', body: '#F5F5F5', belly: '#FFFFFF', accent: '#F48FB1' },
  turtle: { id: 'turtle', nameJa: 'かめ', emoji: '🐢', body: '#66BB6A', belly: '#A5D6A7', accent: '#33691E' },
  bear: { id: 'bear', nameJa: 'くま', emoji: '🐻', body: '#8D6E63', belly: '#D7CCC8', accent: '#5D4037' },
  lion: { id: 'lion', nameJa: 'ライオン', emoji: '🦁', body: '#E8A33D', belly: '#F5D9A8', accent: '#A0522D' },
};

export const ANIMAL_IDS: AnimalId[] = ['dog', 'panda', 'cat', 'rabbit', 'turtle', 'bear', 'lion'];

// CPUレベル→対戦キャラと表示情報
export const CPU_LEVEL_INFO: Record<
  CpuLevel,
  { animal: AnimalId; nameJa: string; desc: string; emoji: string }
> = {
  turtle: { animal: 'turtle', nameJa: 'かめレベル', desc: 'やさしい', emoji: '🐢' },
  rabbit: { animal: 'rabbit', nameJa: 'うさぎレベル', desc: 'ふつう', emoji: '🐰' },
  cat: { animal: 'cat', nameJa: 'ねこレベル', desc: 'つよい', emoji: '🐱' },
  lion: { animal: 'lion', nameJa: 'ライオンレベル', desc: 'かみ', emoji: '🦁' },
};

export const CPU_LEVELS: CpuLevel[] = ['turtle', 'rabbit', 'cat', 'lion'];
