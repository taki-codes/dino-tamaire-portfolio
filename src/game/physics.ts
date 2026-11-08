import {
  ANIMAL_HIT_H,
  ANIMAL_HIT_W,
  BALL_LIFETIME,
  BALL_RADIUS,
  BOMB_PENALTY,
  BUTTON_PULL,
  CHARGE_DELAY_MAX,
  CHARGE_DELAY_MIN,
  CHARGE_HIT_DISTANCE,
  CHARGE_PENALTY,
  CHARGE_SPEED_RANGE,
  DASH_SPEED,
  DIZZY_DURATION,
  DIZZY_SPEED,
  FLOOR_BOUNCE,
  FREEZE_DURATION,
  GALLERY_BABY_CHANCE,
  GALLERY_BODY_R,
  GALLERY_EXIT_SPEED,
  GALLERY_LANES,
  GALLERY_MAX_WALKERS,
  GALLERY_PENALTY_BABY,
  GALLERY_PENALTY_BODY,
  GALLERY_RAMP_MAX,
  GALLERY_RARE_CHANCE,
  GALLERY_SCORE_RARE,
  GALLERY_SCORE_TARGET,
  GALLERY_SPAWN_T,
  GALLERY_SPEED,
  GALLERY_TARGET_LIFT,
  GALLERY_TARGET_R,
  GAME_DURATION,
  GAUGE_PER_GOAL,
  GRAVITY,
  ITEM_HIT_RADIUS,
  ITEM_LIFETIME,
  ITEM_MAX,
  ITEM_SPAWN_INTERVAL,
  LANE_OFFSET,
  LAUNCH_POWER,
  LOG_BOUNCE,
  LOG_H,
  LOG_MARGIN,
  LOG_OFFSET,
  LOG_SPEED,
  LOG_W,
  MAX_DRAG,
  GOAL_BURST_COUNT,
  MAX_FLOOR_BOUNCES,
  MIN_LAUNCH_SPEED,
  NOTICE_DURATION,
  PARTICLE_MAX,
  PLAN_DASH_T,
  PLAN_PAUSE_T,
  PLAN_WALK_T,
  REACT_DURATION,
  RETURN_SPEED,
  SAVIOR_INTERVAL,
  SAVIOR_SLOW_T,
  SHAKE_DURATION,
  ZOMBIE_GRAVITY_SCALE,
  ZOMBIE_HEARTS,
  ZOMBIE_HIT_R,
  ZOMBIE_BIG_WAVE,
  ZOMBIE_BOSS_HP,
  ZOMBIE_BOSS_SIZE,
  ZOMBIE_BOSS_WAVE_COUNT,
  ZOMBIE_INVULN,
  ZOMBIE_MAX_ALIVE,
  ZOMBIE_MID_CHANCE,
  ZOMBIE_MID_FROM,
  ZOMBIE_MID_HP,
  ZOMBIE_MID_MAX,
  ZOMBIE_MID_SIZE,
  ZOMBIE_RUSH_INTERVAL,
  ZOMBIE_RUSH_MAX,
  ZOMBIE_SPAWN_T,
  ZOMBIE_SPEED,
  ZOMBIE_SPEED_CAP,
  ZOMBIE_ULTRA_BOSS_DAMAGE,
  ZOMBIE_WAVE_BANNER,
  ZOMBIE_WAVE_SPEEDUP,
  SPECIAL_DURATION,
  SPEED_RAMP_MAX,
  SPEED_RAMP_TIME,
  WALK_SPEED,
  WALL_BOUNCE,
} from '../constants';
import {
  Aim,
  AnimalId,
  Ball,
  BattleRule,
  CarrierState,
  GalleryHold,
  GameMode,
  GameState,
  ItemKind,
  Layout,
  MovePlan,
  PlayerId,
} from '../types';
import { ITEM_INFO, ITEM_KINDS, SAVIOR_KINDS } from './rules';
import { SpecialMods } from './specials';

