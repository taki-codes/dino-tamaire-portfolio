import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// RAFループや任意の場所から呼べるように、hookではなくシングルトンで管理する

export type Sfx =
  | 'launch'
  | 'goal'
  | 'count'
  | 'go'
  | 'win'
  | 'draw'
  | 'click'
  | 'special'
  | 'alarm'
  | 'crash';

const SFX_SOURCES: Record<Sfx, number> = {
  launch: require('../../assets/audio/launch.wav'),
  goal: require('../../assets/audio/goal.wav'),
  count: require('../../assets/audio/count.wav'),
  go: require('../../assets/audio/go.wav'),
  win: require('../../assets/audio/win.wav'),
  draw: require('../../assets/audio/draw.wav'),
  click: require('../../assets/audio/click.wav'),
  special: require('../../assets/audio/special.wav'),
  alarm: require('../../assets/audio/alarm.wav'),
  crash: require('../../assets/audio/crash.wav'),
};

const players = new Map<Sfx, AudioPlayer>();
let bgm: AudioPlayer | null = null;
let muted = false;
let inited = false;

// アプリ起動時に一度だけ呼ぶ。プレイヤーを事前生成して再生遅延をなくす
export async function initAudio(): Promise<void> {
  if (inited) return;
  inited = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
    for (const key of Object.keys(SFX_SOURCES) as Sfx[]) {
      players.set(key, createAudioPlayer(SFX_SOURCES[key]));
    }
    bgm = createAudioPlayer(require('../../assets/audio/bgm.wav'));
    bgm.loop = true;
    bgm.volume = 0.32;
  } catch {
    // 音が出なくてもゲームは続行できるようにする
  }
}

export function playSfx(sfx: Sfx): void {
  if (muted) return;
  const p = players.get(sfx);
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {}
}

export function startBgm(): void {
  if (muted || !bgm) return;
  try {
    bgm.seekTo(0);
    bgm.play();
  } catch {}
}

// ポーズ解除用: 曲の途中から再開する(startBgmは頭出しする)
export function resumeBgm(): void {
  if (muted || !bgm) return;
  try {
    bgm.play();
  } catch {}
}

export function stopBgm(): void {
  try {
    bgm?.pause();
  } catch {}
}

export function toggleMuted(): boolean {
  muted = !muted;
  if (muted) stopBgm();
  return muted;
}

export function isMuted(): boolean {
  return muted;
}
