import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playSfx } from '../audio/sound';
import { COLORS } from '../constants';
import { ControlType } from '../settings';

const OPTIONS: { type: ControlType; emoji: string; name: string; desc: string }[] = [
  {
    type: 'drag',
    emoji: '👆',
    name: '引っぱり',
    desc: '指で引っぱって、離すとエサが飛ぶ',
  },
  {
    type: 'button',
    emoji: '🔘',
    name: 'ボタン',
    desc: 'ねらいが左右に動く。ボタンを押して発射!',
  },
];

// 発射操作(ひっぱり/ボタン)の切り替え。説明つきカードで違いが分かるように
export function ControlToggle({
  control,
  onChange,
}: {
  control: ControlType;
  onChange: (c: ControlType) => void;
}) {
  return (
    <View style={styles.list}>
      {OPTIONS.map((o) => {
        const active = control === o.type;
        return (
          <Pressable
            key={o.type}
            style={[styles.card, active && styles.cardActive]}
            onPress={() => {
              playSfx('click');
              onChange(o.type);
            }}
          >
            <Text style={styles.emoji}>{o.emoji}</Text>
            <View style={styles.body}>
              <Text style={[styles.name, active && styles.nameActive]}>{o.name}</Text>
              <Text style={[styles.desc, active && styles.descActive]}>{o.desc}</Text>
            </View>
            {active && <Text style={styles.check}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, alignSelf: 'stretch' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.uiCard,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardActive: { backgroundColor: COLORS.uiAccent, borderColor: '#FFF9C4' },
  emoji: { fontSize: 24, marginRight: 10 },
  body: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  nameActive: { color: '#4E342E' },
  desc: { fontSize: 12, color: '#DCEDC8', marginTop: 2 },
  descActive: { color: '#5D4037' },
  check: { fontSize: 20, fontWeight: 'bold', color: '#4E342E', marginLeft: 8 },
});
