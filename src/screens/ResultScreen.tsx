import { Canvas, Group, RoundedRect, vec } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { playSfx } from '../audio/sound';
import { ANIMALS, CPU_LEVEL_INFO } from '../characters';
import { survivalLevel } from '../game/cpu';
import { JuicyButton } from '../components/JuicyButton';
import { COLORS, REACT_DURATION } from '../constants';
import { useRafClock } from '../hooks/useRafClock';
import { AnimalFigure } from '../render/Animal';
import { AnimalId, GameConfig, GameResult, PlayerId } from '../types';

interface ResultScreenProps {
  config: GameConfig;
  result: GameResult;
  onRematch: () => void;
  onModeSelect: () => void;
  onTitle: () => void;
}

export function ResultScreen({ config, result, onRematch, onModeSelect, onTitle }: ResultScreenProps) {
  const t = useRafClock();
  const { width, height } = useWindowDimensions();

  // まとあて射的のソロは勝敗のないスコアアタック(2人プレイは対戦扱い)
  const gallerySolo = config.mode === 'gallery' && config.players !== 2;

  // 入場時に一度だけファンファーレ(勝敗あり)かひきわけ音を鳴らす
  useEffect(() => {
    if (
      config.mode === 'practice' ||
      config.mode === 'zombie' ||
      config.mode === 'merge' ||
      gallerySolo ||
      result.score1 !== result.score2
    ) {
      playSfx('win');
    } else {
      playSfx('draw');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (config.mode === 'practice') {
    return (
      <PracticeResult
        result={result}
        onRematch={onRematch}
        onModeSelect={onModeSelect}
        onTitle={onTitle}
      />
    );
  }

  if (config.mode === 'zombie') {
    return (
      <ZombieResult
        result={result}
        onRematch={onRematch}
        onModeSelect={onModeSelect}
        onTitle={onTitle}
      />
    );
  }

  if (config.mode === 'merge') {
    return (
      <MergeResult
        result={result}
        onRematch={onRematch}
        onModeSelect={onModeSelect}
        onTitle={onTitle}
      />
    );
  }

  // まとあてソロはスコアアタックのリザルト。2人プレイは下の対戦リザルトに流す
  if (gallerySolo) {
    return (
      <GalleryResult
        result={result}
        onRematch={onRematch}
        onModeSelect={onModeSelect}
        onTitle={onTitle}
      />
    );
  }

  const { score1, score2 } = result;
  const p1 = ANIMALS[config.p1Animal];
  const p2 = ANIMALS[config.p2Animal];
  const isRobot = config.mode === 'robot' || config.mode === 'robotSurvival';
  const isSurvival = config.mode === 'survival' || config.mode === 'robotSurvival';
  const isVsCpu =
    config.mode === 'vsCpu' ||
    isSurvival ||
    (config.mode === 'robot' && !!config.cpuLevel);
  const winnerTeam: PlayerId | null = score1 === score2 ? null : score1 > score2 ? 1 : 2;
  // サバイバル: 負けた相手のレベルと、それまでの勝ち抜き数
  const cpuLevelForText = isSurvival ? survivalLevel(config.survivalStage ?? 1) : (config.cpuLevel ?? 'turtle');
  const survivalWins = (config.survivalStage ?? 1) - 1;

  // 勝敗メッセージ(CPU対戦は「きみ」目線で表示)
  let winnerText: string;
  let winnerColor: string;
  if (winnerTeam === null) {
    winnerText = '引き分け!';
    winnerColor = '#FFF9C4';
  } else if (winnerTeam === 1) {
    winnerText = isVsCpu ? 'きみの勝ち! 🏆' : `${p1.nameJa}(赤)の勝ち!`;
    winnerColor = COLORS.p1;
  } else {
    winnerText = isVsCpu
      ? `${CPU_LEVEL_INFO[cpuLevelForText].nameJa}の勝ち…`
      : `${p2.nameJa}(白)の勝ち!`;
    winnerColor = '#fff';
  }

  const body = (
    <View style={styles.body}>
      <WinnerShow
        winnerTeam={winnerTeam}
        p1Animal={config.p1Animal}
        p2Animal={config.p2Animal}
        t={t}
      />
      {isSurvival && (
        <Text style={styles.survivalCount}>🏆 {survivalWins}人 勝ち抜き!</Text>
      )}
      <Text style={[styles.winner, { color: winnerColor }]}>{winnerText}</Text>
      {isRobot && <Text style={styles.hpLabel}>のこりHP</Text>}
      <Text style={styles.scoreText}>
        <Text style={{ color: COLORS.p1 }}>
          {p1.emoji} {score1}
        </Text>
        <Text style={{ color: '#F1F8E9' }}> - </Text>
        <Text style={{ color: '#fff' }}>
          {score2} {p2.emoji}
        </Text>
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 勝者がいるときは紙吹雪(全画面) */}
      {winnerTeam !== null && <Confetti width={width} height={height} t={t} />}

      {/* 上側プレイヤー用(2人対戦のときだけ180°回転コピー) */}
      <View style={[styles.half, isVsCpu ? null : styles.flipped]}>{body}</View>
      {/* 下側プレイヤー用 */}
      <View style={styles.half}>
        {body}
        <Buttons onRematch={onRematch} onModeSelect={onModeSelect} onTitle={onTitle} />
      </View>
    </View>
  );
}

// 勝者はジャンプ+王冠、ひきわけは2匹並んで表示
function WinnerShow({
  winnerTeam,
  p1Animal,
  p2Animal,
  t,
}: {
  winnerTeam: PlayerId | null;
  p1Animal: AnimalId;
  p2Animal: AnimalId;
  t: number;
}) {
  // reactTを0→REACT_DURATIONでループさせて何度も喜びジャンプさせる
  const loopReact = REACT_DURATION * ((t * 1.1) % 1);
  if (winnerTeam === null) {
    return (
      <Canvas style={styles.winnerCanvas}>
        <AnimalFigure animal={p1Animal} x={62} y={82} dir={1} scale={0.72} t={t} team={1} />
        <AnimalFigure animal={p2Animal} x={138} y={82} dir={-1} scale={0.72} t={t + 0.5} team={2} />
      </Canvas>
    );
  }
  const animal = winnerTeam === 1 ? p1Animal : p2Animal;
  return (
    <Canvas style={styles.winnerCanvas}>
      <AnimalFigure
        animal={animal}
        x={100}
        y={86}
        dir={1}
        scale={0.95}
        t={t}
        reactT={loopReact}
        team={winnerTeam}
        crowned
      />
    </Canvas>
  );
}

const CONFETTI_COLORS = ['#E53935', '#FFB300', '#43A047', '#1E88E5', '#F48FB1', '#FFF176'];

// ひらひら落ちる紙吹雪(全画面Canvas、生成は1回だけ)
function Confetti({ width, height, t }: { width: number; height: number; t: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: (i * 61.7) % width,
        phase: ((i * 37.3) % 100) / 100,
        speed: 60 + ((i * 23) % 60),
        size: 5 + ((i * 13) % 5),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: 1 + ((i * 7) % 5) * 0.6,
      })),
    [width],
  );
  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {pieces.map((p, i) => {
        const y = ((p.phase * (height + 60) + t * p.speed) % (height + 60)) - 30;
        const x = p.x + Math.sin(t * 1.6 + p.phase * 12) * 22;
        return (
          <Group key={i} origin={vec(x + p.size / 2, y + p.size / 2)} transform={[{ rotate: t * p.rot + p.phase * 6 }]}>
            <RoundedRect x={x} y={y} width={p.size} height={p.size * 0.66} r={1.5} color={p.color} opacity={0.85} />
          </Group>
        );
      })}
    </Canvas>
  );
}

