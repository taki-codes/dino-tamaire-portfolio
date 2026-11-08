import { Canvas, Group } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { playSfx, resumeBgm, startBgm, stopBgm } from '../audio/sound';
import { ANIMALS, CPU_LEVEL_INFO } from '../characters';
import { ControlToggle } from '../components/ControlToggle';
import { JuicyButton } from '../components/JuicyButton';
import { MuteButton } from '../components/MuteButton';
import {
  BUTTON_MANUAL_SENS,
  COLORS,
  ITEM_LIFETIME,
  SHAKE_DURATION,
  SPECIAL_DURATION,
  ZOMBIE_GRAVITY_SCALE,
} from '../constants';
import { survivalLevel } from '../game/cpu';
import { buttonAngleToAim, createLayout, isBossWave, zombieWaveCount } from '../game/physics';
import { ITEM_INFO, RULE_INFO } from '../game/rules';
import { SPECIAL_INFO, SPECIAL_INFO_GALLERY, SPECIAL_INFO_ZOMBIE } from '../game/specials';
import { useGameLoop } from '../game/useGameLoop';
import { Background } from '../render/Background';
import { Balls, ScorePops } from '../render/Balls';
import { Animals } from '../render/Animals';
import { Particles } from '../render/Effects';
import { GalleryWalkers } from '../render/GalleryWalkers';
import { Launcher } from '../render/Launcher';
import { Logs } from '../render/Logs';
import { Zombies } from '../render/Zombies';
import { ControlType, getControlType, setControlType } from '../settings';
import { Aim, FieldItem, GameConfig, GameResult, ItemKind, Notice, PlayerId } from '../types';

interface GameScreenProps {
  config: GameConfig;
  onEnd: (result: GameResult) => void;
}

