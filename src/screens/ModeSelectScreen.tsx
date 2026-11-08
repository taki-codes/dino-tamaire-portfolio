import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CPU_LEVELS, CPU_LEVEL_INFO } from '../characters';
import { COLORS } from '../constants';
import { CpuLevel, GameMode } from '../types';

interface ModeSelectScreenProps {
  onSelect: (mode: GameMode, cpuLevel?: CpuLevel, players?: 1 | 2) => void;
  onBack: () => void;
}

// あそびかた選択: 2人対戦 / CPU対戦(レベル選択つき) / サバイバル / ゾンビ / まとあて / マージ / 練習
export function ModeSelectScreen({ onSelect, onBack }: ModeSelectScreenProps) {
  const [cpuOpen, setCpuOpen] = useState(false);
  const [zombieOpen, setZombieOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [robotOpen, setRobotOpen] = useState(false);

  return (
    // モードが増えて小さい画面では収まらないことがあるのでスクロールできるようにする
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} bounces={false}>
      <Text style={styles.title}>遊び方を選ぶ</Text>

      <Pressable style={styles.card} onPress={() => onSelect('vs2p')}>
        <Text style={styles.cardEmoji}>🤝</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>二人でバトル</Text>
          <Text style={styles.cardDesc}>スマホを2人の間に置いて対戦!</Text>
        </View>
      </Pressable>

      <Pressable
        style={[styles.card, cpuOpen && styles.cardOpen]}
        onPress={() => setCpuOpen((o) => !o)}
      >
        <Text style={styles.cardEmoji}>🤖</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>コンピューターとバトル</Text>
          <Text style={styles.cardDesc}>強さを選んでね</Text>
        </View>
      </Pressable>
      {cpuOpen && (
        <View style={styles.levelRow}>
          {CPU_LEVELS.map((level) => {
            const info = CPU_LEVEL_INFO[level];
            return (
              <Pressable
                key={level}
                style={styles.levelCard}
                onPress={() => onSelect('vsCpu', level)}
              >
                <Text style={styles.levelEmoji}>{info.emoji}</Text>
                <Text style={styles.levelName}>{info.nameJa}</Text>
                <Text style={styles.levelDesc}>{info.desc}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable style={styles.card} onPress={() => onSelect('survival')}>
        <Text style={styles.cardEmoji}>🏆</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>勝ち抜きサバイバル</Text>
          <Text style={styles.cardDesc}>1試合30秒! 強くなる相手に何人勝てるかな?</Text>
        </View>
      </Pressable>

      <Pressable
        style={[styles.card, zombieOpen && styles.cardOpen]}
        onPress={() => setZombieOpen((o) => !o)}
      >
        <Text style={styles.cardEmoji}>🧟</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>ゾンビサバイバル</Text>
          <Text style={styles.cardDesc}>おなかすき軍団を エサでやっつけろ!</Text>
        </View>
      </Pressable>
      {zombieOpen && (
        <View style={styles.levelRow}>
          <Pressable style={styles.levelCard} onPress={() => onSelect('zombie', undefined, 1)}>
            <Text style={styles.levelEmoji}>🧍</Text>
            <Text style={styles.levelName}>一人で</Text>
            <Text style={styles.levelDesc}>ソロで生き残れ</Text>
          </Pressable>
          <Pressable style={styles.levelCard} onPress={() => onSelect('zombie', undefined, 2)}>
            <Text style={styles.levelEmoji}>👫</Text>
            <Text style={styles.levelName}>二人で</Text>
            <Text style={styles.levelDesc}>協力プレイ</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.card, galleryOpen && styles.cardOpen]}
        onPress={() => setGalleryOpen((o) => !o)}
      >
        <Text style={styles.cardEmoji}>🎯</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>まとあて射的</Text>
          <Text style={styles.cardDesc}>動物が持つ「まと」だけを撃て! 動物に当てちゃダメ!</Text>
        </View>
      </Pressable>
      {galleryOpen && (
        <View style={styles.levelRow}>
          <Pressable style={styles.levelCard} onPress={() => onSelect('gallery', undefined, 1)}>
            <Text style={styles.levelEmoji}>🧍</Text>
            <Text style={styles.levelName}>一人で</Text>
            <Text style={styles.levelDesc}>スコアアタック</Text>
          </Pressable>
          <Pressable style={styles.levelCard} onPress={() => onSelect('gallery', undefined, 2)}>
            <Text style={styles.levelEmoji}>👫</Text>
            <Text style={styles.levelName}>二人で</Text>
            <Text style={styles.levelDesc}>点数で対決!</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.card, robotOpen && styles.cardOpen]}
        onPress={() => setRobotOpen((o) => !o)}
      >
        <Text style={styles.cardEmoji}>🥊</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>闘魂ロボットバトル</Text>
          <Text style={styles.cardDesc}>パネルをビーダマで撃って ロボットに攻撃させろ!</Text>
        </View>
      </Pressable>
      {robotOpen && (
        <>
          <View style={styles.levelRow}>
            <Pressable style={styles.levelCard} onPress={() => onSelect('robot', undefined, 2)}>
              <Text style={styles.levelEmoji}>👫</Text>
              <Text style={styles.levelName}>二人で</Text>
              <Text style={styles.levelDesc}>ロボで対決!</Text>
            </Pressable>
            <Pressable style={styles.levelCard} onPress={() => onSelect('robotSurvival', undefined, 1)}>
              <Text style={styles.levelEmoji}>🏆</Text>
              <Text style={styles.levelName}>勝ち抜き</Text>
              <Text style={styles.levelDesc}>何人倒せるかな?</Text>
            </Pressable>
          </View>
          <Text style={styles.subHeader}>🤖 コンピューターと対戦(強さを選ぶ)</Text>
          <View style={styles.levelRow}>
            {CPU_LEVELS.map((level) => {
              const info = CPU_LEVEL_INFO[level];
              return (
                <Pressable
                  key={level}
                  style={styles.levelCard}
                  onPress={() => onSelect('robot', level, 1)}
                >
                  <Text style={styles.levelEmoji}>{info.emoji}</Text>
                  <Text style={styles.levelName}>{info.nameJa}</Text>
                  <Text style={styles.levelDesc}>{info.desc}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Pressable style={styles.card} onPress={() => onSelect('merge')}>
        <Text style={styles.cardEmoji}>🧩</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>どうぶつマージ</Text>
          <Text style={styles.cardDesc}>同じ動物を合体させて らいおんを作ろう!</Text>
        </View>
      </Pressable>

      <Pressable style={styles.card} onPress={() => onSelect('practice')}>
        <Text style={styles.cardEmoji}>🎯</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>一人で練習</Text>
          <Text style={styles.cardDesc}>時間を気にせず エサやりしよう</Text>
        </View>
      </Pressable>

      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>← タイトルへ</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.uiBg },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 6,
    marginBottom: 28,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.uiCard,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 14,
    width: '100%',
    maxWidth: 420,
  },
  cardOpen: { backgroundColor: COLORS.uiCardActive },
  cardEmoji: { fontSize: 36, marginRight: 16 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  cardDesc: { fontSize: 13, color: '#DCEDC8', marginTop: 2 },
  levelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    width: '100%',
    maxWidth: 420,
  },
  subHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#DCEDC8',
    alignSelf: 'flex-start',
    marginBottom: 6,
    width: '100%',
    maxWidth: 420,
  },
  levelCard: {
    flex: 1,
    backgroundColor: COLORS.uiCard,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  levelEmoji: { fontSize: 30 },
  levelName: { fontSize: 12, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  levelDesc: { fontSize: 11, color: '#DCEDC8', marginTop: 2 },
  backButton: { marginTop: 18, padding: 10 },
  backText: { fontSize: 16, color: '#DCEDC8', fontWeight: 'bold' },
});
