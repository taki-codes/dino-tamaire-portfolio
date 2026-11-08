import { useEffect, useState } from 'react';

// requestAnimationFrameで進む秒カウンタ。
// タイトルやリザルトなど、ゲームループ外の画面でSkiaアニメを動かすために使う
export function useRafClock(): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}