export function GameScreen({ config, onEnd }: GameScreenProps) {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => createLayout(width, height), [width, height]);
  const { mode, rule } = config;
  const isVs2p = mode === 'vs2p';
  const isCpu = mode === 'vsCpu' || mode === 'survival';
  const isZombie = mode === 'zombie';
  const isGallery = mode === 'gallery';
  const coop = (isZombie || isGallery) && config.players === 2;
  // 上半分を操作する人間プレイヤーがいるか(2人対戦・ゾンビ協力・まとあて2人)
  const hasP2 = isVs2p || coop;
  const isPractice = mode === 'practice';

  // 開始前のカウントダウン(練習は「スタート!」1回だけ)
  const [countdown, setCountdown] = useState(isPractice ? 1 : 3);
  // ポーズ(⚙️): メニューを開いている間はゲームを止める
  const [paused, setPaused] = useState(false);
  // 発射操作(ひっぱり/ボタン)。ポーズメニューから切り替えられる
  const [control, setControl] = useState<ControlType>(getControlType());
  const running = countdown === 0;
  useEffect(() => {
    if (countdown === 0) {
      playSfx('go');
      startBgm();
      return;
    }
    playSfx('count');
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [countdown]);

  const {
    state,
    fire,
    fireButton,
    canFire,
    activate,
    useItem,
    useUltra,
    endNow,
    reset,
    buttonAims,
    setButtonAngle,
    cpuAim,
    mods1,
    mods2,
  } = useGameLoop({
    layout,
    running: running && !paused,
    config,
    control,
    onEnd,
  });

  // ドラッグ中の照準(毎フレームの再レンダリングで描画されるためrefで保持)
  const aimRef = useRef<Record<PlayerId, Aim | null>>({ 1: null, 2: null });
  // ボタンモードの手動照準: ドラッグ開始時の角度
  const aimStartRef = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });

  const makePan = (owner: PlayerId) =>
    Gesture.Pan()
      .runOnJS(true)
      .maxPointers(1)
      .onUpdate((e) => {
        // 撃てないあいだ(クールダウン・こおり中)はゴム紐を引けない。
        // ドラッグ中に撃てるようになった瞬間からゴム紐が現れる
        if (canFire(owner)) {
          aimRef.current[owner] = { dx: e.translationX, dy: e.translationY };
        } else {
          aimRef.current[owner] = null;
        }
      })
      .onEnd(() => {
        const aim = aimRef.current[owner];
        aimRef.current[owner] = null;
        if (aim && running) fire(owner, aim);
      })
      .onFinalize(() => {
        aimRef.current[owner] = null;
      });

  // ボタンモード: 左右ドラッグで照準を手動調整(触っている間はスイングが止まる)
  const makeAimPan = (owner: PlayerId) =>
    Gesture.Pan()
      .runOnJS(true)
      .maxPointers(1)
      .onBegin(() => {
        aimStartRef.current[owner] = buttonAims[owner].angle;
      })
      .onUpdate((e) => {
        // P2は180°回転して見ているので左右を反転する
        const sign = owner === 2 ? -1 : 1;
        setButtonAngle(owner, aimStartRef.current[owner] + e.translationX * BUTTON_MANUAL_SENS * sign, true);
      })
      .onFinalize(() => {
        setButtonAngle(owner, buttonAims[owner].angle, false);
      });

  const [pan1, pan2] = useMemo(() => {
    const maker = control === 'drag' ? makePan : makeAimPan;
    const p1 = maker(1);
    const p2 = maker(2);
    // 2人が同時にドラッグできるように相互許可
    p1.simultaneousWithExternalGesture(p2);
    p2.simultaneousWithExternalGesture(p1);
    return [p1, p2];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, running, control]);

  const half = layout.centerY;
  // 各プレイヤーの照準: ボタンモードはスイング中の角度、ひっぱりはドラッグ中のベクトル
  const p1Aim = control === 'button' ? buttonAngleToAim(1, buttonAims[1].angle) : aimRef.current[1];
  // 上側の照準: CPU対戦・サバイバルはCPUの引き絞り、2人プレイはP2の照準
  const topAim = isCpu
    ? cpuAim
    : hasP2
      ? control === 'button'
        ? buttonAngleToAim(2, buttonAims[2].angle)
        : aimRef.current[2]
      : null;

  // ゴール時の画面シェイク(減衰するランダム風の揺れ)
  const shakeAmp = (state.shakeT / SHAKE_DURATION) * 5;
  const shakeX = Math.sin(state.elapsed * 87) * shakeAmp;
  const shakeY = Math.cos(state.elapsed * 71) * shakeAmp;

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height }}>
        <Group transform={[{ translateX: shakeX }, { translateY: shakeY }]}>
          <Background width={width} height={height} centerY={half} t={state.elapsed} />
          {rule === 'gimmick' && <Logs layout={layout} elapsed={state.elapsed} />}
          {isZombie ? (
            <Zombies zombies={state.zombies} t={state.elapsed} />
          ) : isGallery ? (
            <GalleryWalkers walkers={state.walkers} t={state.elapsed} />
          ) : (
            <Animals
              mode={mode}
              elapsed={state.elapsed}
              react1={state.react1}
              react2={state.react2}
              carrier1={state.carrier1}
              carrier2={state.carrier2}
              p1Animal={config.p1Animal}
              p2Animal={config.p2Animal}
              scale1={mods1.animalScale}
              scale2={mods2.animalScale}
            />
          )}
          {(hasP2 || isCpu) && (
            <Launcher
              owner={2}
              layout={layout}
              aim={topAim}
              t={state.elapsed}
              velScale={mods2.powerScale * mods2.speedScale}
              ready={canFire(2)}
              gravityScale={isZombie || isGallery ? ZOMBIE_GRAVITY_SCALE : 1}
            />
          )}
          <Launcher
            owner={1}
            layout={layout}
            aim={p1Aim}
            t={state.elapsed}
            velScale={mods1.powerScale * mods1.speedScale}
            ready={canFire(1)}
            gravityScale={isZombie || isGallery ? ZOMBIE_GRAVITY_SCALE : 1}
          />
          <Balls balls={state.balls} />
          <ScorePops pops={state.pops} />
          <Particles particles={state.particles} />
        </Group>
      </Canvas>

      {/* アイテムモード・ゾンビの救世主: フィールドに浮かぶアイテム(絵文字オーバーレイ) */}
      {(rule === 'item' || isZombie) && <ItemLayer items={state.items} elapsed={state.elapsed} />}

      {/* タッチ領域: 下半分はP1、上半分は2人プレイのときだけP2。
          ひっぱり=スリングショット、ボタンモード=左右ドラッグで照準の手動調整 */}
      {hasP2 && (
        <GestureDetector gesture={pan2}>
          <View style={[styles.touchArea, { top: 0, height: half }]} />
        </GestureDetector>
      )}
      <GestureDetector gesture={pan1}>
        <View style={[styles.touchArea, { top: half, height: half }]} />
      </GestureDetector>

      {/* ボタン発射モード: スイングする照準にタイミングを合わせて「はっしゃ!」 */}
      {control === 'button' && (
        <>
          <FireButton
            flip={false}
            top={height - 150}
            right={false}
            disabled={!canFire(1)}
            onPress={() => running && !paused && fireButton(1)}
          />
          {hasP2 && (
            <FireButton
              flip
              top={106}
              right
              disabled={!canFire(2)}
              onPress={() => running && !paused && fireButton(2)}
            />
          )}
        </>
      )}

      {/* ミュート(中央ラインの右端=どちらの陣地の邪魔にもなりにくい) */}
      <MuteButton style={{ position: 'absolute', right: 8, top: half - 20 }} />

      {/* ポーズ(中央ラインの左端)。開始後だけ */}
      {running && (
        <Pressable
          style={[styles.pauseButton, { top: half - 20 }]}
          hitSlop={8}
          onPress={() => {
            setPaused(true);
            stopBgm();
          }}
        >
          <Text style={styles.pauseIcon}>⚙️</Text>
        </Pressable>
      )}

      {/* HUD */}
      {isPractice ? (
        <PracticeHud
          score={state.score1}
          shots={state.shots1}
          streak={state.streak1}
          height={height}
          onQuit={endNow}
        />
      ) : isZombie ? (
        <ZombieHud
          wave={state.wave}
          hearts={state.hearts}
          defeated={state.defeated}
          remaining={state.zombieQueue + state.zombies.length}
          coop={coop}
          height={height}
        />
      ) : isGallery ? (
        <GalleryHud
          score1={state.score1}
          score2={state.score2}
          timeLeft={state.timeLeft}
          twoP={coop}
          height={height}
        />
      ) : (
        <BattleHud config={config} score1={state.score1} score2={state.score2} timeLeft={state.timeLeft} height={height} />
      )}

      {/* ゾンビ: ウェーブ開始バナー */}
      {isZombie && running && state.waveBannerT > 0 && (
        <>
          <WaveBanner wave={state.wave} top={height * 0.6} flip={false} />
          {coop && <WaveBanner wave={state.wave} top={height * 0.34} flip />}
        </>
      )}

      {/* 必殺技: ゲージ・発動ボタン */}
      <SpecialUi
        owner={1}
        gauge={state.gauge1}
        specialT={state.special1}
        flip={false}
        height={height}
        onActivate={() => activate(1)}
      />
      {hasP2 && (
        <SpecialUi
          owner={2}
          gauge={state.gauge2}
          specialT={state.special2}
          flip
          height={height}
          onActivate={() => activate(2)}
        />
      )}
      {/* 必殺技バナー(2Pでは両陣地にそれぞれの向きで表示) */}
      <SpecialBanners
        mode={mode}
        config={config}
        special1={state.special1}
        special2={state.special2}
        height={height}
      />

      {/* アイテム・救世主の通知(こうげき/やられた/かいふく) */}
      <NoticeText notice={state.notice1} top={height * 0.62} flip={false} />
      <NoticeText notice={state.notice2} top={height * 0.32} flip={hasP2} />

      {/* 手持ちアイテムの「つかう」ボタン(P2は2人対戦のときだけ。CPUは自動で使う) */}
      {rule === 'item' && (
        <>
          <ItemButton held={state.held1} flip={false} top={height - 150} right onUse={() => useItem(1)} />
          {isVs2p && (
            <ItemButton held={state.held2} flip top={106} right={false} onUse={() => useItem(2)} />
          )}
        </>
      )}

      {/* ゾンビ: 一撃必殺ボム(1試合1回、使うと消える) */}
      {isZombie && (
        <>
          {!state.ultra1Used && (
            <UltraButton flip={false} top={height - 150} right onPress={() => running && !paused && useUltra(1)} />
          )}
          {coop && !state.ultra2Used && (
            <UltraButton flip top={106} right={false} onPress={() => running && !paused && useUltra(2)} />
          )}
        </>
      )}

      {/* ポーズメニュー: 操作切替・つづける・はじめから・しあいをおわる */}
      {paused && (
        <PauseMenu
          control={control}
          isPractice={isPractice}
          onControlChange={(c) => {
            setControlType(c);
            setControl(c);
          }}
          onResume={() => {
            setPaused(false);
            resumeBgm();
          }}
          onReplay={() => {
            reset();
            setPaused(false);
            setCountdown(isPractice ? 1 : 3);
          }}
          onQuit={() => {
            setPaused(false);
            endNow(true); // 途中終了(サバイバルでは勝ち扱いにしない)
          }}
        />
      )}

      {/* カウントダウン(数字が変わるたびにズームイン) */}
      {!running && (
        <View style={styles.countdownWrap} pointerEvents="none">
          <Animated.Text
            key={countdown}
            entering={ZoomIn.springify().damping(12)}
            style={[styles.countdownText, isPractice && styles.countdownSmall]}
          >
            {isPractice ? 'スタート!' : countdown}
          </Animated.Text>
          {mode === 'survival' && (
            <Text style={styles.ruleLabel}>
              🏆 {config.survivalStage ?? 1}人目:{' '}
              {CPU_LEVEL_INFO[survivalLevel(config.survivalStage ?? 1)].nameJa}
            </Text>
          )}
          {isZombie && (
            <Text style={styles.ruleLabel}>🧟 ゾンビサバイバル{coop ? '(協力)' : ''}</Text>
          )}
          {isGallery && (
            <Text style={styles.ruleLabel}>🎯 まとあて射的{coop ? '(ふたり)' : ''}</Text>
          )}
          {rule !== 'normal' && (
            <Text style={styles.ruleLabel}>
              {RULE_INFO[rule].emoji} {RULE_INFO[rule].nameJa}
            </Text>
          )}
          {hasP2 && (
            // 回転はenteringを持たない親Viewに付ける(enteringがtransformを上書きするため)
            <View style={styles.flipped}>
              <Animated.Text
                key={`flip-${countdown}`}
                entering={ZoomIn.springify().damping(12)}
                style={styles.countdownText}
              >
                {countdown}
              </Animated.Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// 対戦モードのHUD。上側はvs2Pなら180°回転、CPU対戦なら正位置のまま
function BattleHud({
  config,
  score1,
  score2,
  timeLeft,
  height,
}: {
  config: GameConfig;
  score1: number;
  score2: number;
  timeLeft: number;
  height: number;
}) {
  const time = Math.ceil(timeLeft);
  const hurry = time <= 10; // 残りわずかで赤く目立たせる
  const p1 = ANIMALS[config.p1Animal];
  const p2 = ANIMALS[config.p2Animal];
  const flipTop = config.mode === 'vs2p';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* P2(上側) */}
      <View style={[styles.hudRow, flipTop && styles.flipped, { top: 8 }]}>
        <Animated.Text key={`s2-${score2}`} entering={ZoomIn.springify().damping(14)} style={[styles.score, { color: '#fff' }]}>
          {p2.emoji}{p2.nameJa} {score2}
        </Animated.Text>
        <TimerText time={time} hurry={hurry} />
      </View>
      {/* P1(下側) */}
      <View style={[styles.hudRow, { top: height - 44 }]}>
        <Animated.Text key={`s1-${score1}`} entering={ZoomIn.springify().damping(14)} style={[styles.score, { color: COLORS.p1 }]}>
          {p1.emoji}{p1.nameJa} {score1}
        </Animated.Text>
        <TimerText time={time} hurry={hurry} />
      </View>
    </View>
  );
}

// 必殺技UI: ゲージバー + 満タン時の発動ボタン
function SpecialUi({
  owner,
  gauge,
  specialT,
  flip,
  height,
  onActivate,
}: {
  owner: PlayerId;
  gauge: number;
  specialT: number;
  flip: boolean;
  height: number;
  onActivate: () => void;
}) {
  const teamColor = owner === 1 ? COLORS.p1 : '#fff';
  const ready = gauge >= 1 && specialT <= 0;
  const active = specialT > 0;
  // ゲージ位置: P1はスコア行の上、P2はスコア行の下。
  // 発動ボタンは「はっしゃ!」「つかう」ボタン(height-150/106付近)と重ならない高さに置く
  const barTop = owner === 1 ? height - 56 : 44;
  const buttonTop = owner === 1 ? height - 210 : 164;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* ゲージバー */}
      <View style={[styles.gaugeWrap, flip && styles.flipped, { top: barTop }]} pointerEvents="none">
        <View style={styles.gaugeBg}>
          <View
            style={[
              styles.gaugeFill,
              {
                width: `${Math.round((active ? specialT / SPECIAL_DURATION : gauge) * 100)}%`,
                backgroundColor: active ? '#FFD700' : teamColor,
              },
            ]}
          />
        </View>
      </View>

      {/* 発動ボタン(満タン時のみ存在)。
          回転はenteringを持たない親Viewに付ける(enteringがtransformを上書きするため) */}
      {ready && (
        <View style={[styles.specialButtonWrap, flip && styles.flipped, { top: buttonTop }]}>
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <JuicyButton
              label="必殺技!"
              color="#FF6F00"
              onPress={onActivate}
              style={styles.specialButton}
              textStyle={styles.specialButtonText}
            />
          </Animated.View>
        </View>
      )}

    </View>
  );
}

