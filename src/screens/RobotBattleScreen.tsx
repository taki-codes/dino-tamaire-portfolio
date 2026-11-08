import { Canvas, Group } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { playSfx, resumeBgm, startBgm, stopBgm } from '../audio/sound';
import { ANIMALS, CPU_LEVEL_INFO } from '../characters';
import { JuicyButton } from '../components/JuicyButton';
import { MuteButton } from '../components/MuteButton';
import { COLORS } from '../constants';
import { survivalLevel } from '../game/cpu';
import { createLayout } from '../game/physics';
import {
  PANEL_INFO,
  PANEL_SIZE,
  ROBOT_COOLDOWN_MS,
  ROBOT_CPU_CONFIGS,
  ROBOT_DURATION,
  ROBOT_SPECIALS,
  ROBOT_SURVIVAL_DURATION,
  RobotEvents,
  RobotFighter,
  RobotState,
  createRobotCpuState,
  createRobotState,
  fireRobotBall,
  robotPanels,
  robotPositions,
  robotSurvivalCpuConfig,
  stepRobot,
  stepRobotCpu,
  triggerPanel,
} from '../game/robot';
import { Background } from '../render/Background';
import { Particles } from '../render/Effects';
import { Launcher } from '../render/Launcher';
import { RobotArena } from '../render/RobotArena';
import { RobotControlToggle } from '../components/RobotControlToggle';
import { RobotControlType, getRobotControl, getRobotHp, setRobotControl } from '../settings';
import { Aim, GameConfig, GameResult, Notice, PlayerId } from '../types';

interface RobotBattleScreenProps {
  config: GameConfig;
  onEnd: (result: GameResult) => void;
}

function toResult(state: RobotState, aborted = false): GameResult {
  return {
    score1: state.p1.hp,
    score2: state.p2.hp,
    shots1: state.shots1,
    shots2: state.shots2,
    aborted,
  };
}

// あそびかた説明はアプリ起動ごとに最初の1試合だけ出す(サバイバルの2人目以降でも出さない)
let robotHelpShown = false;