// 練習モードのリザルト: 勝敗なしで成績を表示
function PracticeResult({
  result,
  onRematch,
  onModeSelect,
  onTitle,
}: {
  result: GameResult;
  onRematch: () => void;
  onModeSelect: () => void;
  onTitle: () => void;
}) {
  const rate = result.shots1 > 0 ? Math.round((result.score1 / result.shots1) * 100) : 0;
  return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.practiceTitle}>練習おつかれさま!</Text>
      <View style={styles.statsCard}>
        <StatRow label="エサやり" value={`${result.score1}`} />
        <StatRow label="投げた数" value={`${result.shots1}`} />
        <StatRow label="成功率" value={`${rate}%`} />
      </View>
      <Buttons onRematch={onRematch} onModeSelect={onModeSelect} onTitle={onTitle} />
    </View>
  );
}

// ゾンビサバイバルのリザルト: 到達ウェーブと撃退数
function ZombieResult({
  result,
  onRematch,
  onModeSelect,
  onTitle,
}: {
  result: GameResult;
  onRematch: () => void;
  onModeSelect: () => void;
  onTitle: () => void;
}) {
  return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.practiceTitle}>🧟 ゾンビサバイバル!</Text>
      <View style={styles.statsCard}>
        <StatRow label="ウェーブ" value={`${result.wave ?? 1}`} />
        <StatRow label="倒した数" value={`${result.defeated ?? 0}匹`} />
        <StatRow label="投げたエサ" value={`${result.shots1 + result.shots2}`} />
      </View>
      <Buttons onRematch={onRematch} onModeSelect={onModeSelect} onTitle={onTitle} />
    </View>
  );
}

