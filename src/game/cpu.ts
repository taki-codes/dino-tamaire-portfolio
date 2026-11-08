import {
  ANIMAL_HIT_W,
  CHARGE_HIT_DISTANCE,
  GRAVITY,
  LAUNCH_POWER,
  MAX_DRAG,
  MIN_LAUNCH_SPEED,
} from '../constants';
import { Aim, CpuLevel, GameState, Layout, PlayerId } from '../types';
import { laneY } from './physics';

// CPU(上側プレイヤー)の強さパラメータ
export interface CpuConfig {
  thinkInterval: [number, number]; // 発射後に次を考え始めるまでの秒数(乱数範囲)
  pullTime: number; // ゴム紐を引き絞る時間(秒)。プレイヤーに狙いが見える
  aimJitterPx: number; // 狙いの横ブレ(±px)
  missChance: number; // わざと大きく外す確率
  predict: boolean; // 動物の移動を先読みするか
}

// 全体的に「弱すぎない」バランス(2026-07-07にユーザー要望で一段強化)
export const CPU_CONFIGS: Record<CpuLevel, CpuConfig> = {
  turtle: { thinkInterval: [1.7, 2.6], pullTime: 0.75, aimJitterPx: 52, missChance: 0.25, predict: false },
  rabbit: { thinkInterval: [0.9, 1.4], pullTime: 0.45, aimJitterPx: 26, missChance: 0.08, predict: false },
  cat: { thinkInterval: [0.4, 0.7], pullTime: 0.26, aimJitterPx: 10, missChance: 0.02, predict: true },
  lion: { thinkInterval: [0.3, 0.45], pullTime: 0.2, aimJitterPx: 5, missChance: 0.005, predict: true },
};

export interface CpuState {
  phase: 'waiting' | 'pulling';
  timer: number;
  targetAim: Aim | null;
  currentAim: Aim | null; // 引き絞り途中の照準(Launcherの描画に渡す)
}

export function createCpuState(): CpuState {
  return { phase: 'waiting', timer: 1.5, targetAim: null, currentAim: null };
}

// 予測に使う標準的な玉の滞空時間(秒)
const TYPICAL_FLIGHT_TIME = 0.5;

// launchVelocityの逆算: (targetX, targetY)に玉を届かせる照準を求める。
// targetYは通常は中央ライン、突進中は自分の動物の位置。
// 飛行時間の候補を走査し、速度制約を満たす最初の解を返す(なければnull)
export function solveAim(layout: Layout, targetX: number, targetY: number): Aim | null {
  const dy = targetY - layout.launcher2.y; // 下向き(正)の距離
  if (dy <= 0) return null;
  const maxSpeed = MAX_DRAG * LAUNCH_POWER;
  for (let t = 0.15; t <= 1.1; t += 0.05) {
    // 上側の玉には上向きの重力(-GRAVITY)がかかる
    const vy = (dy + 0.5 * GRAVITY * t * t) / t;
    const vx = (targetX - layout.launcher2.x) / t;
    const speed = Math.hypot(vx, vy);
    if (speed < MIN_LAUNCH_SPEED || speed > maxSpeed) continue;
    if (vy - GRAVITY * t <= 0) continue; // 到達時に中央へ向かっていないとゴール判定されない
    // launchVelocity(2, aim): vx = -dx*POWER, vy = -dy*POWER の逆変換
    return { dx: -vx / LAUNCH_POWER, dy: -vy / LAUNCH_POWER };
  }
  return null;
}

// サバイバルモード: n人目の相手のレベル(かめ→うさぎ→ねこ→ライオン、以降ライオン)
export function survivalLevel(stage: number): CpuLevel {
  const levels: CpuLevel[] = ['turtle', 'rabbit', 'cat', 'lion'];
  return levels[Math.min(Math.max(stage - 1, 0), levels.length - 1)];
}

