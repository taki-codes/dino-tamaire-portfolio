import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { isMuted, toggleMuted } from '../audio/sound';

// 🔊/🔇 切り替えボタン。ミュート状態はsound.tsのシングルトンが持つ
export function MuteButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const [muted, setMuted] = useState(isMuted());
  return (
    <Pressable
      style={[styles.button, style]}
      onPress={() => setMuted(toggleMuted())}
      hitSlop={8}
    >
      <Text style={styles.icon}>{muted ? '🔇' : '🔊'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
});
