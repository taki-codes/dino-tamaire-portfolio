import { Canvas, Circle, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { playSfx, resumeBgm, startBgm, stopBgm } from '../audio/sound';
import { ANIMALS } from '../characters';
import { JuicyButton } from '../components/JuicyButton';
import { MuteButton } from '../components/MuteButton';
import { COLORS } from '../constants';
import {
  MERGE_CHAIN,
  MergeState,
  ZOMBIE_TIER,
  createMergeLayout,
  createMergeState,
  dropGuideY,
  dropMergeBall,
  mergeRadius,
  stepMerge,
} from '../game/merge';
import { Particles } from '../render/Effects';
import { MergeBalls } from '../render/MergeBalls';
import { GameConfig, GameResult } from '../types';

interface MergeScreenProps {
  config: GameConfig;
  onEnd: (result: GameResult) => void;
}

function toResult(state: MergeState, aborted = false): GameResult {
  return {
    score1: state.score,
    score2: 0,
    shots1: state.drops,
    shots2: 0,
    aborted,
    bestAnimal: MERGE_CHAIN[state.bestTier],
    lions: state.lions,
    defeated: state.zombiesCleared,
  };
}

// どうぶつマージ: 上から動物を落として、同じ動物をぶつけて進化させるひとり用パズル
export function MergeScreen({ onEnd }: MergeScreenProps) {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => createMergeLayout(width, height), [width, height]);

  const [countdown, setCountdown] = useState(3);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const running = countdown === 0 && !paused && !gameOver;

  useEffect(() => {
    if (countdown === 0) {
      playSfx('go');
      startBgm();
      return;
    }
    playSfx('count');
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [countdown]);

  const stateRef = useRef<MergeState>(createMergeState());
  const aimXRef = useRef(width / 2);
  const [, setTick] = useState(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  // ゲームループ: 物理を進めてイベント音を鳴らす
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const state = stateRef.current;
      const events = stepMerge(state, layout, dt);
      if (events.lionBlast) {
        playSfx('special');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (events.mergedTier >= 0) {
        playSfx('goal');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      if (events.zombieDown) {
        playSfx('crash');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      setTick((t) => t + 1);
      if (events.gameOver) {
        stopBgm();
        playSfx('crash');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setGameOver(true);
        // 「いっぱいになっちゃった」を見せてからリザルトへ
        setTimeout(() => onEndRef.current(toResult(stateRef.current)), 1400);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, layout]);

  // 操作: 触って左右に動かして狙い、離すと落とす(タップでもその場に落ちる)
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .maxPointers(1)
        .onBegin((e) => {
          aimXRef.current = e.x;
        })
        .onUpdate((e) => {
          aimXRef.current = e.x;
        })
        .onEnd(() => {
          const state = stateRef.current;
          if (!state.over && countdown === 0 && !paused) {
            if (dropMergeBall(state, layout, aimXRef.current)) {
              playSfx('launch');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
          }
        }),
    [layout, countdown, paused],
  );

  const state = stateRef.current;
  const currentR = mergeRadius(layout, state.current);
  const guideY = dropGuideY(layout, currentR);
  const aimX = Math.min(Math.max(aimXRef.current, layout.left + currentR), layout.right - currentR);
  // らいおん消しの画面シェイク
  const shakeX = state.shakeT > 0 ? Math.sin(state.elapsed * 55) * 7 * state.shakeT : 0;
  // デンジャーラインは危ないとき赤く点滅する
  const dangerBlink = state.dangerT > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(state.elapsed * 8)) : 0.28;

  const restart = () => {
    stateRef.current = createMergeState();
    aimXRef.current = width / 2;
    setGameOver(false);
    setPaused(false);
    setCountdown(3);
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height }}>
          <Group transform={[{ translateX: shakeX }]}>
            {/* 背景とフィールドの器 */}
            <Rect x={0} y={0} width={width} height={height} color={COLORS.uiBg} />
            <RoundedRect
              x={layout.left - 10}
              y={layout.topY - 60}
              width={layout.right - layout.left + 20}
              height={layout.floorY - layout.topY + 70}
              r={18}
              color="#FFF8E1"
            />
            {/* 壁と床(木の枠) */}
            <RoundedRect x={layout.left - 10} y={layout.topY - 60} width={10} height={layout.floorY - layout.topY + 70} r={5} color="#8D6E63" />
            <RoundedRect x={layout.right} y={layout.topY - 60} width={10} height={layout.floorY - layout.topY + 70} r={5} color="#8D6E63" />
            <RoundedRect x={layout.left - 10} y={layout.floorY} width={layout.right - layout.left + 20} height={12} r={5} color="#8D6E63" />

            {/* デンジャーライン */}
            <Rect x={layout.left} y={layout.topY} width={layout.right - layout.left} height={3} color="#E53935" opacity={dangerBlink} />

            {/* 落とすガイド(クールダウン中は薄く) */}
            {running && (
              <Group opacity={state.cooldown > 0 ? 0.35 : 1}>
                <Rect x={aimX - 1} y={guideY} width={2} height={layout.floorY - guideY} color="rgba(0,0,0,0.14)" />
                <MergeBalls
                  t={state.elapsed}
                  balls={[
                    {
                      id: -1,
                      tier: state.current,
                      kind: state.current === ZOMBIE_TIER ? 'zombie' : 'animal',
                      hp: 2,
                      x: aimX,
                      y: guideY,
                      vx: 0,
                      vy: 0,
                      r: currentR,
                      dropT: 0,
                      hungerLimit: Infinity,
                      hopT: 0,
                      flashT: 0,
                      dead: false,
                    },
                  ]}
                />
              </Group>
            )}

            <MergeBalls balls={state.balls} t={state.elapsed} />
            <Particles particles={state.particles} />
          </Group>
        </Canvas>
      </GestureDetector>

      {/* 上部UI: スコア・つぎの動物 */}
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>スコア</Text>
          <Text style={styles.scoreValue}>{state.score}</Text>
        </View>
        <View style={styles.nextCard}>
          <Text style={styles.nextLabel}>つぎ</Text>
          <Text style={styles.nextEmoji}>
            {state.next === ZOMBIE_TIER ? '🧟' : ANIMALS[MERGE_CHAIN[state.next]].emoji}
          </Text>
        </View>
        <Pressable style={styles.pauseButton} onPress={() => { setPaused(true); stopBgm(); }} hitSlop={8}>
          <Text style={styles.pauseIcon}>⚙️</Text>
        </Pressable>
        <MuteButton />
      </View>

      {/* 下部: 進化チェーン */}
      <View style={styles.chainBar} pointerEvents="none">
        <Text style={styles.chainText}>
          {MERGE_CHAIN.map((id) => ANIMALS[id].emoji).join(' → ')}
        </Text>
        <Text style={styles.chainHint}>🧟 ゾンビは そばで2回合体して退治! 🦁+🦁 = だいばくはつ!</Text>
      </View>

      {/* カウントダウン */}
      {countdown > 0 && (
        <View style={styles.overlay} pointerEvents="none">
          <Animated.Text key={countdown} entering={ZoomIn.duration(250)} style={styles.countdownText}>
            {countdown}
          </Animated.Text>
        </View>
      )}

      {/* ゲームオーバー */}
      {gameOver && (
        <View style={styles.overlay} pointerEvents="none">
          <Animated.Text entering={ZoomIn.duration(300)} style={styles.gameOverText}>
            😵 いっぱいに{'\n'}なっちゃった…
          </Animated.Text>
        </View>
      )}

      {/* ポーズメニュー */}
      {paused && (
        <View style={styles.overlay}>
          <View style={styles.pauseMenu}>
            <Text style={styles.pauseTitle}>ポーズちゅう</Text>
            <JuicyButton
              label="つづける"
              color={COLORS.uiAccent}
              onPress={() => { setPaused(false); resumeBgm(); }}
            />
            <JuicyButton label="はじめから" color="#546E7A" onPress={restart} />
            <JuicyButton
              label="やめる"
              color="#546E7A"
              onPress={() => { stopBgm(); onEndRef.current(toResult(stateRef.current, true)); }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.uiBg },
  topBar: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 8,
    flex: 1,
  },
  scoreLabel: { fontSize: 12, color: '#DCEDC8', fontWeight: 'bold' },
  scoreValue: { fontSize: 22, color: '#FFEB3B', fontWeight: 'bold' },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  nextLabel: { fontSize: 12, color: '#DCEDC8', fontWeight: 'bold' },
  nextEmoji: { fontSize: 24 },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: { fontSize: 18 },
  chainBar: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 3,
  },
  chainText: { fontSize: 20, letterSpacing: 1 },
  chainHint: { fontSize: 12, color: '#DCEDC8', fontWeight: 'bold' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  countdownText: {
    fontSize: 96,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
  gameOverText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
  pauseMenu: {
    backgroundColor: COLORS.uiBg,
    borderRadius: 24,
    padding: 24,
    gap: 14,
    width: 260,
    alignItems: 'stretch',
  },
  pauseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
});