// サバイバルモード: 5人目以降はライオンがさらに強くなっていく
export function survivalCpuConfig(stage: number): CpuConfig {
  const base = CPU_CONFIGS[survivalLevel(stage)];
  const over = Math.max(0, stage - 4);
  if (over === 0) return base;
  const k = Math.pow(0.88, over);
  return {
    ...base,
    thinkInterval: [base.thinkInterval[0] * k, base.thinkInterval[1] * k],
    pullTime: Math.max(0.12, base.pullTime * k),
    aimJitterPx: base.aimJitterPx * k,
    missChance: base.missChance * k,
  };
}

function randRange([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

// 毎フレーム呼ばれるCPUの思考ルーチン。
// waiting(考え中) → pulling(引き絞り=可視) → fire → waiting を繰り返す。
// 自分の動物が突進中はえさやりを最優先し、ゲージが満タンなら必殺技を自動発動する
export function stepCpu(
  cpu: CpuState,
  cfg: CpuConfig,
  game: GameState,
  layout: Layout,
  dt: number,
  fire: (owner: PlayerId, aim: Aim) => void,
  activate: (owner: PlayerId) => void,
): void {
  // 必殺技: たまったら即発動
  if (game.gauge2 >= 1) activate(2);

  const emergency = game.carrier2.mode === 'charging';

  if (cpu.phase === 'waiting') {
    // 突進されていたら考えるのを切り上げて急いでえさを投げる
    if (emergency) cpu.timer = Math.min(cpu.timer, 0.15);
    cpu.timer -= dt;
    if (cpu.timer > 0) return;

    let targetX: number;
    let targetY: number;
    if (emergency) {
      // 突進してくる自分の動物を狙う(引き絞り中の移動ぶんだけ先読み。爆速突進ほど手前を狙う)
      const lead = cfg.pullTime + 0.25;
      targetX = game.carrier2.x;
      targetY = Math.max(
        game.carrier2.y - game.carrier2.chargeSpeed * lead,
        layout.launcher2.y + CHARGE_HIT_DISTANCE + 10,
      );
    } else {
      // アイテムモード: 自分の陣地に出ているアイテムをときどき狙う
      // (当たったえさはそのまま飛ぶので動物に届くこともある)。手持ちがあるあいだは拾えない
      const item = game.held2 ? undefined : game.items.find((i) => i.y < layout.centerY - 40);
      if (item && Math.random() < 0.4) {
        targetX = item.x;
        targetY = item.y;
      } else {
        const c = game.carrier2;
        targetX = c.x;
        targetY = laneY(layout, 2);
        if (cfg.predict && c.plan !== 'pause') {
          // 引き絞り+滞空時間ぶん移動を先読み(ダッシュや急停止までは読めない=変則移動が効く)
          const lead = cfg.pullTime + TYPICAL_FLIGHT_TIME;
          targetX += c.dir * c.speed * lead;
        }
        if (Math.random() < cfg.missChance) {
          targetX = c.x + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 80);
        }
      }
    }
    targetX += (Math.random() * 2 - 1) * cfg.aimJitterPx;
    const margin = ANIMAL_HIT_W / 2 + 8;
    targetX = Math.min(Math.max(targetX, margin), layout.width - margin);

    const aim = solveAim(layout, targetX, targetY);
    if (!aim) {
      cpu.timer = 0.3; // 解けなければ少し待って再挑戦
      return;
    }
    cpu.targetAim = aim;
    cpu.currentAim = { dx: 0, dy: 0 };
    cpu.phase = 'pulling';
    cpu.timer = cfg.pullTime;
    return;
  }

  // pulling: 照準を0→targetAimへ引き絞り、時間が来たら発射
  cpu.timer -= dt;
  const k = Math.min(1, 1 - cpu.timer / cfg.pullTime);
  const eased = k * k; // ゆっくり始まってぐっと引く
  cpu.currentAim = { dx: cpu.targetAim!.dx * eased, dy: cpu.targetAim!.dy * eased };
  if (cpu.timer <= 0) {
    fire(2, cpu.targetAim!);
    cpu.targetAim = null;
    cpu.currentAim = null;
    cpu.phase = 'waiting';
    cpu.timer = randRange(cfg.thinkInterval);
  }
}
