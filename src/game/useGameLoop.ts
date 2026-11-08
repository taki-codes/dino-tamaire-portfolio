import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { playSfx, stopBgm } from '../audio/sound';
import {
  BUTTON_SWEEP_MAX,
  BUTTON_SWEEP_SPEED,
  COOLDOWN_MS,
  RAPID_COOLDOWN_MS,
  SURVIVAL_DURATION,
} from '../constants';
import { ControlType, getMatchDuration } from '../settings';
import { Aim, GameConfig, GameResult, GameState, Layout, PlayerId } from '../types';
import { CPU_CONFIGS, createCpuState, stepCpu, survivalCpuConfig } from './cpu';
import {
  activateSpecial,
  buttonAngleToAim,
  createInitialState,
  launchBall,
  step,
  useHeldItem,
  useZombieUltra,
} from './physics';
import { getMods, SpecialMods } from './specials';

interface UseGameLoopArgs {
  layout: Layout;
  running: boolean;
  config: GameConfig;
  control: ControlType; // ボタン発射モードのときだけ照準スイングを進める
  onEnd: (result: GameResult) => void;
}

function toResult(state: GameState, aborted = false): GameResult {
  return {
    score1: state.score1,
    score2: state.score2,
    shots1: state.shots1,
    shots2: state.shots2,
    aborted,
    wave: state.wave,
    defeated: state.defeated,
  };
}

// ボタン発射モードの照準状態(角度は真上=0、+が画面右)
interface ButtonAim {
  angle: number;
  dir: 1 | -1; // スイングの進行方向
  hold: boolean; // 手動調整中はスイングを止める
}