// まとあて射的(ソロ)のリザルト: スコアと命中の成績
function GalleryResult({
  result,
  onRematch,
  onModeSelect,
  onTitle,
}: {
  result: GameResult;
  onRematch: () => void;
  onModeSelect: () => void;
  onTitle: () => void;
}) {
  const hits = result.defeated ?? 0;
  const rate = result.shots1 > 0 ? Math.round((hits / result.shots1) * 100) : 0;
  return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.practiceTitle}>🎯 まとあて射的!</Text>
      <View style={styles.statsCard}>
        <StatRow label="スコア" value={`${result.score1}点`} />
        <StatRow label="当てたまと" value={`${hits}`} />
        <StatRow label="投げたエサ" value={`${result.shots1}`} />
        <StatRow label="命中率" value={`${rate}%`} />
      </View>
      <Buttons onRematch={onRematch} onModeSelect={onModeSelect} onTitle={onTitle} />
    </View>
  );
}

// どうぶつマージのリザルト: スコアと進化の記録
function MergeResult({
  result,
  onRematch,
  onModeSelect,
  onTitle,
}: {
  result: GameResult;
  onRematch: () => void;
  onModeSelect: () => void;
  onTitle: () => void;
}) {
  const best = ANIMALS[result.bestAnimal ?? 'dog'];
  return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.practiceTitle}>🧩 どうぶつマージ!</Text>
      <View style={styles.statsCard}>
        <StatRow label="スコア" value={`${result.score1}`} />
        <StatRow label="いちばん進化" value={`${best.emoji} ${best.nameJa}`} />
        <StatRow label="らいおん消し" value={`${result.lions ?? 0}回`} />
        <StatRow label="ゾンビ退治" value={`${result.defeated ?? 0}匹`} />
        <StatRow label="おとした数" value={`${result.shots1}`} />
      </View>
      <Buttons onRematch={onRematch} onModeSelect={onModeSelect} onTitle={onTitle} />
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Buttons({
  onRematch,
  onModeSelect,
  onTitle,
}: {
  onRematch: () => void;
  onModeSelect: () => void;
  onTitle: () => void;
}) {
  return (
    <View style={styles.buttons}>
      <JuicyButton label="もう一回!" color={COLORS.p1} onPress={onRematch} style={styles.smallButton} textStyle={styles.smallButtonText} />
      <JuicyButton label="モード選択" color="#546E7A" onPress={onModeSelect} style={styles.smallButton} textStyle={styles.smallButtonText} />
      <JuicyButton label="タイトルへ" color="#546E7A" onPress={onTitle} style={styles.smallButton} textStyle={styles.smallButtonText} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.fieldP1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flipped: { transform: [{ rotate: '180deg' }] },
  body: { alignItems: 'center' },
  winnerCanvas: { width: 200, height: 120 },
  hpLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F1F8E9',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
    marginBottom: 2,
  },
  survivalCount: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFEB3B',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 6,
    marginBottom: 4,
  },
  winner: {
    fontSize: 32,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 6,
    marginBottom: 10,
    textAlign: 'center',
  },
  scoreText: {
    fontSize: 30,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 24 },
  smallButton: { paddingHorizontal: 18, paddingVertical: 12 },
  smallButtonText: { fontSize: 15 },
  practiceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 6,
    marginBottom: 20,
  },
  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 18,
    width: '100%',
    maxWidth: 320,
    gap: 10,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 18, color: '#F1F8E9', fontWeight: 'bold' },
  statValue: { fontSize: 24, color: '#FFEB3B', fontWeight: 'bold' },
});