// 発動バナーの一覧: 発動した本人の陣地の奥にだけ表示する(相手側には出さない)
function SpecialBanners({
  mode,
  config,
  special1,
  special2,
  height,
}: {
  mode: GameConfig['mode'];
  config: GameConfig;
  special1: number;
  special2: number;
  height: number;
}) {
  const actives: { owner: PlayerId; animal: GameConfig['p1Animal']; specialT: number }[] = [];
  if (special1 > 0) actives.push({ owner: 1, animal: config.p1Animal, specialT: special1 });
  if (special2 > 0) actives.push({ owner: 2, animal: config.p2Animal, specialT: special2 });

  return (
    <>
      {actives.map(({ owner, animal, specialT }) => {
        // バナーは発動した本人の陣地の奥(中央ラインから離れた位置)に、本人が読める向きで出す
        // (2人対戦・ゾンビ協力・まとあて2人のP2は上側に180°回転で表示)
        const flip = (mode === 'vs2p' || mode === 'zombie' || mode === 'gallery') && owner === 2;
        const top = owner === 1 ? height * 0.72 : height * 0.14;
        return (
          <SpecialBanner
            key={owner}
            animal={animal}
            specialT={specialT}
            flip={flip}
            top={top}
            zombie={mode === 'zombie'}
            gallery={mode === 'gallery'}
          />
        );
      })}
    </>
  );
}

