import { BattleRule, ItemKind } from '../types';

// ルール選択画面の表示順
export const BATTLE_RULES: BattleRule[] = ['normal', 'rapid', 'gimmick', 'item'];

// ルール選択画面・ゲーム開始時の表示用
export const RULE_INFO: Record<BattleRule, { emoji: string; nameJa: string; desc: string }> = {
  normal: { emoji: '🍎', nameJa: 'ふつうバトル', desc: 'いつものエサやりバトル!' },
  rapid: { emoji: '🔥', nameJa: '連射モード', desc: 'エサをどんどん投げられる!' },
  gimmick: { emoji: '🪵', nameJa: 'ギミックモード', desc: '動く丸太がエサをはね返す!' },
  item: { emoji: '🎁', nameJa: 'アイテムモード', desc: 'アイテムを取って相手を攻撃!' },
};

// アイテムの見た目と、拾ったとき/使ったとき(攻撃側・被弾側)の通知文
export const ITEM_INFO: Record<
  ItemKind,
  { emoji: string; getText: string; attackText: string; victimText: string }
> = {
  bomb: {
    emoji: '💣',
    getText: '💣 ボムをゲット!',
    attackText: '💣 ボムで攻撃!',
    victimText: '💣 ドカン! -3点…',
  },
  dizzy: {
    emoji: '🌀',
    getText: '🌀 めまいをゲット!',
    attackText: '🌀 めまいで攻撃!',
    victimText: '🌀 動物がめまい中…',
  },
  freeze: {
    emoji: '🧊',
    getText: '🧊 氷をゲット!',
    attackText: '🧊 氷で攻撃!',
    victimText: '🧊 凍って投げられない!',
  },
  // ゾンビサバイバルの救世主アイテム(えさが触れた瞬間に発動)
  heart: {
    emoji: '💖',
    getText: '💖 ハート回復!',
    attackText: '💖 ハート回復!',
    victimText: '💖 ハート回復!',
  },
  nuke: {
    emoji: '💥',
    getText: '💥 みんな吹き飛ばした!',
    attackText: '💥 みんな吹き飛ばした!',
    victimText: '💥 みんな吹き飛ばした!',
  },
  slow: {
    emoji: '⏳',
    getText: '⏳ ゾンビがゆっくりに!',
    attackText: '⏳ ゾンビがゆっくりに!',
    victimText: '⏳ ゾンビがゆっくりに!',
  },
};

// 対戦アイテムモードで出る種類(救世主アイテムは含まない)
export const ITEM_KINDS: ItemKind[] = ['bomb', 'dizzy', 'freeze'];
// ゾンビサバイバルの救世主アイテム
export const SAVIOR_KINDS: ItemKind[] = ['heart', 'nuke', 'slow'];