// 闘魂ロボットバトル: ビーダマで操作パネルを撃ち、ロボットに攻撃させて戦う
export function RobotBattleScreen({ config, onEnd }: RobotBattleScreenProps) {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => createLayout(width, height), [width, height]);
  const isSurvival = config.mode === 'robotSurvival';
  const isCpu = isSurvival || !!config.cpuLevel;
  const is2p = !isCpu;
  const duration = isSurvival ? ROBOT_SURVIVAL_DURATION : ROBOT_DURATION;
  const stage = config.survivalStage ?? 1;

  const [countdown, setCountdown] = useState(3);
  const [paused, setPaused] = useState(false);
  // 操作タイプ: ビーダマ(ひっぱり) / タッチ(パネルを直接タップ)。ポーズからも切替可
  const [control, setControl] = useState<RobotControlType>(getRobotControl());
  // あそびかた説明(初回のみ)。閉じるまでカウントダウンを始めない
  const [showHelp, setShowHelp] = useState(!robotHelpShown);
  const running = countdown === 0 && !paused && !showHelp;
  // HPは設定から(試合中は固定。サバイバルの持ち越しはcarryHp優先)
  const maxHp = useMemo(() => getRobotHp(), []);

  useEffect(() => {
    if (showHelp) return;
    if (countdown === 0) {
      playSfx('go');
      startBgm();
      return;
    }
    playSfx('count');
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [countdown, showHelp]);

  const stateRef = useRef<RobotState>(
    createRobotState(layout, config.p1Animal, config.p2Animal, duration, maxHp, config.carryHp ?? maxHp),
  );
  const cpuRef = useRef(createRobotCpuState());
  const cpuCfg = useMemo(
    () =>
      isSurvival
        ? robotSurvivalCpuConfig(stage)
        : config.cpuLevel
          ? ROBOT_CPU_CONFIGS[config.cpuLevel]
          : null,
    [isSurvival, stage, config.cpuLevel],
  );
  const lastFireRef = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const aimRef = useRef<Record<PlayerId, Aim | null>>({ 1: null, 2: null });
  const endedRef = useRef(false);
  const [, setTick] = useState(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  // タッチ操作はテンポよく押せるようにクールダウン短め
  const cooldownMs = control === 'touch' ? 420 : ROBOT_COOLDOWN_MS;
  const canFire = (owner: PlayerId): boolean =>
    !stateRef.current.over && Date.now() - lastFireRef.current[owner] >= cooldownMs;

  const fire = (owner: PlayerId, aim: Aim): void => {
    if (!canFire(owner)) return;
    if (fireRobotBall(stateRef.current, layout, owner, aim)) {
      lastFireRef.current[owner] = Date.now();
      playSfx('launch');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // ゲームイベントの効果音・振動(ループとタッチ操作の両方から使う)
  const playEvents = (events: RobotEvents): void => {
    if (events.panelHit) playSfx('click');
    if (events.attackStart) playSfx('alarm');
    if (events.counter) {
      playSfx('special');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (events.special) playSfx('special');
    if (events.damaged) {
      playSfx('crash');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (events.ko) {
      playSfx('crash');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    if (events.timeUp) playSfx('alarm');
  };

  // タッチモード: パネルを直接タップして技を出す
  const tapPanel = (owner: PlayerId, index: number): void => {
    if (!running || !canFire(owner)) return;
    lastFireRef.current[owner] = Date.now();
    const events: RobotEvents = {
      panelHit: true,
      attackStart: false,
      damaged: false,
      counter: false,
      guard: false,
      special: false,
      ko: false,
      timeUp: false,
    };
    triggerPanel(stateRef.current, layout, owner, index, events);
    playEvents(events);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  // ゲームループ
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const state = stateRef.current;
      const events = stepRobot(state, layout, dt);
      if (isCpu && cpuCfg) {
        const aimed = stepRobotCpu(cpuRef.current, cpuCfg, state, layout, dt, events);
        if (aimed) playSfx('launch');
      }
      playEvents(events);
      setTick((t) => t + 1);
      // 決着演出(KO/タイムアップ)を見せてからリザルトへ
      if (state.over && state.koT <= 0 && !endedRef.current) {
        endedRef.current = true;
        stopBgm();
        onEndRef.current(toResult(state));
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, layout, isCpu, cpuCfg]);

  const makePan = (owner: PlayerId) =>
    Gesture.Pan()
      .runOnJS(true)
      .maxPointers(1)
      .onUpdate((e) => {
        if (canFire(owner)) {
          aimRef.current[owner] = { dx: e.translationX, dy: e.translationY };
        } else {
          aimRef.current[owner] = null;
        }
      })
      .onEnd(() => {
        const aim = aimRef.current[owner];
        aimRef.current[owner] = null;
        if (aim && running) fire(owner, aim);
      })
      .onFinalize(() => {
        aimRef.current[owner] = null;
      });

  const [pan1, pan2] = useMemo(() => {
    const p1 = makePan(1);
    const p2 = makePan(2);
    p1.simultaneousWithExternalGesture(p2);
    p2.simultaneousWithExternalGesture(p1);
    return [p1, p2];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, running]);

  const restart = () => {
    stateRef.current = createRobotState(
      layout,
      config.p1Animal,
      config.p2Animal,
      duration,
      maxHp,
      config.carryHp ?? maxHp,
    );
    cpuRef.current = createRobotCpuState();
    lastFireRef.current = { 1: 0, 2: 0 };
    endedRef.current = false;
    setPaused(false);
    setCountdown(3);
  };

  const state = stateRef.current;
  const half = layout.centerY;
  const pos = robotPositions(layout);
  const telegraph = cpuRef.current.pending
    ? state.panels2[cpuRef.current.pending.index] ?? null
    : null;

  const shakeAmp = state.shakeT * 20;
  const shakeX = Math.sin(state.elapsed * 87) * shakeAmp;
  const shakeY = Math.cos(state.elapsed * 71) * shakeAmp;

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height }}>
        <Group transform={[{ translateX: shakeX }, { translateY: shakeY }]}>
          <Background width={width} height={height} centerY={half} t={state.elapsed} />
          <RobotArena state={state} layout={layout} t={state.elapsed} telegraph={telegraph ? { x: telegraph.x, y: telegraph.y } : null} />
          {control === 'ball' && is2p && (
            <Launcher owner={2} layout={layout} aim={aimRef.current[2]} t={state.elapsed} ready={canFire(2)} />
          )}
          {control === 'ball' && (
            <Launcher owner={1} layout={layout} aim={aimRef.current[1]} t={state.elapsed} ready={canFire(1)} />
          )}
          <Particles particles={state.particles} />
        </Group>
      </Canvas>

      {/* パネルの技絵文字+説明ラベル(Canvasの上に重ねる) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {state.panels1.map((p, i) => (
          <View key={`p1-${i}`} style={[styles.panelLabel, { left: p.x - 34, top: p.y - 27 }]}>
            <Text style={styles.panelEmoji}>{PANEL_INFO[p.kind].emoji}</Text>
            <Text style={styles.panelSub}>{PANEL_INFO[p.kind].sub}</Text>
          </View>
        ))}
        {state.panels2.map((p, i) => (
          <View
            key={`p2-${i}`}
            style={[styles.panelLabel, is2p && styles.flipped, { left: p.x - 34, top: p.y - 27 }]}
          >
            <Text style={styles.panelEmoji}>{PANEL_INFO[p.kind].emoji}</Text>
            <Text style={styles.panelSub}>{PANEL_INFO[p.kind].sub}</Text>
          </View>
        ))}

        {/* カウンターチャンスの合図: 相手がふりかぶったら自分側に表示 */}
        {state.p2.attack && state.p2.attack.kind !== 'special' && (
          <View
            style={[styles.counterWrap, { top: layout.launcher1.y - height * 0.115 - 17 }]}
          >
            <Animated.Text
              key={state.p2.attack.seq}
              entering={ZoomIn.duration(150)}
              style={styles.counterBadge}
            >
              ⚡ {PANEL_INFO[state.p2.attack.kind].emoji}でカウンター!
            </Animated.Text>
          </View>
        )}
        {is2p && state.p1.attack && state.p1.attack.kind !== 'special' && (
          <View
            style={[
              styles.counterWrap,
              styles.flipped,
              { top: layout.launcher2.y + height * 0.115 - 17 },
            ]}
          >
            <Animated.Text
              key={state.p1.attack.seq}
              entering={ZoomIn.duration(150)}
              style={styles.counterBadge}
            >
              ⚡ {PANEL_INFO[state.p1.attack.kind].emoji}でカウンター!
            </Animated.Text>
          </View>
        )}

        {/* ふりかぶり表示: 何の技が来るかは相手にも見える(ガード・カウンターのチャンス!) */}
        <WindupBadge fighter={state.p1} x={pos.robot1.x + 66} y={pos.robot1.y} flip={is2p} />
        <WindupBadge fighter={state.p2} x={pos.robot2.x + 66} y={pos.robot2.y} flip={false} />

        {/* しびれ表示 */}
        {state.p1.stunT > 0 && (
          <Text style={[styles.stunEmoji, { left: pos.robot1.x - 15, top: pos.robot1.y - 74 }]}>💫</Text>
        )}
        {state.p2.stunT > 0 && (
          <Text style={[styles.stunEmoji, { left: pos.robot2.x - 15, top: pos.robot2.y + 44 }]}>💫</Text>
        )}

        {/* ダメージ数字 */}
        {state.pops.map((p) => (
          <Text
            key={p.id}
            style={[
              styles.dmgPop,
              p.defender === 2 && is2p && styles.flipped,
              { left: p.x - 40, top: p.y - p.age * 46, opacity: Math.max(0, 1 - p.age / 0.9) },
            ]}
          >
            -{p.amount}
          </Text>
        ))}
      </View>

      {/* ビーダマ操作: ひっぱりのタッチ領域(上半分はP2、2人対戦のときだけ) */}
      {control === 'ball' && is2p && (
        <GestureDetector gesture={pan2}>
          <View style={[styles.touchArea, { top: 0, height: half }]} />
        </GestureDetector>
      )}
      {control === 'ball' && (
        <GestureDetector gesture={pan1}>
          <View style={[styles.touchArea, { top: half, height: half }]} />
        </GestureDetector>
      )}

      {/* タッチ操作: パネルを直接タップ */}
      {control === 'touch' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {robotPanels(state, 1).map((p, i) => (
            <Pressable
              key={`t1-${i}`}
              style={[styles.panelTouch, { left: p.x - PANEL_SIZE / 2 - 4, top: p.y - PANEL_SIZE / 2 - 4 }]}
              onPress={() => tapPanel(1, i)}
            />
          ))}
          {is2p &&
            robotPanels(state, 2).map((p, i) => (
              <Pressable
                key={`t2-${i}`}
                style={[styles.panelTouch, { left: p.x - PANEL_SIZE / 2 - 4, top: p.y - PANEL_SIZE / 2 - 4 }]}
                onPress={() => tapPanel(2, i)}
              />
            ))}
        </View>
      )}

      <MuteButton style={{ position: 'absolute', right: 8, top: half - 20 }} />

      {running && (
        <Pressable
          style={[styles.pauseButton, { top: half - 20 }]}
          hitSlop={8}
          onPress={() => {
            setPaused(true);
            stopBgm();
          }}
        >
          <Text style={styles.pauseIcon}>⚙️</Text>
        </Pressable>
      )}

      {/* HUD: HPバーとB魂ゲージ */}
      <RobotHud
        owner={2}
        fighter={state.p2}
        maxHp={state.maxHp}
        timeLeft={state.timeLeft}
        flip={is2p}
        height={height}
        cpuName={isCpu ? CPU_LEVEL_INFO[isSurvival ? survivalLevel(stage) : config.cpuLevel ?? 'turtle'].nameJa : null}
      />
      <RobotHud
        owner={1}
        fighter={state.p1}
        maxHp={state.maxHp}
        timeLeft={state.timeLeft}
        flip={false}
        height={height}
        cpuName={null}
      />

      {/* 通知(カウンター!など) */}
      <NoticeText notice={state.notice1} top={height * 0.6} flip={false} />
      <NoticeText notice={state.notice2} top={height * 0.36} flip={is2p} />

      {/* 必殺技バナー */}
      {state.p1.specialFlashT > 0 && (
        <SpecialBanner animal={config.p1Animal} top={height * 0.7} flip={false} />
      )}
      {state.p2.specialFlashT > 0 && (
        <SpecialBanner animal={config.p2Animal} top={height * 0.16} flip={is2p} />
      )}

      {/* 決着演出 */}
      {state.over && (
        <View style={styles.centerWrap} pointerEvents="none">
          <Animated.Text entering={ZoomIn.springify().damping(10)} style={styles.koText}>
            {state.timeUp ? '⏰ タイムアップ!' : '💥 KO!'}
          </Animated.Text>
          {is2p && (
            <View style={styles.flipped}>
              <Animated.Text entering={ZoomIn.springify().damping(10)} style={styles.koText}>
                {state.timeUp ? '⏰ タイムアップ!' : '💥 KO!'}
              </Animated.Text>
            </View>
          )}
        </View>
      )}

      {/* ポーズメニュー */}
      {paused && (
        <View style={styles.overlay}>
          <View style={styles.pauseMenu}>
            <Text style={styles.pauseTitle}>⚙️ ポーズ</Text>
            <Text style={styles.pauseLabel}>パネルの操作</Text>
            <RobotControlToggle
              control={control}
              onChange={(c) => {
                setRobotControl(c);
                setControl(c);
              }}
            />
            <JuicyButton
              label="▶ 続ける"
              onPress={() => {
                setPaused(false);
                resumeBgm();
              }}
            />
            <JuicyButton label="🔄 最初から" color="#43A047" onPress={restart} />
            <JuicyButton
              label="🏁 試合を終わる"
              color="#E53935"
              onPress={() => {
                stopBgm();
                onEndRef.current(toResult(stateRef.current, true));
              }}
            />
          </View>
        </View>
      )}

      {/* あそびかた説明(初回のみ、閉じるとカウントダウン開始) */}
      {showHelp && (
        <View style={styles.overlay}>
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>🥊 闘魂ロボットバトル</Text>
            <Text style={styles.helpLine}>
              {control === 'touch'
                ? 'パネルをタッチすると\nロボットが技を出すよ!'
                : 'パネルをビーダマで撃つと\nロボットが技を出すよ!'}
            </Text>
            <View style={styles.helpRows}>
              <Text style={styles.helpRow}>👊 パンチ … よわいけど <Text style={styles.helpStrong}>B魂ゲージがたまる</Text></Text>
              <Text style={styles.helpRow}>🦵 キック / 🟢 ビーダマ … ゲージを少し使う</Text>
              <Text style={styles.helpRow}>🔵 つよビーダマ … ゲージたくさんで強力!</Text>
              <Text style={styles.helpRow}>💎 ひっさつ … <Text style={styles.helpStrong}>ゲージMAX</Text>のとき最強技!</Text>
              <Text style={styles.helpRow}>🛡️ ガード … 受けるダメージ半分</Text>
              <Text style={styles.helpRow}>⚡ 相手がふりかぶったら<Text style={styles.helpStrong}>金色に光るパネル</Text>を撃つとカウンター!</Text>
            </View>
            <Text style={styles.helpLine}>先に相手のHPを0にしたら勝ち!{'\n'}時間切れはHPが多いほうの勝ち!</Text>
            <JuicyButton
              label="わかった!"
              onPress={() => {
                robotHelpShown = true;
                setShowHelp(false);
              }}
              style={styles.helpButton}
            />
          </View>
        </View>
      )}

      {/* カウントダウン + あそびかたヒント */}
      {!showHelp && countdown > 0 && (
        <View style={styles.countdownWrap} pointerEvents="none">
          <View style={styles.countBlock}>
            <Animated.Text key={countdown} entering={ZoomIn.springify().damping(12)} style={styles.countdownText}>
              {countdown}
            </Animated.Text>
            <Text style={styles.ruleLabel}>
              🥊 闘魂ロボットバトル
              {isSurvival ? ` ${stage}人目: ${CPU_LEVEL_INFO[survivalLevel(stage)].nameJa}` : ''}
            </Text>
            <Text style={styles.hintText}>
              {control === 'touch'
                ? 'パネルをタッチするとロボットが攻撃!'
                : 'パネルをビーダマで撃つとロボットが攻撃!'}
            </Text>
            <Text style={styles.hintText}>
              👊ためる 🦵キック 🟢ビーダマ 🔵つよい 💎ひっさつ 🛡️ガード
            </Text>
            <Text style={styles.hintText}>相手と同じ技パネルを撃てばカウンター!</Text>
          </View>
          {is2p && (
            <View style={[styles.flipped, styles.countBlock]}>
              <Animated.Text key={`f-${countdown}`} entering={ZoomIn.springify().damping(12)} style={styles.countdownText}>
                {countdown}
              </Animated.Text>
              <Text style={styles.hintText}>
                {control === 'touch'
                  ? 'パネルをタッチするとロボットが攻撃!'
                  : 'パネルをビーダマで撃つとロボットが攻撃!'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ふりかぶり中の技を横に表示(❗つき)
function WindupBadge({
  fighter,
  x,
  y,
  flip,
}: {
  fighter: RobotFighter;
  x: number;
  y: number;
  flip: boolean;
}) {
  if (!fighter.attack) return null;
  const emoji =
    fighter.attack.kind === 'special' ? '💎' : PANEL_INFO[fighter.attack.kind].emoji;
  return (
    <Text style={[styles.windupBadge, flip && styles.flipped, { left: x - 8, top: y - 16 }]}>
      {emoji}❗
    </Text>
  );
}

// HPバー + B魂ゲージ + タイマー
function RobotHud({
  owner,
  fighter,
  maxHp,
  timeLeft,
  flip,
  height,
  cpuName,
}: {
  owner: PlayerId;
  fighter: RobotFighter;
  maxHp: number;
  timeLeft: number;
  flip: boolean;
  height: number;
  cpuName: string | null;
}) {
  const spec = ANIMALS[fighter.animal];
  const teamColor = owner === 1 ? COLORS.p1 : '#fff';
  const pct = fighter.hp / maxHp;
  const hpColor = pct > 0.5 ? '#66BB6A' : pct > 0.25 ? '#FFA726' : '#E53935';
  const rowTop = owner === 1 ? height - 48 : 8;
  const gaugeTop = owner === 1 ? height - 64 : 48;
  const time = Math.ceil(timeLeft);
  const hurry = time <= 10;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.hudRow, flip && styles.flipped, { top: rowTop }]}>
        <Text style={[styles.hudName, { color: teamColor }]}>
          {spec.emoji}
          {cpuName ?? spec.nameJa}
        </Text>
        <View style={styles.hpBarBg}>
          <View style={[styles.hpBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: hpColor }]} />
        </View>
        <Text style={[styles.hudHp, { color: teamColor }]}>{fighter.hp}</Text>
        <Text style={[styles.timer, hurry && styles.timerHurry]}>{time}</Text>
      </View>
      <View style={[styles.gaugeWrap, flip && styles.flipped, { top: gaugeTop }]}>
        <Text style={styles.gaugeLabel}>B魂</Text>
        <View style={styles.gaugeBg}>
          <View
            style={[
              styles.gaugeFill,
              {
                width: `${Math.round(fighter.gauge * 100)}%`,
                backgroundColor: fighter.gauge >= 1 ? '#FFD700' : '#7E57C2',
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function NoticeText({ notice, top, flip }: { notice: Notice | null; top: number; flip: boolean }) {
  if (!notice) return null;
  return (
    <View style={[styles.noticeWrap, { top }, flip && styles.flipped]} pointerEvents="none">
      <Animated.View entering={ZoomIn.duration(200)} key={notice.text}>
        <Text style={styles.noticeText}>{notice.text}</Text>
      </Animated.View>
    </View>
  );
}

function SpecialBanner({ animal, top, flip }: { animal: GameConfig['p1Animal']; top: number; flip: boolean }) {
  const sp = ROBOT_SPECIALS[animal];
  const spec = ANIMALS[animal];
  return (
    <View style={[styles.noticeWrap, { top }, flip && styles.flipped]} pointerEvents="none">
      <Animated.View entering={ZoomIn.duration(200)} style={styles.banner}>
        <Text style={styles.bannerTitle}>
          {spec.emoji} {sp.name}!
        </Text>
        <Text style={styles.bannerDesc}>{sp.desc}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.fieldP1 },
  touchArea: { position: 'absolute', left: 0, right: 0 },
  flipped: { transform: [{ rotate: '180deg' }] },
  panelTouch: { position: 'absolute', width: PANEL_SIZE + 8, height: PANEL_SIZE + 8 },
  panelLabel: { position: 'absolute', width: 68, alignItems: 'center' },
  panelEmoji: { fontSize: 23 },
  panelSub: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  counterWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  counterBadge: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFD700',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  stunEmoji: { position: 'absolute', fontSize: 26 },
  windupBadge: {
    position: 'absolute',
    fontSize: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  dmgPop: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFEB3B',
    textShadowColor: 'rgba(183,28,28,0.9)',
    textShadowRadius: 6,
  },
  hudRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hudName: {
    fontSize: 17,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  hpBarBg: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  hpBarFill: { height: '100%', borderRadius: 8 },
  hudHp: {
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  timer: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF9C4',
    minWidth: 40,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  timerHurry: { color: '#FF7043', fontSize: 24 },
  gaugeWrap: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gaugeLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  gaugeBg: {
    width: 150,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  gaugeFill: { height: '100%', borderRadius: 5 },
  pauseButton: {
    position: 'absolute',
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: { fontSize: 18 },
  noticeWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  noticeText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  banner: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  bannerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFD700' },
  bannerDesc: { fontSize: 14, color: '#fff', marginTop: 2 },
  centerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  koText: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#FFEB3B',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pauseMenu: {
    backgroundColor: COLORS.uiBg,
    borderRadius: 24,
    padding: 24,
    gap: 14,
    width: 280,
    alignItems: 'stretch',
  },
  pauseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  pauseLabel: { fontSize: 13, fontWeight: 'bold', color: '#DCEDC8', marginBottom: -6 },
  countdownWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  countBlock: { alignItems: 'center', gap: 4 },
  countdownText: {
    fontSize: 90,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
  ruleLabel: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFEB3B',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  hintText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  helpCard: {
    backgroundColor: COLORS.uiBg,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 20,
    width: '90%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 10,
  },
  helpTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFEB3B' },
  helpLine: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 21,
  },
  helpRows: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  helpRow: { fontSize: 13, fontWeight: 'bold', color: '#F1F8E9', lineHeight: 18 },
  helpStrong: { color: '#FFD700' },
  helpButton: { paddingHorizontal: 40, marginTop: 2 },
});
