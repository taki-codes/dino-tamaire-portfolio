import { Circle, Group } from '@shopify/react-native-skia';
import React from 'react';
import { Particle } from '../types';

// ゴール時に飛び散るパーティクルの描画
export function Particles({ particles }: { particles: Particle[] }) {
  return (
    <Group>
      {particles.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.size * Math.max(0.2, 1 - p.age / p.life)}
          color={p.color}
          opacity={Math.max(0, 1 - p.age / p.life)}
        />
      ))}
    </Group>
  );
}
