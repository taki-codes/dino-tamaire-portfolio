import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { playSfx } from '../audio/sound';
import { COLORS } from '../constants';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface JuicyButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// 押すとスプリングで縮む、全メニュー共通のボタン
export function JuicyButton({ label, onPress, color = COLORS.uiAccent, disabled, style, textStyle }: JuicyButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={[styles.button, { backgroundColor: color }, style, animatedStyle]}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.92, { damping: 14, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 260 });
      }}
      onPress={() => {
        playSfx('click');
        onPress();
      }}
    >
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  text: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
});
