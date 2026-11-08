import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants';
import { BATTLE_RULES, RULE_INFO } from '../game/rules';
import { BattleRule } from '../types';

interface RuleSelectScreenProps {
  rules?: BattleRule[]; // 選べるルール(省略時は全部。ゾンビはアイテムモードなし)
  onSelect: (rule: BattleRule) => void;
  onBack: () => void;
}

// バトルルール選択: ふつう / れんしゃ / ギミック / アイテム
export function RuleSelectScreen({ rules = BATTLE_RULES, onSelect, onBack }: RuleSelectScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ルールを選ぶ</Text>

      {rules.map((rule) => {
        const info = RULE_INFO[rule];
        return (
          <Pressable key={rule} style={styles.card} onPress={() => onSelect(rule)}>
            <Text style={styles.cardEmoji}>{info.emoji}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{info.nameJa}</Text>
              <Text style={styles.cardDesc}>{info.desc}</Text>
            </View>
          </Pressable>
        );
      })}

      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>← 戻る</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.uiBg,
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
  cardEmoji: { fontSize: 36, marginRight: 16 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  cardDesc: { fontSize: 13, color: '#DCEDC8', marginTop: 2 },
  backButton: { marginTop: 18, padding: 10 },
  backText: { fontSize: 16, color: '#DCEDC8', fontWeight: 'bold' },
});