function SpecialBanner({
  animal,
  specialT,
  flip,
  top,
  zombie,
  gallery,
}: {
  animal: GameConfig['p1Animal'];
  specialT: number;
  flip: boolean;
  top: number;
  zombie?: boolean;
  gallery?: boolean;
}) {
  if (specialT <= SPECIAL_DURATION - 1.6) return null;
  // ゾンビ・まとあてモードで効果が変わる技は説明もそちらに合わせる
  const info =
    (zombie && SPECIAL_INFO_ZOMBIE[animal]) ||
    (gallery && SPECIAL_INFO_GALLERY[animal]) ||
    SPECIAL_INFO[animal];
  const spec = ANIMALS[animal];
  return (
    // 回転はenteringを持たない親Viewに付ける(enteringがtransformを上書きするため)
    <View style={[styles.bannerWrap, { top }, flip && styles.flipped]} pointerEvents="none">
      {/* バネなしの素早いポップ(弾みすぎるとの指摘で沈静化) */}
      <Animated.View entering={ZoomIn.duration(200)} style={styles.banner}>
        <Text style={styles.bannerTitle}>
          {spec.emoji} {info.name}!
        </Text>
        <Text style={styles.bannerDesc}>{info.desc}</Text>
      </Animated.View>
    </View>
  );
}