// requestAnimationFrameでゲーム状態を進め、毎フレーム再レンダリングさせるフック
export function useGameLoop({ layout, running, config, control, onEnd }: UseGameLoopArgs) {
  const { mode, rule, cpuLevel, survivalStage, players, p1Animal, p2Animal } = config;
  const isCpu = mode === 'vsCpu' || mode === 'survival';
  // かちぬきサバイバルは短期決戦(30秒固定)、対戦・まとあては設定の試合時間に従う。
  // ゾンビ協力・まとあて2人は状態にcoopフラグを立てる
  const duration = mode === 'survival' ? SURVIVAL_DURATION : getMatchDuration();
  const coop = (mode === 'zombie' || mode === 'gallery') && players === 2;
  const stateRef = useRef<GameState>(createInitialState(layout, duration, coop));
  const cpuRef = useRef(createCpuState());
  const lastFireRef = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  // ボタン発射モードの照準(左右にスイングし、手動でも動かせる)
  const buttonAimRef = useRef<Record<PlayerId, ButtonAim>>({
    1: { angle: 0, dir: 1, hold: false },
    2: { angle: 0, dir: -1, hold: false },
  });
  const [, setTick] = useState(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  // 現在の必殺技効果(毎フレーム参照するのでrefに置いてfireからも読む)
  const modsRef = useRef<Record<PlayerId, SpecialMods>>({
    1: getMods(p1Animal, false),
    2: getMods(p2Animal, false),
  });

  // いま発射できるか(こおり中・クールダウン中はfalse)。
  // GameScreenはこれを見て、撃てないあいだはゴム紐を引けないようにする
  const canFire = (owner: PlayerId): boolean => {
    const frozen = owner === 1 ? stateRef.current.freeze1 : stateRef.current.freeze2;
    if (frozen > 0) return false;
    // れんしゃモードはクールダウンが大幅に短い
    const cooldown = rule === 'rapid' ? RAPID_COOLDOWN_MS : COOLDOWN_MS;
    return Date.now() - lastFireRef.current[owner] >= cooldown * modsRef.current[owner].cooldownScale;
  };

  const fire = (owner: PlayerId, aim: Aim): void => {
    if (!canFire(owner)) return;
    if (launchBall(stateRef.current, layout, owner, aim, modsRef.current[owner])) {
      lastFireRef.current[owner] = Date.now();
      playSfx('launch');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // ボタン発射モード用: いまの照準角度で発射(タイミングを合わせて押す)
  const fireButton = (owner: PlayerId): void => {
    fire(owner, buttonAngleToAim(owner, buttonAimRef.current[owner].angle));
  };

  // ボタン発射モードの手動照準: ドラッグ中はスイングを止めて指に追従する
  const setButtonAngle = (owner: PlayerId, angle: number, hold: boolean): void => {
    const a = buttonAimRef.current[owner];
    a.angle = Math.min(Math.max(angle, -BUTTON_SWEEP_MAX), BUTTON_SWEEP_MAX);
    a.hold = hold;
  };

  // ゾンビの一撃必殺ボム(1試合1回): 画面のゾンビを一掃する
  const useUltra = (owner: PlayerId): void => {
    if (useZombieUltra(stateRef.current, owner)) {
      playSfx('crash');
      playSfx('special');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  // ポーズメニューの「はじめから」用: 試合を初期状態に戻す。
  // buttonAimはオブジェクトを差し替えずに書き戻す(ジェスチャーが参照を掴んでいるため)
  const reset = (): void => {
    stateRef.current = createInitialState(layout, duration, coop);
    cpuRef.current = createCpuState();
    lastFireRef.current = { 1: 0, 2: 0 };
    Object.assign(buttonAimRef.current[1], { angle: 0, dir: 1, hold: false });
    Object.assign(buttonAimRef.current[2], { angle: 0, dir: -1, hold: false });
  };

  // 必殺技ボタン(UI)とCPU用
  const activate = (owner: PlayerId): void => {
    if (activateSpecial(stateRef.current, owner)) {
      playSfx('special');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  // 手持ちアイテムの発動(「つかう」ボタンとCPU用)
  const useItem = (owner: PlayerId): void => {
    const kind = useHeldItem(stateRef.current, layout, owner);
    if (!kind) return;
    if (kind === 'bomb') {
      playSfx('crash');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else {
      playSfx('special');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };

  useEffect(() => {
    if (!running) return;
    // CPUの強さ: 通常はレベル、サバイバルは何人目かで決まる
    const baseCpu =
      mode === 'survival'
        ? survivalCpuConfig(survivalStage ?? 1)
        : cpuLevel
          ? CPU_CONFIGS[cpuLevel]
          : undefined;
    // れんしゃモードではCPUも思考と引き絞りを速めて撃ち合いにする
    const cpuCfg =
      baseCpu && rule === 'rapid'
        ? {
            ...baseCpu,
            thinkInterval: [
              baseCpu.thinkInterval[0] * 0.45,
              baseCpu.thinkInterval[1] * 0.45,
            ] as [number, number],
            pullTime: baseCpu.pullTime * 0.7,
          }
        : baseCpu;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      // バックグラウンド復帰などでdtが暴れないように上限を設ける
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const state = stateRef.current;
      // ボタン発射モード: 照準を左右にスイングさせる(手動調整中は止まる)
      if (control === 'button') {
        for (const owner of [1, 2] as const) {
          const a = buttonAimRef.current[owner];
          if (a.hold) continue;
          a.angle += a.dir * BUTTON_SWEEP_SPEED * dt;
          if (a.angle >= BUTTON_SWEEP_MAX) {
            a.angle = BUTTON_SWEEP_MAX;
            a.dir = -1;
          } else if (a.angle <= -BUTTON_SWEEP_MAX) {
            a.angle = -BUTTON_SWEEP_MAX;
            a.dir = 1;
          }
        }
      }
      modsRef.current[1] = getMods(p1Animal, state.special1 > 0);
      modsRef.current[2] = getMods(p2Animal, state.special2 > 0);
      const events = step(state, layout, dt, mode, rule, modsRef.current[1], modsRef.current[2]);
      if (events.goals > 0) {
        playSfx('goal');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      if (events.chargeStarted) playSfx('alarm');
      if (events.crashed) {
        playSfx('crash');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      // アイテムを拾ったときは軽いポップ音(発動時の音はuseItem側で鳴らす)
      if (events.itemGot) {
        playSfx('click');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      // まとあて: パンダまと(大得点)はごほうび音を重ねる
      if (events.rare) playSfx('special');
      // ゾンビサバイバルのイベント音
      if (events.waveStarted) playSfx('alarm');
      if (events.rush) {
        playSfx('alarm');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      if (events.heartLost) {
        playSfx('crash');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      if (events.saviorGot) {
        playSfx('special');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      if (isCpu && cpuCfg) {
        stepCpu(cpuRef.current, cpuCfg, state, layout, dt, fire, activate);
        // CPUは拾ったアイテムを少し置いてから使う(毎秒約50%の確率で発動)
        if (state.held2 && Math.random() < dt * 0.7) useItem(2);
      }
      setTick((t) => t + 1);
      // 終了: 時間切れ(通常)またはハート切れ(ゾンビ)
      const timeUp = mode !== 'practice' && mode !== 'zombie' && state.timeLeft <= 0;
      if (timeUp || events.gameOver) {
        stopBgm();
        onEndRef.current(toResult(state));
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, layout, mode, rule, cpuLevel, survivalStage, players, control, p1Animal, p2Animal]);

  // 練習の「おわる」とポーズメニューの「しあいをおわる」用。
  // 途中終了はabortedを立てて、サバイバルの勝ち抜き扱いにしない
  const endNow = (aborted = false): void => {
    stopBgm();
    onEndRef.current(toResult(stateRef.current, aborted));
  };

  return {
    state: stateRef.current,
    fire,
    fireButton,
    canFire,
    activate,
    useItem,
    useUltra,
    endNow,
    reset,
    buttonAims: buttonAimRef.current,
    setButtonAngle,
    cpuAim: cpuRef.current.currentAim,
    mods1: modsRef.current[1],
    mods2: modsRef.current[2],
  };
}