function rand([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

// 各動物のうろつきレーン(中央ラインの自陣側)
export function laneY(layout: Layout, owner: PlayerId): number {
  return layout.centerY + (owner === 1 ? LANE_OFFSET : -LANE_OFFSET);
}

export function createLayout(width: number, height: number): Layout {
  return {
    width,
    height,
    centerY: height / 2,
    launcher1: { x: width / 2, y: height - 100 },
    launcher2: { x: width / 2, y: 100 },
  };
}

function createCarrier(layout: Layout, owner: PlayerId): CarrierState {
  return {
    mode: 'center',
    hunger: 0,
    hungerLimit: rand([CHARGE_DELAY_MIN, CHARGE_DELAY_MAX]),
    chargeSpeed: rand(CHARGE_SPEED_RANGE),
    x: layout.width / 2,
    y: laneY(layout, owner),
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: rand(WALK_SPEED),
    plan: 'walk',
    planT: rand(PLAN_WALK_T),
  };
}

export function createInitialState(layout: Layout, duration = GAME_DURATION, coop = false): GameState {
  return {
    elapsed: 0,
    duration,
    timeLeft: duration,
    coop,
    score1: 0,
    score2: 0,
    shots1: 0,
    shots2: 0,
    carrier1: createCarrier(layout, 1),
    carrier2: createCarrier(layout, 2),
    gauge1: 0,
    gauge2: 0,
    special1: 0,
    special2: 0,
    balls: [],
    pops: [],
    particles: [],
    items: [],
    itemTimer: 2.5, // 開始少し後に最初のアイテムが出る
    held1: null,
    held2: null,
    dizzy1: 0,
    dizzy2: 0,
    freeze1: 0,
    freeze2: 0,
    notice1: null,
    notice2: null,
    zombies: [],
    zombieQueue: 0,
    zombieSpawnT: 0,
    wave: 0, // ゾンビモードの最初のstepでウェーブ1が始まる
    hearts: ZOMBIE_HEARTS,
    defeated: 0,
    waveBannerT: 0,
    invulnT: 0,
    zombieSlowT: 0,
    rushT: rand(ZOMBIE_RUSH_INTERVAL),
    walkers: [],
    walkerSpawnT: 1.0, // カウントダウン明けの少し後に最初の動物が出てくる
    ultra1Used: false,
    ultra2Used: false,
    shakeT: 0,
    react1: 0,
    react2: 0,
    streak1: 0,
    nextId: 1,
  };
}

// 各プレイヤーにとっての重力(自陣側へ引き戻される)
export function gravityFor(owner: PlayerId): number {
  return owner === 1 ? GRAVITY : -GRAVITY;
}

// owner別のえさやり判定矩形(=動物の体)。突進/帰還中もその位置に追従する。
// パンダの必殺技中は動物が大きくなり判定も拡大する(animalScale)
export function animalRect(state: GameState, owner: PlayerId, animalScale = 1) {
  const c = owner === 1 ? state.carrier1 : state.carrier2;
  const w = ANIMAL_HIT_W * animalScale;
  const h = ANIMAL_HIT_H * animalScale;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

// ボタン発射モード: 照準角度(真上=0、+が画面右)→ひっぱりベクトル(強さは固定)
export function buttonAngleToAim(owner: PlayerId, angle: number): Aim {
  return {
    dx: -BUTTON_PULL * Math.sin(angle),
    dy: (owner === 1 ? 1 : -1) * BUTTON_PULL * Math.cos(angle),
  };
}

// ドラッグベクトルをMAX_DRAGにクランプ
export function clampDrag(aim: Aim): Aim {
  const len = Math.hypot(aim.dx, aim.dy);
  if (len <= MAX_DRAG || len === 0) return aim;
  const k = MAX_DRAG / len;
  return { dx: aim.dx * k, dy: aim.dy * k };
}

// 引っ張りベクトル→初速。自陣側へ撃とうとしている/弱すぎる場合はnull
export function launchVelocity(owner: PlayerId, aim: Aim): { vx: number; vy: number } | null {
  const clamped = clampDrag(aim);
  const vx = -clamped.dx * LAUNCH_POWER;
  const vy = -clamped.dy * LAUNCH_POWER;
  const towardCenter = owner === 1 ? vy < 0 : vy > 0;
  if (!towardCenter) return null;
  if (Math.hypot(vx, vy) < MIN_LAUNCH_SPEED) return null;
  return { vx, vy };
}

export function launchBall(
  state: GameState,
  layout: Layout,
  owner: PlayerId,
  aim: Aim,
  mods: SpecialMods,
): boolean {
  const v = launchVelocity(owner, aim);
  if (!v) return false;
  if (owner === 1) state.shots1++;
  else state.shots2++;
  const launcher = owner === 1 ? layout.launcher1 : layout.launcher2;
  // くま(パワー)・うさぎ(弾速)の必殺技で初速が上がる
  const k = mods.powerScale * mods.speedScale;
  const push = (vx: number, vy: number) => {
    state.balls.push({
      id: state.nextId++,
      owner,
      x: launcher.x,
      y: launcher.y,
      vx,
      vy,
      floorBounces: 0,
      age: 0,
      dead: false,
      points: mods.pointsPerGoal,
      scale: mods.ballScale,
    });
  };
  // うさぎ(2発)・ライオン(3発)は扇状に同時発射
  const n = Math.max(1, mods.shotCount);
  for (let i = 0; i < n; i++) {
    const ang = n === 1 ? 0 : (i - (n - 1) / 2) * 0.18;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    push((v.vx * cos - v.vy * sin) * k, (v.vx * sin + v.vy * cos) * k);
  }
  return true;
}

// 1フレームで起きたイベント(効果音・ハプティクス用)
export interface StepEvents {
  goals: number; // えさやり成功(ゾンビモードでは撃退数)
  chargeStarted: boolean; // どちらかの動物が突進を始めた
  crashed: boolean; // どちらかのプレイヤーが突進を食らった
  itemGot: boolean; // アイテムを拾った(アイテムモード)
  rare: boolean; // まとあて: パンダまとに当てた(大得点)
  waveStarted: boolean; // ゾンビ: 新しいウェーブが始まった
  rush: boolean; // ゾンビ: 突発ラッシュが発生した
  heartLost: boolean; // ゾンビ: ハートが減った
  saviorGot: boolean; // ゾンビ: 救世主アイテムが発動した
  gameOver: boolean; // ゾンビ: ハートが尽きた
}

function emptyEvents(): StepEvents {
  return {
    goals: 0,
    chargeStarted: false,
    crashed: false,
    itemGot: false,
    rare: false,
    waveStarted: false,
    rush: false,
    heartLost: false,
    saviorGot: false,
    gameOver: false,
  };
}

// 1フレーム分の更新
export function step(
  state: GameState,
  layout: Layout,
  dt: number,
  mode: GameMode,
  rule: BattleRule,
  mods1: SpecialMods,
  mods2: SpecialMods,
): StepEvents {
  state.elapsed += dt;

  let events: StepEvents;
  if (mode === 'zombie') {
    // ゾンビモード: 時間無制限、ウェーブとハートで進行する
    events = emptyEvents();
    stepZombies(state, layout, dt, mods1, mods2, events);
    stepSaviorItems(state, layout, dt, events);
  } else if (mode === 'gallery') {
    // まとあて射的: えさを待つ動物はいない。まとを掲げた動物の行進だけ進める
    state.timeLeft = Math.max(0, state.duration - state.elapsed);
    events = emptyEvents();
    stepGallery(state, layout, dt, mods1, mods2);
  } else {
    // 練習モードは時間無制限(「おわる」ボタンで終了する)
    if (mode !== 'practice') {
      state.timeLeft = Math.max(0, state.duration - state.elapsed);
    }
    events = stepCarriers(state, layout, dt, mode, mods1, mods2);
    if (rule === 'item') stepItems(state, layout, dt, events);
  }

  events.goals = stepBalls(state, layout, dt, mode, rule, mods1, mods2, events);
  if (mode === 'zombie') {
    state.zombies = state.zombies.filter((z) => !z.dead);
  }
  stepPops(state, dt);
  stepParticles(state, dt);
  state.special1 = Math.max(0, state.special1 - dt);
  state.special2 = Math.max(0, state.special2 - dt);
  state.shakeT = Math.max(0, state.shakeT - dt);
  state.react1 = Math.max(0, state.react1 - dt);
  state.react2 = Math.max(0, state.react2 - dt);
  state.dizzy1 = Math.max(0, state.dizzy1 - dt);
  state.dizzy2 = Math.max(0, state.dizzy2 - dt);
  state.freeze1 = Math.max(0, state.freeze1 - dt);
  state.freeze2 = Math.max(0, state.freeze2 - dt);
  if (state.notice1 && (state.notice1.t -= dt) <= 0) state.notice1 = null;
  if (state.notice2 && (state.notice2.t -= dt) <= 0) state.notice2 = null;
  return events;
}

// ゲージ満タンなら必殺技を発動する(UI・CPUから呼ぶ)
export function activateSpecial(state: GameState, owner: PlayerId): boolean {
  if (owner === 1) {
    if (state.gauge1 < 1) return false;
    state.gauge1 = 0;
    state.special1 = SPECIAL_DURATION;
  } else {
    if (state.gauge2 < 1) return false;
    state.gauge2 = 0;
    state.special2 = SPECIAL_DURATION;
  }
  return true;
}

// 空腹突進システム: center(空腹が進む) → charging(突進) → returning(帰還) → center
function stepCarriers(
  state: GameState,
  layout: Layout,
  dt: number,
  mode: GameMode,
  mods1: SpecialMods,
  mods2: SpecialMods,
): StepEvents {
  const events = emptyEvents();
  const ramp = speedRamp(state.elapsed, mode);
  // 相手のねこじゃらし発動中は自分の動物の空腹が3倍速で進む
  stepCarrier(state, layout, dt, 1, mods2.opponentHungerScale, false, ramp, events);
  // 練習モードの上側動物は誰もえさをやれないので空腹を凍結する
  stepCarrier(state, layout, dt, 2, mods1.opponentHungerScale, mode === 'practice', ramp, events);
  return events;
}

function stepCarrier(
  state: GameState,
  layout: Layout,
  dt: number,
  owner: PlayerId,
  hungerScale: number,
  frozen: boolean,
  ramp: number,
  events: StepEvents,
) {
  const c = owner === 1 ? state.carrier1 : state.carrier2;
  const launcher = owner === 1 ? layout.launcher1 : layout.launcher2;

  if (c.mode === 'center') {
    const dizzy = (owner === 1 ? state.dizzy1 : state.dizzy2) > 0;
    stepAnimalMove(c, layout, dt, ramp, dizzy);
    c.y = laneY(layout, owner);
    if (!frozen) c.hunger += dt * hungerScale;
    if (c.hunger >= c.hungerLimit) {
      c.mode = 'charging';
      // 突進速度は毎回ランダム(じわじわ来ることも爆速で来ることもある)
      c.chargeSpeed = rand(CHARGE_SPEED_RANGE);
      events.chargeStarted = true;
    }
    return;
  }

  if (c.mode === 'charging') {
    // 自分の発射台へ突進(xは発射台めがけて追尾)
    c.y += (owner === 1 ? 1 : -1) * c.chargeSpeed * dt;
    c.x += (launcher.x - c.x) * Math.min(1, dt * 5);
    // 衝突: 発射台のyラインまで来たら横にずれていても衝突扱い。
    // 円判定だけだと爆速時にxが追いつかず、すり抜けて画面外へ消えてしまう
    const reached = owner === 1 ? c.y >= launcher.y : c.y <= launcher.y;
    const direct = Math.hypot(c.x - launcher.x, c.y - launcher.y) <= CHARGE_HIT_DISTANCE;
    if (reached || direct) {
      c.y = launcher.y; // 画面外へ出ないようクランプ
      // 衝突! 減点(0未満にはしない)して帰っていく
      if (owner === 1) state.score1 = Math.max(0, state.score1 - CHARGE_PENALTY);
      else state.score2 = Math.max(0, state.score2 - CHARGE_PENALTY);
      spawnBurst(state, c.x, c.y, CRASH_COLORS);
      state.shakeT = SHAKE_DURATION;
      c.mode = 'returning';
      c.hunger = 0;
      c.hungerLimit = rand([CHARGE_DELAY_MIN, CHARGE_DELAY_MAX]);
      events.crashed = true;
    }
    return;
  }

  // returning: 自分のレーンへ戻る
  const ty = laneY(layout, owner);
  const dist = Math.abs(ty - c.y);
  const move = RETURN_SPEED * dt;
  if (dist <= move) {
    c.mode = 'center';
    c.y = ty;
    c.planT = 0; // 戻ったらすぐ新しい行動を選ぶ
  } else {
    c.y += Math.sign(ty - c.y) * move;
  }
}

// 時間経過で動物が少しずつ機敏になる倍率(練習モードでは使わない)
function speedRamp(elapsed: number, mode: GameMode): number {
  if (mode === 'practice') return 1;
  return 1 + Math.min(elapsed / SPEED_RAMP_TIME, 1) * (SPEED_RAMP_MAX - 1);
}

// 変則移動: walk/dash/pause を短い間隔で乱択して切り替える
// めまい(🌀)中は高速で右往左往してえさを当てにくくなる
function stepAnimalMove(c: CarrierState, layout: Layout, dt: number, ramp: number, dizzy = false) {
  if (dizzy) {
    c.speed = DIZZY_SPEED;
    c.planT = 0; // 解けたらすぐ通常の行動を選び直す
    if (Math.random() < dt * 3) c.dir = c.dir === 1 ? -1 : 1;
  } else {
    stepAnimalPlan(c, dt, ramp);
  }

  c.x += c.dir * c.speed * dt;
  const margin = ANIMAL_HIT_W / 2 + 8;
  if (c.x < margin) {
    c.x = margin;
    c.dir = 1;
  } else if (c.x > layout.width - margin) {
    c.x = layout.width - margin;
    c.dir = -1;
  }
}

function stepAnimalPlan(c: CarrierState, dt: number, ramp: number) {
  c.planT -= dt;
  if (c.planT <= 0) {
    c.plan = nextPlan(c.plan);
    if (c.plan === 'walk') {
      c.speed = rand(WALK_SPEED) * ramp;
      c.planT = rand(PLAN_WALK_T);
      if (Math.random() < 0.45) c.dir = c.dir === 1 ? -1 : 1;
    } else if (c.plan === 'dash') {
      c.speed = rand(DASH_SPEED) * ramp;
      c.planT = rand(PLAN_DASH_T);
      if (Math.random() < 0.35) c.dir = c.dir === 1 ? -1 : 1;
    } else {
      c.speed = 0;
      c.planT = rand(PLAN_PAUSE_T);
    }
  }
}

// 次の行動を乱択。ダッシュの直後は急停止しやすい(変則感を出す)
function nextPlan(prev: MovePlan): MovePlan {
  if (prev === 'dash' && Math.random() < 0.5) return 'pause';
  const r = Math.random();
  if (r < 0.6) return 'walk';
  if (r < 0.85) return 'dash';
  return 'pause';
}

function stepBalls(
  state: GameState,
  layout: Layout,
  dt: number,
  mode: GameMode,
  rule: BattleRule,
  mods1: SpecialMods,
  mods2: SpecialMods,
  events: StepEvents,
): number {
  let goals = 0;
  const targets = {
    1: animalRect(state, 1, mods1.animalScale),
    2: animalRect(state, 2, mods2.animalScale),
  };
  // ギミックモード: 両陣地の丸太(位置は経過時間から決定的に求まる)
  const logs = rule === 'gimmick' ? [logRect(layout, 1, state.elapsed), logRect(layout, 2, state.elapsed)] : null;
  // ゾンビ・まとあてモードは重力が弱く、えさが相手側エリアの奥まで飛んでいく
  const farDies = mode === 'zombie' || mode === 'gallery';
  const gravityScale = farDies ? ZOMBIE_GRAVITY_SCALE : 1;

  for (const ball of state.balls) {
    const target = targets[ball.owner];
    ball.age += dt;
    ball.vy += gravityFor(ball.owner) * gravityScale * dt;
    // くんくんホーミング(犬): えさが標的のxへ吸い寄せられる。
    // 通常は自分の動物、ゾンビモードでは一番近いゾンビを追う。
    // 減衰つきバネで追尾(減衰なしだと行き過ぎて振動する)
    const homing = ball.owner === 1 ? mods1.homing : mods2.homing;
    if (homing > 0) {
      const homeX = mode === 'zombie'
        ? nearestZombieX(state, ball.x, ball.y)
        : mode === 'gallery'
          ? nearestGalleryTargetX(state, ball.owner, ball.x, ball.y)
          : (ball.owner === 1 ? state.carrier1 : state.carrier2).x;
      if (homeX !== null) {
        ball.vx += ((homeX - ball.x) * 40 - ball.vx * 12) * homing * dt;
      }
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // 丸太に当たったえさは跳ね返される
    if (logs) {
      for (const log of logs) collideLog(ball, log);
    }

    // 左右の壁で跳ね返る
    if (ball.x < BALL_RADIUS) {
      ball.x = BALL_RADIUS;
      ball.vx = Math.abs(ball.vx) * WALL_BOUNCE;
    } else if (ball.x > layout.width - BALL_RADIUS) {
      ball.x = layout.width - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx) * WALL_BOUNCE;
    }

    // ゾンビモード: ゾンビにえさが当たったらダメージ(通常1発/中ボス5発/ボス50発)。
    // 通常はえさも消費されるが、かめ(こうらパワー: points2)のえさは貫通して飛び続ける
    if (mode === 'zombie') {
      const piercing = ball.points >= 2;
      for (const z of state.zombies) {
        if (z.dead) continue;
        if (Math.hypot(ball.x - z.x, ball.y - z.y) <= ZOMBIE_HIT_R * z.size + BALL_RADIUS * ball.scale) {
          z.hp--;
          // ヒットごとにゲージとスコアがたまる(ボス戦中も必殺技が回る)
          if (ball.owner === 1) {
            state.score1 += ball.points;
            if (state.special1 <= 0) state.gauge1 = Math.min(1, state.gauge1 + GAUGE_PER_GOAL);
          } else {
            state.score2 += ball.points;
            if (state.special2 <= 0) state.gauge2 = Math.min(1, state.gauge2 + GAUGE_PER_GOAL);
          }
          if (z.hp <= 0) {
            z.dead = true;
            state.defeated++;
            spawnGoalBurst(state, z.x, z.y, ball.owner);
            state.pops.push({ id: state.nextId++, x: z.x, y: z.y, owner: ball.owner, age: 0 });
          } else {
            // まだ倒れない: ひるむ。ボスは押し返されずそのまま迫り続ける
            z.hitT = 0.2;
            if (z.kind !== 'boss') z.y -= (z.target === 1 ? 1 : -1) * 26;
            spawnBurst(state, ball.x, ball.y, ITEM_COLORS);
          }
          goals++;
          if (!piercing) {
            ball.dead = true;
            break;
          }
        }
      }
      if (ball.dead) continue;
    }

    // まとあて射的: 自分のまとにえさが当たったら得点、動物本体・あかちゃん連れは減点
    if (mode === 'gallery') {
      goals += collideGallery(state, ball, events);
      if (ball.dead) continue;
    }

    // えさやり判定: 中央へ向かって飛んでいるえさが動物の体に当たったら得点
    // (ゾンビ・まとあてモードにはえさを待つ動物がいないのでスキップ)
    const towardCenter = ball.owner === 1 ? ball.vy < 0 : ball.vy > 0;
    if (
      mode !== 'zombie' &&
      mode !== 'gallery' &&
      towardCenter &&
      ball.x > target.x &&
      ball.x < target.x + target.w &&
      ball.y > target.y &&
      ball.y < target.y + target.h
    ) {
      const carrier = ball.owner === 1 ? state.carrier1 : state.carrier2;
      if (ball.owner === 1) {
        state.score1 += ball.points;
        state.react1 = REACT_DURATION;
        state.streak1++;
        if (state.special1 <= 0) state.gauge1 = Math.min(1, state.gauge1 + GAUGE_PER_GOAL);
      } else {
        state.score2 += ball.points;
        state.react2 = REACT_DURATION;
        if (state.special2 <= 0) state.gauge2 = Math.min(1, state.gauge2 + GAUGE_PER_GOAL);
      }
      // えさを食べたので空腹リセット+次の突進タイミングを引き直す。突進中なら帰っていく
      carrier.hunger = 0;
      carrier.hungerLimit = rand([CHARGE_DELAY_MIN, CHARGE_DELAY_MAX]);
      if (carrier.mode === 'charging') carrier.mode = 'returning';
      state.shakeT = SHAKE_DURATION;
      spawnGoalBurst(state, ball.x, ball.y, ball.owner);
      state.pops.push({ id: state.nextId++, x: ball.x, y: ball.y, owner: ball.owner, age: 0 });
      ball.dead = true;
      goals++;
      continue;
    }

    // 自陣の床(画面端)でバウンド、回数超過で消滅
    const floorY = ball.owner === 1 ? layout.height - BALL_RADIUS : BALL_RADIUS;
    const hitFloor = ball.owner === 1 ? ball.y > floorY : ball.y < floorY;
    if (hitFloor) {
      ball.floorBounces++;
      if (ball.floorBounces > MAX_FLOOR_BOUNCES) {
        ball.dead = true;
        if (ball.owner === 1) state.streak1 = 0; // 外したら連続ゴール記録をリセット
        continue;
      }
      ball.y = floorY;
      ball.vy = -ball.vy * FLOOR_BOUNCE;
      ball.vx *= 0.8;
    }

    // 相手側の端まで飛んだ玉: 通常は壁として跳ね返す。
    // ゾンビ・まとあてモードではまっすぐ突き抜けて画面外へ消える(跳ね返りすぎ防止)
    const farY = ball.owner === 1 ? BALL_RADIUS : layout.height - BALL_RADIUS;
    const hitFar = ball.owner === 1 ? ball.y < farY : ball.y > farY;
    if (hitFar) {
      if (farDies) {
        ball.dead = true;
        continue;
      }
      ball.y = farY;
      ball.vy = -ball.vy * WALL_BOUNCE;
    }

    if (ball.age > BALL_LIFETIME) {
      ball.dead = true;
      if (ball.owner === 1) state.streak1 = 0;
    }
  }

  state.balls = state.balls.filter((b) => !b.dead);
  return goals;
}

// ギミックモード: 丸太の現在位置。往復運動は経過時間から決定的に計算する
// (P1は左から、P2は右から動き出す)
export function logRect(
  layout: Layout,
  owner: PlayerId,
  elapsed: number,
): { x: number; y: number; w: number; h: number } {
  const span = layout.width - LOG_W - LOG_MARGIN * 2;
  const phase = (elapsed * LOG_SPEED) / span / 2 + (owner === 2 ? 0.5 : 0);
  const k = 1 - Math.abs(((phase % 1) + 1) % 1 * 2 - 1); // 0→1→0の三角波
  return {
    x: LOG_MARGIN + k * span,
    y: layout.centerY + (owner === 1 ? 1 : -1) * LOG_OFFSET - LOG_H / 2,
    w: LOG_W,
    h: LOG_H,
  };
}

// えさと丸太の衝突(円vs矩形)。当たったら押し出して法線方向に反射する
function collideLog(
  ball: { x: number; y: number; vx: number; vy: number; scale: number },
  rect: { x: number; y: number; w: number; h: number },
) {
  const r = BALL_RADIUS * ball.scale;
  const nx = Math.min(Math.max(ball.x, rect.x), rect.x + rect.w);
  const ny = Math.min(Math.max(ball.y, rect.y), rect.y + rect.h);
  const dx = ball.x - nx;
  const dy = ball.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return;

  if (d2 === 0) {
    // 中心が丸太の中: 近い方の面へ押し出す(丸太は薄いので上下のどちらか)
    const up = ball.y - rect.y < rect.y + rect.h - ball.y;
    ball.y = up ? rect.y - r : rect.y + rect.h + r;
    ball.vy = (up ? -1 : 1) * Math.abs(ball.vy) * LOG_BOUNCE;
    return;
  }

  const d = Math.sqrt(d2);
  const nxn = dx / d;
  const nyn = dy / d;
  ball.x = nx + nxn * r;
  ball.y = ny + nyn * r;
  // 法線方向に向かっている速度成分だけ反転する
  const vn = ball.vx * nxn + ball.vy * nyn;
  if (vn < 0) {
    ball.vx -= (1 + LOG_BOUNCE) * vn * nxn;
    ball.vy -= (1 + LOG_BOUNCE) * vn * nyn;
  }
}

// アイテムモード: 出現・寿命・えさとの当たり判定
function stepItems(state: GameState, layout: Layout, dt: number, events: StepEvents) {
  // 一定間隔で両陣地に同じ種類のアイテムを鏡写しに出す(公平になるように)
  state.itemTimer -= dt;
  if (state.itemTimer <= 0) {
    state.itemTimer = rand(ITEM_SPAWN_INTERVAL);
    if (state.items.length < ITEM_MAX) {
      const kind = ITEM_KINDS[Math.floor(Math.random() * ITEM_KINDS.length)];
      const margin = 40;
      const x = margin + Math.random() * (layout.width - margin * 2);
      // 動物のレーンと発射台の間(えさが届きやすい高さ)に置く
      const maxOff = Math.max(120, Math.min(210, layout.centerY - 140));
      const off = 100 + Math.random() * (maxOff - 100);
      state.items.push({ id: state.nextId++, kind, x, y: layout.centerY + off, age: 0 });
      state.items.push({ id: state.nextId++, kind, x: layout.width - x, y: layout.centerY - off, age: 0 });
    }
  }

  for (const item of state.items) {
    item.age += dt;
    if (item.age > ITEM_LIFETIME) continue;
    // 自分の陣地のアイテムに自分のえさが触れたら手持ちに入る(相手陣地のは取れない)。
    // すでに手持ちがあるあいだは新しく拾えない
    const side: PlayerId = item.y > layout.centerY ? 1 : 2;
    if (side === 1 ? state.held1 : state.held2) continue;
    for (const ball of state.balls) {
      if (ball.dead || ball.owner !== side) continue;
      if (Math.hypot(ball.x - item.x, ball.y - item.y) <= ITEM_HIT_RADIUS + BALL_RADIUS * ball.scale) {
        item.age = ITEM_LIFETIME + 1; // 取得済みとして消す
        if (side === 1) state.held1 = item.kind;
        else state.held2 = item.kind;
        setNotice(state, side, ITEM_INFO[item.kind].getText, NOTICE_DURATION);
        spawnBurst(state, item.x, item.y, ITEM_COLORS);
        events.itemGot = true;
        break;
      }
    }
  }
  state.items = state.items.filter((i) => i.age <= ITEM_LIFETIME);
}

// 手持ちアイテムを発動して相手を攻撃する(UIボタン・CPUから呼ぶ)。
// 発動したアイテムの種類を返す(持っていなければnull)
export function useHeldItem(state: GameState, layout: Layout, owner: PlayerId): ItemKind | null {
  const kind = owner === 1 ? state.held1 : state.held2;
  if (!kind) return null;
  if (owner === 1) state.held1 = null;
  else state.held2 = null;

  const opponent: PlayerId = owner === 1 ? 2 : 1;
  const info = ITEM_INFO[kind];
  let victimNoticeT = NOTICE_DURATION;
  if (kind === 'bomb') {
    if (opponent === 1) state.score1 = Math.max(0, state.score1 - BOMB_PENALTY);
    else state.score2 = Math.max(0, state.score2 - BOMB_PENALTY);
    // 相手の発射台のあたりで爆発の演出
    const launcher = opponent === 1 ? layout.launcher1 : layout.launcher2;
    spawnBurst(state, launcher.x, launcher.y, CRASH_COLORS);
    state.shakeT = SHAKE_DURATION;
  } else if (kind === 'dizzy') {
    if (opponent === 1) state.dizzy1 = DIZZY_DURATION;
    else state.dizzy2 = DIZZY_DURATION;
    victimNoticeT = DIZZY_DURATION;
  } else {
    if (opponent === 1) state.freeze1 = FREEZE_DURATION;
    else state.freeze2 = FREEZE_DURATION;
    victimNoticeT = FREEZE_DURATION;
  }

  setNotice(state, owner, info.attackText, NOTICE_DURATION);
  setNotice(state, opponent, info.victimText, victimNoticeT);
  return kind;
}

function setNotice(state: GameState, owner: PlayerId, text: string, t: number) {
  if (owner === 1) state.notice1 = { text, t };
  else state.notice2 = { text, t };
}

// ─── まとあて射的(パンダダーツ風) ───────────────────────────────
// まとを掲げた動物が画面を横切って行進する。まとにえさを当てると得点、
// パンダまとは大得点、動物本体やあかちゃん連れに当てると減点。
// 2人プレイは両陣地に鏡写しで同じ動物を出す(公平になるように)

const GALLERY_ANIMALS: AnimalId[] = ['dog', 'panda', 'cat', 'rabbit', 'turtle', 'bear', 'lion'];

// 各レーンのy位置: 中央ラインから撃つ人の反対側(奥)へ。奥のレーンほど狙うのが難しい
export function galleryLaneY(layout: Layout, side: PlayerId, lane: number): number {
  return layout.centerY - (side === 1 ? 1 : -1) * GALLERY_LANES[lane];
}

// まとの位置: 動物が撃つ人側(手前)へ掲げている。
// 奥側に掲げるとえさが必ず動物本体を先に通ってしまい、まとを狙えなくなる
export function galleryTargetY(walker: { side: PlayerId; y: number }): number {
  return walker.y + (walker.side === 1 ? 1 : -1) * GALLERY_TARGET_LIFT;
}

// 持ちものを抽選: ふつうのまと / パンダまと(大得点) / あかちゃんおんぶ(撃っちゃダメ)
function rollGalleryHold(): GalleryHold {
  const r = Math.random();
  if (r < GALLERY_RARE_CHANCE) return 'rare';
  if (r < GALLERY_RARE_CHANCE + GALLERY_BABY_CHANCE) return 'baby';
  return 'target';
}

// 動物を1匹(2人プレイでは両陣地に鏡写しで1匹ずつ)出す
function spawnWalkers(state: GameState, layout: Layout, ramp: number) {
  const lane = Math.floor(Math.random() * GALLERY_LANES.length);
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const hold = rollGalleryHold();
  const animal = GALLERY_ANIMALS[Math.floor(Math.random() * GALLERY_ANIMALS.length)];
  const speed = rand(GALLERY_SPEED) * ramp;
  const phase = Math.random() * Math.PI * 2;
  const sides: PlayerId[] = state.coop ? [1, 2] : [1];
  for (const side of sides) {
    const d: 1 | -1 = side === 1 ? dir : dir === 1 ? -1 : 1; // P2側は左右も鏡写し
    state.walkers.push({
      id: state.nextId++,
      animal,
      side,
      hold,
      exiting: false,
      x: d === 1 ? -50 : layout.width + 50,
      y: galleryLaneY(layout, side, lane),
      dir: d,
      speed,
      phase,
      hitT: 0,
      dead: false,
    });
  }
}

// 行進の更新: 出現・移動・退場。終盤ほど速く、たくさん出てくる
function stepGallery(state: GameState, layout: Layout, dt: number, mods1: SpecialMods, mods2: SpecialMods) {
  const ramp = 1 + Math.min(state.elapsed / Math.max(1, state.duration), 1) * (GALLERY_RAMP_MAX - 1);

  state.walkerSpawnT -= dt;
  if (state.walkerSpawnT <= 0) {
    state.walkerSpawnT = rand(GALLERY_SPAWN_T) / ramp;
    // 上限は片側の数で判定(2人プレイは鏡写しなので両側同数)
    const alive = state.walkers.filter((w) => !w.dead && w.side === 1).length;
    if (alive < GALLERY_MAX_WALKERS) spawnWalkers(state, layout, ramp);
  }

  // ねこじゃらし(必殺技)中は動物たちが立ち止まる(まとが狙い放題)
  const catActive = mods1.opponentHungerScale > 1 || mods2.opponentHungerScale > 1;
  for (const w of state.walkers) {
    w.hitT = Math.max(0, w.hitT - dt);
    // 退場中はダッシュで画面外へ(釘付けでも止まらない)
    const speed = w.exiting ? GALLERY_EXIT_SPEED : catActive ? 0 : w.speed;
    w.x += w.dir * speed * dt;
    if (w.x < -70 || w.x > layout.width + 70) w.dead = true;
  }
  state.walkers = state.walkers.filter((w) => !w.dead);
}

// えさと行進中の動物の当たり判定。当てたまとの数をgoalsとして返す
function collideGallery(state: GameState, ball: Ball, events: StepEvents): number {
  const r = BALL_RADIUS * ball.scale;
  for (const w of state.walkers) {
    // 自分のまとにしか当たらない(2人プレイの公平性。退場中も当たらない)
    if (w.dead || w.exiting || w.side !== ball.owner) continue;

    // まず「まと」: 当てると得点(パンダまとは大得点、かめの必殺技中は2倍)
    if (w.hold !== 'baby') {
      const ty = galleryTargetY(w);
      if (Math.hypot(ball.x - w.x, ball.y - ty) <= GALLERY_TARGET_R + r) {
        const base = w.hold === 'rare' ? GALLERY_SCORE_RARE : GALLERY_SCORE_TARGET;
        const pts = base * ball.points;
        if (ball.owner === 1) {
          state.score1 += pts;
          if (state.special1 <= 0) state.gauge1 = Math.min(1, state.gauge1 + GAUGE_PER_GOAL);
        } else {
          state.score2 += pts;
          if (state.special2 <= 0) state.gauge2 = Math.min(1, state.gauge2 + GAUGE_PER_GOAL);
        }
        state.defeated++; // 当てたまとの数(リザルト表示用)
        if (w.hold === 'rare') {
          setNotice(state, ball.owner, `🐼 パンダまと! +${pts}点!`, NOTICE_DURATION);
          events.rare = true;
        }
        w.exiting = true; // まとを撃ち抜かれた動物は走って退場する
        w.hitT = 0.25;
        spawnGoalBurst(state, ball.x, ty, ball.owner);
        state.pops.push({ id: state.nextId++, x: ball.x, y: ty, owner: ball.owner, age: 0 });
        ball.dead = true;
        return 1;
      }
    }

    // 動物本体・あかちゃん連れ: 当てると減点(0未満にはならない)
    if (Math.hypot(ball.x - w.x, ball.y - w.y) <= GALLERY_BODY_R + r) {
      const penalty = w.hold === 'baby' ? GALLERY_PENALTY_BABY : GALLERY_PENALTY_BODY;
      if (ball.owner === 1) state.score1 = Math.max(0, state.score1 - penalty);
      else state.score2 = Math.max(0, state.score2 - penalty);
      setNotice(
        state,
        ball.owner,
        w.hold === 'baby' ? `🍼 あかちゃんはダメ! -${penalty}点` : `💢 動物に当てちゃダメ! -${penalty}点`,
        NOTICE_DURATION,
      );
      w.hitT = 0.35;
      if (w.hold === 'baby') w.exiting = true; // あかちゃんを守って走り去る
      spawnBurst(state, ball.x, ball.y, CRASH_COLORS);
      state.shakeT = SHAKE_DURATION;
      events.crashed = true;
      ball.dead = true;
      return 0;
    }
  }
  return 0;
}

// ホーミングえさの標的(まとあて): 一番近い自分のまと(あかちゃん連れは追わない)
function nearestGalleryTargetX(state: GameState, owner: PlayerId, x: number, y: number): number | null {
  let best = Infinity;
  let bx: number | null = null;
  for (const w of state.walkers) {
    if (w.dead || w.exiting || w.side !== owner || w.hold === 'baby') continue;
    const d = Math.hypot(w.x - x, w.y - y);
    if (d < best) {
      best = d;
      bx = w.x;
    }
  }
  return bx;
}

// ゾンビサバイバル: ウェーブごとの匹数(10→30→50→100→以降+50ずつ)
export function zombieWaveCount(wave: number): number {
  const table = [10, 30, 50, 100];
  return wave <= table.length ? table[Math.max(0, wave - 1)] : 100 + (wave - 4) * 50;
}

// 350匹のフェーズはボスウェーブ(通常の群れの代わりにボス、50発で撃破。協力は2体)
export function isBossWave(wave: number): boolean {
  return zombieWaveCount(wave) === ZOMBIE_BOSS_WAVE_COUNT;
}

// ─── 難易度スケーリング: ウェーブが進むほど頭打ちせずじわじわ難しくなる ───

// 画面上の同時数上限: ウェーブ9以降は2ウェーブごとに+1(最大で基本値+8=26)
function zombieMaxAlive(wave: number): number {
  return ZOMBIE_MAX_ALIVE + Math.min(8, Math.floor(Math.max(0, wave - 8) / 2));
}

// スポーン/ラッシュ間隔の倍率: ウェーブごとに3%短くなり、最短で半分
function zombiePace(wave: number): number {
  return Math.max(0.5, 1 - (wave - 1) * 0.03);
}

// 中ボスの出現率: ウェーブ8以降+2%/wave(最大35%)
function zombieMidChance(wave: number): number {
  return Math.min(0.35, ZOMBIE_MID_CHANCE + Math.max(0, wave - 7) * 0.02);
}

// 中ボスの同時数: ウェーブ12以降は3体まで
function zombieMidMax(wave: number): number {
  return wave >= 12 ? ZOMBIE_MID_MAX + 1 : ZOMBIE_MID_MAX;
}

const ZOMBIE_ANIMALS: AnimalId[] = ['dog', 'panda', 'cat', 'rabbit', 'turtle', 'bear', 'lion'];

// 中央ラインからゾンビをn匹出す(残りノルマと画面上限の範囲内)。実際に出た数を返す。
// ボスウェーブではボス(ソロ1体/協力2体)、300匹以上のウェーブでは時折5発必要な中ボスが混ざる
function spawnZombies(state: GameState, layout: Layout, n: number): number {
  const capacity = Math.max(0, zombieMaxAlive(state.wave) - state.zombies.length);
  const count = Math.min(n, state.zombieQueue, capacity);
  const margin = 40;
  const bossWave = isBossWave(state.wave);
  // 中ボスはスポーン1回にせいぜい1体。出現率と同時数はウェーブとともに増える
  let midSlot =
    !bossWave &&
    zombieWaveCount(state.wave) >= ZOMBIE_MID_FROM &&
    Math.random() < zombieMidChance(state.wave) &&
    state.zombies.filter((z) => z.kind === 'mid').length < zombieMidMax(state.wave)
      ? 1
      : 0;

  for (let i = 0; i < count; i++) {
    const kind = bossWave ? 'boss' : midSlot-- > 0 ? 'mid' : 'normal';
    const hp = kind === 'boss' ? ZOMBIE_BOSS_HP : kind === 'mid' ? ZOMBIE_MID_HP : 1;
    const size = kind === 'boss' ? ZOMBIE_BOSS_SIZE : kind === 'mid' ? ZOMBIE_MID_SIZE : 1;
    // 大きいやつほどゆっくり迫る
    const speedScale = kind === 'boss' ? 0.45 : kind === 'mid' ? 0.75 : 1;
    // 協力プレイのボスは各プレイヤーに1体ずつ向かう(1体目→P1、2体目→P2)
    const target: PlayerId =
      kind === 'boss' && state.coop
        ? state.zombies.some((o) => !o.dead && o.kind === 'boss' && o.target === 1)
          ? 2
          : 1
        : state.coop && Math.random() < 0.5
          ? 2
          : 1;
    state.zombies.push({
      id: state.nextId++,
      animal: ZOMBIE_ANIMALS[Math.floor(Math.random() * ZOMBIE_ANIMALS.length)],
      kind,
      hp,
      maxHp: hp,
      size,
      x: margin + Math.random() * (layout.width - margin * 2),
      y: layout.centerY + (Math.random() * 2 - 1) * 24,
      speed:
        rand(ZOMBIE_SPEED) * speedScale * Math.min(ZOMBIE_SPEED_CAP, 1 + (state.wave - 1) * ZOMBIE_WAVE_SPEEDUP),
      target,
      phase: Math.random() * Math.PI * 2,
      hitT: 0,
      dead: false,
    });
    state.zombieQueue--;
  }
  return count;
}

// ゾンビサバイバル: おなかすき動物の群れ。中央から各プレイヤーの端へ迫り、
// えさで撃退できる。端まで来られたらハートが減る
function stepZombies(
  state: GameState,
  layout: Layout,
  dt: number,
  mods1: SpecialMods,
  mods2: SpecialMods,
  events: StepEvents,
) {
  state.waveBannerT = Math.max(0, state.waveBannerT - dt);
  state.invulnT = Math.max(0, state.invulnT - dt);
  state.zombieSlowT = Math.max(0, state.zombieSlowT - dt);

  // ウェーブ開始(初回含む): 出撃予定も生存もいなくなったら次のウェーブへ。
  // ボスウェーブは群れの代わりにボスだけ(ソロ1体/協力は各プレイヤーに1体ずつ)
  if (state.zombieQueue === 0 && state.zombies.length === 0) {
    state.wave++;
    state.zombieQueue = isBossWave(state.wave) ? (state.coop ? 2 : 1) : zombieWaveCount(state.wave);
    state.waveBannerT = ZOMBIE_WAVE_BANNER;
    state.zombieSpawnT = ZOMBIE_WAVE_BANNER; // バナーの間は出てこない
    // ウェーブクリアのごほうびにハート1回復
    if (state.wave > 1) state.hearts = Math.min(ZOMBIE_HEARTS, state.hearts + 1);
    events.waveStarted = true;
  }

  // スポーン: ウェーブが進むほど間隔が短くなり、一度に出る数も増える。
  // 画面上の同時数上限も終盤はじわじわ上がる(zombieMaxAlive)
  if (state.zombieQueue > 0) {
    state.zombieSpawnT -= dt;
    if (state.zombieSpawnT <= 0) {
      state.zombieSpawnT = rand(ZOMBIE_SPAWN_T) * zombiePace(state.wave);
      const c = zombieWaveCount(state.wave);
      const maxBatch = c > 400 ? 6 : c > ZOMBIE_BIG_WAVE ? 5 : 4;
      spawnZombies(state, layout, Math.min(maxBatch, state.wave));
    }

    // 突発ラッシュ: ウェーブ2以降、ときどき一気に押し寄せる「難しいターン」。
    // 終盤ほど間隔が短く、規模も大きくなる(ボスウェーブはラッシュなし=ボスとの一騎打ち)
    state.rushT -= dt;
    if (state.rushT <= 0 && state.wave >= 2 && state.waveBannerT <= 0 && !isBossWave(state.wave)) {
      state.rushT = rand(ZOMBIE_RUSH_INTERVAL) * zombiePace(state.wave);
      const rushCap = ZOMBIE_RUSH_MAX + Math.floor(Math.max(0, state.wave - 12) / 2);
      const size = Math.min(rushCap, 8 + Math.floor(state.wave / 2));
      // 画面に出せる枠が少ないときはラッシュにしない(次の機会へ)
      if (spawnZombies(state, layout, size) >= 4) {
        const text = '⚠️ ラッシュ! 一気に来るぞ!';
        state.notice1 = { text, t: NOTICE_DURATION };
        if (state.coop) state.notice2 = { text, t: NOTICE_DURATION };
        events.rush = true;
      }
    }
  }

  // ねこじゃらし(必殺技)中はゾンビが釘付けで完全に止まる。⏳アイテムは半分の速さ
  const catActive = mods1.opponentHungerScale > 1 || mods2.opponentHungerScale > 1;
  const slow = catActive ? 0 : state.zombieSlowT > 0 ? 0.5 : 1;

  for (const z of state.zombies) {
    z.hitT = Math.max(0, z.hitT - dt);
    z.y += (z.target === 1 ? 1 : -1) * z.speed * slow * dt;
    // 左右にゆらゆらしながら迫る(釘付け中は揺れも止まる)
    z.x += Math.sin(state.elapsed * 1.6 + z.phase) * 32 * slow * dt;
    z.x = Math.min(Math.max(z.x, 30), layout.width - 30);

    // 発射台のラインまで来られたらぶつかられてハートが減る。
    // 通常ゾンビは列に戻ってまた出てくる=ウェーブの全員を倒さないとクリアできない。
    // 中ボス・ボスはHPを保ったまま中央へ戻って再突撃する
    const goalLine = z.target === 1 ? layout.launcher1.y : layout.launcher2.y;
    const reached = z.target === 1 ? z.y >= goalLine : z.y <= goalLine;
    if (reached) {
      if (z.kind === 'normal') {
        z.dead = true;
        state.zombieQueue++;
      } else {
        z.y = layout.centerY;
        // 協力プレイの中ボスは次はもう片方のプレイヤーを狙う(ボスは担当プレイヤーを狙い続ける)
        if (state.coop && z.kind !== 'boss') z.target = z.target === 1 ? 2 : 1;
      }
      spawnBurst(state, z.x, z.y, CRASH_COLORS);
      state.shakeT = SHAKE_DURATION;
      // 無敵時間中は連続ヒットでハートが溶けないようにする
      if (state.invulnT <= 0) {
        state.hearts--;
        state.invulnT = ZOMBIE_INVULN;
        events.heartLost = true;
        if (state.hearts <= 0) events.gameOver = true;
      }
    }
  }
  state.zombies = state.zombies.filter((z) => !z.dead);
}

// ゾンビサバイバルの救世主アイテム: たまに出現し、えさが触れた瞬間に発動する
function stepSaviorItems(state: GameState, layout: Layout, dt: number, events: StepEvents) {
  state.itemTimer -= dt;
  if (state.itemTimer <= 0) {
    state.itemTimer = rand(SAVIOR_INTERVAL);
    if (state.items.length < 2) {
      const kind = SAVIOR_KINDS[Math.floor(Math.random() * SAVIOR_KINDS.length)];
      const margin = 40;
      // ソロはP1側、協力ではランダムな側に出る
      const side: PlayerId = state.coop && Math.random() < 0.5 ? 2 : 1;
      const off = 100 + Math.random() * 90;
      state.items.push({
        id: state.nextId++,
        kind,
        x: margin + Math.random() * (layout.width - margin * 2),
        y: layout.centerY + (side === 1 ? off : -off),
        age: 0,
      });
    }
  }

  for (const item of state.items) {
    item.age += dt;
    if (item.age > ITEM_LIFETIME) continue;
    for (const ball of state.balls) {
      if (ball.dead) continue;
      if (Math.hypot(ball.x - item.x, ball.y - item.y) <= ITEM_HIT_RADIUS + BALL_RADIUS * ball.scale) {
        item.age = ITEM_LIFETIME + 1;
        applySavior(state, item.kind, item.x, item.y, events);
        break;
      }
    }
  }
  state.items = state.items.filter((i) => i.age <= ITEM_LIFETIME);
}

function applySavior(state: GameState, kind: ItemKind, x: number, y: number, events: StepEvents) {
  events.saviorGot = true;
  spawnBurst(state, x, y, ITEM_COLORS);
  if (kind === 'heart') {
    state.hearts = Math.min(ZOMBIE_HEARTS, state.hearts + 1);
  } else if (kind === 'nuke') {
    // いま画面にいるゾンビを一掃(撃退数にも入る)。ボスは大ダメージのみ
    blastZombies(state);
    state.shakeT = SHAKE_DURATION;
  } else {
    state.zombieSlowT = SAVIOR_SLOW_T;
  }
  const text = ITEM_INFO[kind].getText;
  state.notice1 = { text, t: NOTICE_DURATION };
  if (state.coop) state.notice2 = { text, t: NOTICE_DURATION };
}

// 爆発系(必殺ボム・💥アイテム)の共通処理: 画面のゾンビを一掃する。
// ボスは即死せず大ダメージ(ZOMBIE_ULTRA_BOSS_DAMAGE)だけ受ける。倒した数を返す
function blastZombies(state: GameState): number {
  let killed = 0;
  for (const z of state.zombies) {
    if (z.dead) continue;
    if (z.kind === 'boss') {
      z.hp -= ZOMBIE_ULTRA_BOSS_DAMAGE;
      z.hitT = 0.3;
    } else {
      z.hp = 0;
    }
    if (z.hp <= 0) {
      z.dead = true;
      state.defeated++;
      killed++;
    }
    spawnBurst(state, z.x, z.y, CRASH_COLORS); // パーティクル上限内で爆発を散らす
  }
  return killed;
}

// 一撃必殺ボム(1試合1回): いま画面にいるゾンビを一掃する。
// まだ使っておらず、ゾンビが1匹でもいるときだけ発動できる
export function useZombieUltra(state: GameState, owner: PlayerId): boolean {
  const used = owner === 1 ? state.ultra1Used : state.ultra2Used;
  const alive = state.zombies.filter((z) => !z.dead);
  if (used || alive.length === 0) return false;
  if (owner === 1) state.ultra1Used = true;
  else state.ultra2Used = true;

  const killed = blastZombies(state);
  state.shakeT = SHAKE_DURATION;
  const hasBoss = state.zombies.some((z) => !z.dead && z.kind === 'boss');
  const text = hasBoss
    ? '💥 一撃必殺!! ボスに大ダメージ!'
    : `💥 一撃必殺!! ${killed}匹 吹き飛ばした!`;
  state.notice1 = { text, t: NOTICE_DURATION };
  if (state.coop) state.notice2 = { text, t: NOTICE_DURATION };
  return true;
}

// ホーミングえさの標的: 一番近い生存ゾンビのx(いなければnull)
function nearestZombieX(state: GameState, x: number, y: number): number | null {
  let best = Infinity;
  let bx: number | null = null;
  for (const z of state.zombies) {
    if (z.dead) continue;
    const d = Math.hypot(z.x - x, z.y - y);
    if (d < best) {
      best = d;
      bx = z.x;
    }
  }
  return bx;
}

function stepPops(state: GameState, dt: number) {
  for (const pop of state.pops) pop.age += dt;
  state.pops = state.pops.filter((p) => p.age < 0.5);
}

const BURST_COLORS_P1 = ['#FFB300', '#FF7043', '#FFF176'];
const BURST_COLORS_P2 = ['#FFFFFF', '#B3E5FC', '#FFF176'];
const CRASH_COLORS = ['#616161', '#E53935', '#FFEB3B'];
const ITEM_COLORS = ['#FFD700', '#FF7043', '#CE93D8']; // アイテム取得

function spawnGoalBurst(state: GameState, x: number, y: number, owner: PlayerId) {
  spawnBurst(state, x, y, owner === 1 ? BURST_COLORS_P1 : BURST_COLORS_P2);
}

// 指定地点から放射状に飛び散るパーティクルを生成
function spawnBurst(state: GameState, x: number, y: number, colors: string[]) {
  for (let i = 0; i < GOAL_BURST_COUNT; i++) {
    if (state.particles.length >= PARTICLE_MAX) return;
    const ang = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 220;
    state.particles.push({
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      age: 0,
      life: 0.45 + Math.random() * 0.4,
      size: 3 + Math.random() * 4,
      color: colors[i % colors.length],
    });
  }
}

function stepParticles(state: GameState, dt: number) {
  for (const p of state.particles) {
    p.age += dt;
    // 空気抵抗でゆっくり減速しながら漂う
    const drag = Math.max(0, 1 - dt * 2.2);
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.particles = state.particles.filter((p) => p.age < p.life);
}

// 照準ガイド用: 発射した場合の放物線上の点をサンプリング
export function trajectoryDots(
  owner: PlayerId,
  aim: Aim,
  layout: Layout,
  count = 8,
  velScale = 1, // 必殺技(くま・うさぎ)中は実際の弾速に合わせてガイドも変える
  gravityScale = 1, // ゾンビモードの弱重力に合わせてガイドも変える
): { x: number; y: number }[] {
  const v = launchVelocity(owner, aim);
  if (!v) return [];
  const launcher = owner === 1 ? layout.launcher1 : layout.launcher2;
  const g = gravityFor(owner) * gravityScale;
  const dots: { x: number; y: number }[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i * 0.07;
    dots.push({
      x: launcher.x + v.vx * velScale * t,
      y: launcher.y + v.vy * velScale * t + 0.5 * g * t * t,
    });
  }
  return dots;
}