// アイテムモード: フィールドに浮かぶアイテム。ふわふわ揺れて、消える直前は点滅する
function ItemLayer({ items, elapsed }: { items: FieldItem[]; elapsed: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((item) => {
        const bob = Math.sin((elapsed + item.id) * 3) * 4;
        const expiring = item.age > ITEM_LIFETIME - 1.5;
        const opacity = expiring ? (Math.sin(item.age * 14) > 0 ? 1 : 0.25) : 1;
        return (
          <Text
            key={item.id}
            style={[styles.itemEmoji, { left: item.x - 17, top: item.y - 17 + bob, opacity }]}
          >
            {ITEM_INFO[item.kind].emoji}
          </Text>
        );
      })}
    </View>
  );
}

// ゾンビサバイバルのHUD: ハート・ウェーブ・撃退数・のこり。協力では上側にも回転表示
function ZombieHud({
  wave,
  hearts,
  defeated,
  remaining,
  coop,
  height,
}: {
  wave: number;
  hearts: number;
  defeated: number;
  remaining: number;
  coop: boolean;
  height: number;
}) {
  const heartText = '❤️'.repeat(Math.max(0, hearts)) + '🖤'.repeat(Math.max(0, 3 - hearts));
  const row = (flip: boolean, top: number) => (
    <View style={[styles.hudRow, flip && styles.flipped, { top }]} pointerEvents="none">
      <Text style={styles.zombieStats}>
        ウェーブ{Math.max(1, wave)} / 倒した {defeated} / 残り {remaining}
      </Text>
      <Text style={styles.zombieHearts}>{heartText}</Text>
    </View>
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {coop && row(true, 8)}
      {row(false, height - 44)}
    </View>
  );
}

