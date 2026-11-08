import { Canvas } from '@shopify/react-native-skia';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ANIMALS, ANIMAL_IDS, CPU_LEVEL_INFO } from '../characters';
import { JuicyButton } from '../components/JuicyButton';
import { AnimalFigure } from '../render/Animal';
import { COLORS } from '../constants';
import { AnimalId, CpuLevel, GameMode, PlayerId } from '../types';

interface CharacterSelectScreenProps {
  mode: GameMode;
  cpuLevel?: CpuLevel;
  players?: 1 | 2;
  onConfirm: (p1Animal: AnimalId, p2Animal: AnimalId) => void;
  onBack: () => void;
}

// キャラ選択。2人プレイのモードは上下分割(上は180°回転)、それ以外は下側プレイヤーのみ
export function CharacterSelectScreen({
  mode,
  cpuLevel,
  players,
  onConfirm,
  onBack,
}: CharacterSelectScreenProps) {
  const [sel, setSel] = useState<Record<PlayerId, AnimalId>>({ 1: 'dog', 2: 'cat' });
  const [confirmed, setConfirmed] = useState<Record<PlayerId, boolean>>({ 1: false, 2: false });

  // 上下2つのピッカーを出すモード(2人対戦・ゾンビ協力・まとあて2人・ロボット2人)
  const twoPickers =
    mode === 'vs2p' ||
    ((mode === 'zombie' || mode === 'gallery' || mode === 'robot') && players === 2);

  // サバイバルの最初の相手はかめレベル(勝ち抜くたびApp側で差し替わる)
  const cpuInfo =
    mode === 'survival' || mode === 'robotSurvival'
      ? CPU_LEVEL_INFO.turtle
      : (mode === 'vsCpu' || mode === 'robot') && cpuLevel
        ? CPU_LEVEL_INFO[cpuLevel]
        : null;

  const confirm = (owner: PlayerId) => {
    const next = { ...confirmed, [owner]: true };
    setConfirmed(next);
    const bothReady = twoPickers ? next[1] && next[2] : next[1];
    if (bothReady) {
      const p2 = twoPickers ? sel[2] : cpuInfo ? cpuInfo.animal : sel[1];
      onConfirm(sel[1], p2);
    }
  };

  return (
    <View style={styles.container}>
      {/* 上半分: 2人プレイならP2のピッカー(回転)、CPU対戦なら相手紹介 */}
      {twoPickers ? (
        <View style={[styles.half, styles.flipped]}>
          <PickerPane
            owner={2}
            sel={sel[2]}
            confirmed={confirmed[2]}
            onSelect={(a) => setSel((s) => ({ ...s, 2: a }))}
            onConfirm={() => confirm(2)}
          />
        </View>
      ) : cpuInfo ? (
        <View style={styles.half}>
          <Canvas style={styles.cpuCanvas}>
            <AnimalFigure animal={cpuInfo.animal} x={70} y={64} dir={1} scale={1.05} team={2} />
          </Canvas>
          <Text style={styles.cpuText}>
            {mode === 'survival' || mode === 'robotSurvival'
              ? `サバイバル! まずは ${cpuInfo.nameJa}!`
              : `あいては ${cpuInfo.nameJa}! (${cpuInfo.desc})`}
          </Text>
        </View>
      ) : mode === 'zombie' ? (
        <View style={styles.half}>
          <Text style={styles.cpuEmoji}>🧟</Text>
          <Text style={styles.cpuText}>おなかすき軍団が攻めてくる!</Text>
        </View>
      ) : mode === 'gallery' ? (
        <View style={styles.half}>
          <Text style={styles.cpuEmoji}>🎯</Text>
          <Text style={styles.cpuText}>「まと」にエサを当てろ! 動物はダメ!</Text>
        </View>
      ) : (
        <View style={styles.half}>
          <Text style={styles.cpuEmoji}>🎯</Text>
          <Text style={styles.cpuText}>練習モード</Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* 下半分: P1のピッカー */}
      <View style={styles.half}>
        <PickerPane
          owner={1}
          sel={sel[1]}
          confirmed={confirmed[1]}
          onSelect={(a) => setSel((s) => ({ ...s, 1: a }))}
          onConfirm={() => confirm(1)}
        />
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
          <Text style={styles.backText}>← 戻る</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PickerPane({
  owner,
  sel,
  confirmed,
  onSelect,
  onConfirm,
}: {
  owner: PlayerId;
  sel: AnimalId;
  confirmed: boolean;
  onSelect: (a: AnimalId) => void;
  onConfirm: () => void;
}) {
  const teamColor = owner === 1 ? COLORS.p1 : COLORS.p2;
  const teamName = owner === 1 ? '赤' : '白';
  return (
    <View style={styles.pane}>
      <Text style={[styles.paneTitle, { color: teamColor }]}>
        {teamName}チームの動物を選ぶ
      </Text>
      <View style={styles.grid}>
        {ANIMAL_IDS.map((id) => {
          const spec = ANIMALS[id];
          const active = sel === id;
          return (
            <Pressable
              key={id}
              style={[styles.animalCard, active && styles.animalCardActive]}
              disabled={confirmed}
              onPress={() => onSelect(id)}
            >
              <AnimalPreview animal={id} />
              <Text style={styles.animalName}>{spec.nameJa}</Text>
            </Pressable>
          );
        })}
      </View>
      <JuicyButton
        label={confirmed ? 'まってるよ…' : '決定!'}
        color={confirmed ? '#78909C' : COLORS.uiAccent}
        disabled={confirmed}
        onPress={onConfirm}
        style={styles.confirmButton}
      />
    </View>
  );
}

// ゲーム内と同じSkia描画でキャラをプレビュー
function AnimalPreview({ animal }: { animal: AnimalId }) {
  return (
    <Canvas style={styles.animalCanvas}>
      <AnimalFigure animal={animal} x={34} y={32} dir={1} scale={0.52} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.uiBg },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  flipped: { transform: [{ rotate: '180deg' }] },
  divider: { height: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  pane: { alignItems: 'center' },
  paneTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 344, // 7匹を4+3の2行に収める
  },
  animalCard: {
    width: 80,
    alignItems: 'center',
    backgroundColor: COLORS.uiCard,
    borderRadius: 14,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  animalCardActive: {
    backgroundColor: COLORS.uiCardActive,
    borderColor: COLORS.uiAccent,
  },
  animalCanvas: { width: 68, height: 54 },
  animalName: { fontSize: 12, fontWeight: 'bold', color: '#fff', marginTop: 2 },
  confirmButton: { marginTop: 12, paddingHorizontal: 36, paddingVertical: 12 },
  cpuEmoji: { fontSize: 64 },
  cpuCanvas: { width: 140, height: 108 },
  cpuText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  backButton: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 16 },
  backText: { fontSize: 15, color: '#DCEDC8', fontWeight: 'bold' },
});
