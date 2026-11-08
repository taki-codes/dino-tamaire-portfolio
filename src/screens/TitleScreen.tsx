import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ANIMAL_IDS } from '../characters';
import { ControlToggle } from '../components/ControlToggle';
import { RobotControlToggle } from '../components/RobotControlToggle';
import { JuicyButton } from '../components/JuicyButton';
import { MuteButton } from '../components/MuteButton';
import { COLORS } from '../constants';
import { useRafClock } from '../hooks/useRafClock';
import { Pressable } from 'react-native';
import { playSfx } from '../audio/sound';
import { AnimalFigure } from '../render/Animal';
import {
  ControlType,
  getControlType,
  getMatchDuration,
  getRobotControl,
  getRobotHp,
  MATCH_DURATION_MAX,
  MATCH_DURATION_MIN,
  ROBOT_HP_MAX,
  ROBOT_HP_MIN,
  RobotControlType,
  setControlType,
  setMatchDuration,
  setRobotControl,
  setRobotHp,
} from '../settings';

export function TitleScreen({ onStart }: { onStart: () => void }) {
  const { width, height } = useWindowDimensions();
  const t = useRafClock();
  const [control, setControl] = React.useState<ControlType>(getControlType());
  const [duration, setDuration] = React.useState(getMatchDuration());
  const [robotControl, setRobotControlState] = React.useState<RobotControlType>(getRobotControl());
  const [robotHp, setRobotHpState] = React.useState(getRobotHp());
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const changeDuration = (seconds: number) => {
    setMatchDuration(seconds);
    setDuration(getMatchDuration()); // クランプ後の値を表示に反映
    playSfx('click');
  };

  const changeRobotHp = (hp: number) => {
    setRobotHp(hp);
    setRobotHpState(getRobotHp()); // クランプ後の値を表示に反映
    playSfx('click');
  };

  // タイトル文字のゆったりした上下の揺れ
  const bob = useSharedValue(0);
  React.useEffect(() => {
    bob.value = withRepeat(
      withSequence(withTiming(-6, { duration: 1200 }), withTiming(0, { duration: 1200 })),
      -1,
      true,
    );
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  const lineupY = height * 0.68;
  // 7匹が両端も切れずに収まる間隔(両サイドに動物の半身ぶんの余白を確保)
  const spacing = Math.min((width - 96) / 6, 56);
  const lineupStartX = width / 2 - spacing * 3;

  return (
    <View style={styles.container}>
      {/* 背景+動物たちの行進(Skia) */}
      <Canvas style={{ position: 'absolute', width, height }}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={[COLORS.fieldP2Deep, COLORS.fieldP2, COLORS.fieldP1, COLORS.fieldP1Deep]}
          />
        </Rect>
        {ANIMAL_IDS.map((id, i) => {
          const hop = Math.abs(Math.sin(t * 2.6 + i * 0.9)) * 12;
          return (
            <AnimalFigure
              key={id}
              animal={id}
              x={lineupStartX + i * spacing}
              y={lineupY - hop}
              dir={1}
              scale={0.62}
              t={t + i}
            />
          );
        })}
      </Canvas>

      <MuteButton style={styles.mute} />

      <View style={styles.content} pointerEvents="box-none">
        <Animated.Text style={[styles.title, bobStyle]}>動物えさやりバトル</Animated.Text>
        <Text style={styles.subtitle}>
          引っ張って離すと えさが飛ぶよ。{'\n'}
          動物たちに たくさん えさをあげよう!{'\n'}
          おなかをすかせると おこって突進してくるよ!
        </Text>
        <JuicyButton
          label="遊ぶ!"
          color={COLORS.p1}
          onPress={onStart}
          style={styles.playButton}
          textStyle={styles.playText}
        />
        <JuicyButton
          label="⚙️ 設定"
          color="#546E7A"
          onPress={() => setSettingsOpen(true)}
          style={styles.settingsButton}
          textStyle={styles.settingsButtonText}
        />
      </View>

      {/* 設定パネル: 発射操作の切り替え(ゲーム中のポーズメニューからも変えられる) */}
      {settingsOpen && (
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsCard}>
            {/* 項目が増えて小さい画面に収まらないのでスクロールできるようにする */}
            <ScrollView bounces={false} contentContainerStyle={styles.settingsScroll}>
              <Text style={styles.settingsTitle}>⚙️ 設定</Text>
              <Text style={styles.settingsLabel}>発射の操作</Text>
              <ControlToggle
                control={control}
                onChange={(c) => {
                  setControlType(c);
                  setControl(c);
                }}
              />

              {/* 試合時間: プリセット+10秒きざみで任意調整(対戦モード用) */}
              <Text style={[styles.settingsLabel, { marginTop: 16 }]}>
                試合の時間(対戦)
              </Text>
              <View style={styles.durationChips}>
                {[30, 60, 90].map((v) => (
                  <Pressable
                    key={v}
                    style={[styles.durationChip, duration === v && styles.durationChipActive]}
                    onPress={() => changeDuration(v)}
                  >
                    <Text
                      style={[styles.durationChipText, duration === v && styles.durationChipTextActive]}
                    >
                      {v}秒
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.durationStepper}>
                <Pressable
                  style={[styles.stepButton, duration <= MATCH_DURATION_MIN && styles.stepButtonDisabled]}
                  onPress={() => changeDuration(duration - 10)}
                >
                  <Text style={styles.stepButtonText}>−10</Text>
                </Pressable>
                <Text style={styles.durationValue}>{duration}秒</Text>
                <Pressable
                  style={[styles.stepButton, duration >= MATCH_DURATION_MAX && styles.stepButtonDisabled]}
                  onPress={() => changeDuration(duration + 10)}
                >
                  <Text style={styles.stepButtonText}>+10</Text>
                </Pressable>
              </View>
              <Text style={styles.durationNote}>勝ち抜きサバイバルは30秒固定</Text>

              {/* ロボットバトル: パネルの操作 */}
              <Text style={[styles.settingsLabel, { marginTop: 16 }]}>
                🥊 ロボットバトルの操作
              </Text>
              <RobotControlToggle
                control={robotControl}
                onChange={(c) => {
                  setRobotControl(c);
                  setRobotControlState(c);
                }}
              />

              {/* ロボットバトル: HP */}
              <Text style={[styles.settingsLabel, { marginTop: 16 }]}>
                🥊 ロボットのHP
              </Text>
              <View style={styles.durationChips}>
                {[100, 150, 300].map((v) => (
                  <Pressable
                    key={v}
                    style={[styles.durationChip, robotHp === v && styles.durationChipActive]}
                    onPress={() => changeRobotHp(v)}
                  >
                    <Text
                      style={[styles.durationChipText, robotHp === v && styles.durationChipTextActive]}
                    >
                      {v}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.durationStepper}>
                <Pressable
                  style={[styles.stepButton, robotHp <= ROBOT_HP_MIN && styles.stepButtonDisabled]}
                  onPress={() => changeRobotHp(robotHp - 25)}
                >
                  <Text style={styles.stepButtonText}>−25</Text>
                </Pressable>
                <Text style={styles.durationValue}>HP {robotHp}</Text>
                <Pressable
                  style={[styles.stepButton, robotHp >= ROBOT_HP_MAX && styles.stepButtonDisabled]}
                  onPress={() => changeRobotHp(robotHp + 25)}
                >
                  <Text style={styles.stepButtonText}>+25</Text>
                </Pressable>
              </View>

              <JuicyButton
                label="閉じる"
                onPress={() => setSettingsOpen(false)}
                style={styles.closeButton}
              />
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.fieldP1 },
  mute: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 140, // 動物の行進とかぶらないように上寄せ
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 8,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#F1F8E9',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 36,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowRadius: 4,
  },
  playButton: { paddingHorizontal: 44, paddingVertical: 16 },
  playText: { fontSize: 22 },
  settingsButton: { marginTop: 14, paddingHorizontal: 24, paddingVertical: 10 },
  settingsButtonText: { fontSize: 15 },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  settingsCard: {
    backgroundColor: COLORS.uiBg,
    borderRadius: 24,
    paddingHorizontal: 26,
    width: '100%',
    maxWidth: 360,
    maxHeight: '88%', // 縦に伸びすぎないよう上限を切り、中身はスクロール
  },
  settingsScroll: { paddingVertical: 22 },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 14,
  },
  settingsLabel: { fontSize: 14, fontWeight: 'bold', color: '#DCEDC8', marginBottom: 8 },
  durationChips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  durationChip: {
    flex: 1,
    backgroundColor: COLORS.uiCard,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  durationChipActive: { backgroundColor: COLORS.uiAccent },
  durationChipText: { fontSize: 14, fontWeight: 'bold', color: '#DCEDC8' },
  durationChipTextActive: { color: '#4E342E' },
  durationStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  stepButton: {
    backgroundColor: COLORS.uiCard,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  stepButtonDisabled: { opacity: 0.35 },
  stepButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  durationValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFEB3B',
    minWidth: 96,
    textAlign: 'center',
  },
  durationNote: { fontSize: 11, color: '#C5E1A5', textAlign: 'center', marginTop: 6 },
  closeButton: { marginTop: 16 },
});