// まとあて射的のHUD: スコアとタイマー。2人プレイは上側に回転表示
function GalleryHud({
  score1,
  score2,
  timeLeft,
  twoP,
  height,
}: {
  score1: number;
  score2: number;
  timeLeft: number;
  twoP: boolean;
  height: number;
}) {
  const time = Math.ceil(timeLeft);
  const hurry = time <= 10;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {twoP && (
        <View style={[styles.hudRow, styles.flipped, { top: 8 }]}>
          <Animated.Text
            key={`g2-${score2}`}
            entering={ZoomIn.springify().damping(14)}
            style={[styles.score, { color: '#fff' }]}
          >
            🎯 {score2}点
          </Animated.Text>
          <TimerText time={time} hurry={hurry} />
        </View>
      )}
      <View style={[styles.hudRow, { top: height - 44 }]}>
        <Animated.Text
          key={`g1-${score1}`}
          entering={ZoomIn.springify().damping(14)}
          style={[styles.score, { color: twoP ? COLORS.p1 : '#FFEB3B' }]}
        >
          🎯 {score1}点
        </Animated.Text>
        <TimerText time={time} hurry={hurry} />
      </View>
    </View>
  );
}

// ゾンビ: ウェーブ開始の告知バナー(ボスウェーブは専用の警告)
function WaveBanner({ wave, top, flip }: { wave: number; top: number; flip: boolean }) {
  const w = Math.max(1, wave);
  return (
    <View style={[styles.noticeWrap, { top }, flip && styles.flipped]} pointerEvents="none">
      <Animated.View entering={ZoomIn.duration(220)} key={wave}>
        <Text style={styles.waveText}>
          {isBossWave(w)
            ? `👹 ウェーブ ${w}! ボス出現! 50発当てて倒せ!!`
            : `🧟 ウェーブ ${w}! ${zombieWaveCount(w)}匹 攻めてくる!`}
        </Text>
      </Animated.View>
    </View>
  );
}

// ボタン発射モードの「はっしゃ!」ボタン。P1は左下、P2は右上(180°回転でP2から見て左下)
function FireButton({
  flip,
  top,
  right,
  disabled,
  onPress,
}: {
  flip: boolean;
  top: number;
  right: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={[
        styles.fireButtonWrap,
        { top },
        right ? { right: 14 } : { left: 14 },
        flip && styles.flipped,
        disabled && styles.fireButtonCooling,
      ]}
    >
      <JuicyButton
        label="発射!"
        color={disabled ? '#9E9E9E' : COLORS.uiAccent}
        onPress={onPress}
        style={styles.fireButton}
        textStyle={styles.fireButtonText}
      />
    </View>
  );
}

// ポーズメニュー。ゲームは止まった状態で表示される
function PauseMenu({
  control,
  isPractice,
  onControlChange,
  onResume,
  onReplay,
  onQuit,
}: {
  control: ControlType;
  isPractice: boolean;
  onControlChange: (c: ControlType) => void;
  onResume: () => void;
  onReplay: () => void;
  onQuit: () => void;
}) {
  return (
    <View style={styles.pauseOverlay}>
      <View style={styles.pauseCard}>
        {/* 縦に収まらない画面でもスクロールして全ボタンを押せるようにする */}
        <ScrollView bounces={false} contentContainerStyle={styles.pauseScroll}>
          <Text style={styles.pauseTitle}>⚙️ ポーズ</Text>

          {/* 発射操作の切り替え */}
          <Text style={styles.pauseLabel}>発射の操作</Text>
          <View style={styles.controlRow}>
            <ControlToggle control={control} onChange={onControlChange} />
          </View>

          <JuicyButton label="▶ 続ける" onPress={onResume} style={styles.pauseAction} />
          <JuicyButton label="🔄 最初から" color="#43A047" onPress={onReplay} style={styles.pauseAction} />
          <JuicyButton
            label={isPractice ? '🏁 練習を終わる' : '🏁 試合を終わる'}
            color="#E53935"
            onPress={onQuit}
            style={styles.pauseAction}
          />
        </ScrollView>
      </View>
    </View>
  );
}

// ゾンビの一撃必殺ボタン(1試合1回)。P1は右下、P2は左上(180°回転でP2から見て右下)
function UltraButton({
  flip,
  top,
  right,
  onPress,
}: {
  flip: boolean;
  top: number;
  right: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={[styles.itemButtonWrap, { top }, right ? { right: 14 } : { left: 14 }, flip && styles.flipped]}
    >
      <JuicyButton
        label="💥 必殺ボム"
        color="#D32F2F"
        onPress={onPress}
        style={styles.itemButton}
        textStyle={styles.itemButtonText}
      />
    </View>
  );
}

// 手持ちアイテムの発動ボタン。P1は右下、P2は左上(180°回転でP2から見て右下)
function ItemButton({
  held,
  flip,
  top,
  right,
  onUse,
}: {
  held: ItemKind | null;
  flip: boolean;
  top: number;
  right: boolean;
  onUse: () => void;
}) {
  if (!held) return null;
  return (
    <View
      style={[styles.itemButtonWrap, { top }, right ? { right: 14 } : { left: 14 }, flip && styles.flipped]}
    >
      <Animated.View entering={ZoomIn.springify().damping(14)} key={held}>
        <JuicyButton
          label={`${ITEM_INFO[held].emoji} 使う`}
          color="#7B1FA2"
          onPress={onUse}
          style={styles.itemButton}
          textStyle={styles.itemButtonText}
        />
      </Animated.View>
    </View>
  );
}

// アイテム効果の通知(攻撃した側/食らった側それぞれに表示)
function NoticeText({ notice, top, flip }: { notice: Notice | null; top: number; flip: boolean }) {
  if (!notice) return null;
  return (
    // 回転はenteringを持たない親Viewに付ける(enteringがtransformを上書きするため)
    <View style={[styles.noticeWrap, { top }, flip && styles.flipped]} pointerEvents="none">
      <Animated.View entering={ZoomIn.duration(200)} key={notice.text}>
        <Text style={styles.noticeText}>{notice.text}</Text>
      </Animated.View>
    </View>
  );
}

// 残り10秒を切ったら1秒ごとにポップして急かす
function TimerText({ time, hurry }: { time: number; hurry: boolean }) {
  if (!hurry) return <Text style={styles.timer}>{time}</Text>;
  return (
    <Animated.Text key={time} entering={ZoomIn.springify().damping(10)} style={[styles.timer, styles.timerHurry]}>
      {time}
    </Animated.Text>
  );
}

// 練習モードのHUD: 成績表示と「おわる」ボタン
function PracticeHud({
  score,
  shots,
  streak,
  height,
  onQuit,
}: {
  score: number;
  shots: number;
  streak: number;
  height: number;
  onQuit: () => void;
}) {
  const rate = shots > 0 ? Math.round((score / shots) * 100) : 0;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.hudRow, { top: 8 }]} pointerEvents="box-none">
        <Text style={styles.practiceStats}>
          エサやり {score} / 投げた {shots} / 成功 {rate}%
        </Text>
        <Pressable style={styles.quitButton} onPress={onQuit}>
          <Text style={styles.quitText}>終わる</Text>
        </Pressable>
      </View>
      {streak >= 3 && (
        <View style={[styles.streakWrap, { top: height / 2 + 60 }]} pointerEvents="none">
          <Animated.Text key={streak} entering={ZoomIn.springify().damping(9)} style={styles.streakText}>
            {streak}連続! すごい!
          </Animated.Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.fieldP1 },
  touchArea: { position: 'absolute', left: 0, right: 0 },
  hudRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flipped: { transform: [{ rotate: '180deg' }] },
  score: {
    fontSize: 26,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  timer: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF9C4',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  timerHurry: { color: '#FF7043', fontSize: 30 },
  practiceStats: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  quitButton: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quitText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  streakWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  streakText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFEB3B',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  countdownWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 90,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
  countdownSmall: { fontSize: 48 },
  ruleLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFEB3B',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  itemEmoji: { position: 'absolute', fontSize: 30 },
  zombieStats: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  zombieHearts: { fontSize: 20 },
  waveText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFEB3B',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  itemButtonWrap: { position: 'absolute' },
  itemButton: { paddingHorizontal: 18, paddingVertical: 10 },
  itemButtonText: { fontSize: 16 },
  fireButtonWrap: { position: 'absolute' },
  fireButtonCooling: { opacity: 0.55 },
  fireButton: { paddingHorizontal: 24, paddingVertical: 14 },
  fireButtonText: { fontSize: 18 },
  pauseButton: {
    position: 'absolute',
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: { fontSize: 18 },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseCard: {
    backgroundColor: COLORS.uiBg,
    borderRadius: 24,
    paddingHorizontal: 22,
    width: '84%',
    maxWidth: 360,
    maxHeight: '86%', // 縦に伸びすぎないよう上限を切り、中身はスクロール
  },
  pauseScroll: { paddingVertical: 16 },
  pauseTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  pauseLabel: { fontSize: 13, fontWeight: 'bold', color: '#DCEDC8', marginBottom: 6 },
  // ControlToggleは縦積みカードなのでrow指定しない(rowにすると幅が潰れて縦書きになる)
  controlRow: { alignSelf: 'stretch', marginBottom: 12 },
  pauseAction: { marginBottom: 8, paddingVertical: 10 },
  noticeWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  noticeText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    overflow: 'hidden',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  gaugeWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'flex-start' },
  gaugeBg: {
    width: 150,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  gaugeFill: { height: '100%', borderRadius: 4 },
  specialButtonWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  specialButton: { paddingHorizontal: 26, paddingVertical: 12 },
  specialButtonText: { fontSize: 17 },
  bannerWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  banner: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  bannerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFD700' },
  bannerDesc: { fontSize: 14, color: '#fff', marginTop: 2 },
});
