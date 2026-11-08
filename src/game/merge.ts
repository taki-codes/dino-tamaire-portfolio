import { AnimalId, Particle } from '../types';

// どうぶつマージ: 同じ動物を落としてぶつけると次の動物に進化する物理パズル。
// いぬ→ぱんだ→ねこ→うさぎ→かめ→くま→らいおん。
// らいおん同士は進化せず2匹とも消えて大量得点+爆発でゾンビを一掃。
//
// スイカゲームとの違い(このゲームならではの要素):
// - はらぺこゾンビ: ときどき落ちてくるおじゃまボール。合体できず場所をふさぐ。
//   そばで合体を2回起こすと退治(+50点)。らいおん爆発なら範囲内をまとめて退治
// - おなかすき暴れ: 長く放置された動物はおなかがすいて怒り、ぴょんぴょん跳ねて
//   タワーを崩す。early merge(こまめに合体)しないと積み上げが不安定になる

export const MERGE_CHAIN: AnimalId[] = ['dog', 'panda', 'cat', 'rabbit', 'turtle', 'bear', 'lion'];
export const MERGE_TIERS = MERGE_CHAIN.length;

// はらぺこゾンビはtier=-1として扱う(current/nextにも入る)
export const ZOMBIE_TIER = -1;

// 各段階の半径(フィールド幅に対する割合。タブレットで大きくなりすぎないよう幅は480でクランプ)
const RADIUS_FRAC = [0.068, 0.089, 0.114, 0.145, 0.178, 0.215, 0.256];
const ZOMBIE_RADIUS_FRAC = 0.09;

// 合体時の得点(tier iの2匹を合体させたとき)。最後はらいおん消しのボーナス
export const MERGE_SCORE = [10, 20, 40, 80, 160, 320, 1000];
export const ZOMBIE_CLEAR_SCORE = 50;

export const MERGE_DROP_TIERS = 3; // 落とせるのは最初の3種類(いぬ/ぱんだ/ねこ)
const DROP_WEIGHTS = [0.45, 0.35, 0.2]; // 小さい動物ほど出やすい
export const MERGE_COOLDOWN = 0.55; // 連続で落とせる間隔(秒)

const ZOMBIE_EVERY: [number, number] = [4, 7]; // 何回落とすごとにゾンビが混ざるか(序盤)
const ZOMBIE_HIT_RANGE = 30; // 合体地点からこの余裕まで届けばダメージ
const LION_BLAST_SCALE = 1.6; // らいおん爆発の範囲(らいおん半径×これ)

// 時間経過のエスカレーション: 長く続けるほどゾンビが増え、しぶとくなる。
// 「うまく回せば一生続く」を防ぐための実質的な時間制限
const ZOMBIE_RAMP_TIME = 180; // この秒数かけてゾンビの出現間隔が最短まで縮む
const ZOMBIE_EVERY_MIN_SCALE = 0.4; // 終盤の出現間隔倍率(4〜7回→約2〜3回に1回)
const ZOMBIE_HP_EVERY = 90; // この秒数ごとにゾンビの耐久+1
const ZOMBIE_HP_MAX = 4;

function zombieHp(elapsed: number): number {
  return Math.min(ZOMBIE_HP_MAX, 2 + Math.floor(elapsed / ZOMBIE_HP_EVERY));
}

function zombieEveryScale(elapsed: number): number {
  return Math.max(ZOMBIE_EVERY_MIN_SCALE, 1 - (elapsed / ZOMBIE_RAMP_TIME) * (1 - ZOMBIE_EVERY_MIN_SCALE));
}

const HUNGER_LIMIT: [number, number] = [6, 11]; // 動物が怒り出すまでの秒数(ランダム)
const ZOMBIE_HUNGER: [number, number] = [2, 4]; // ゾンビはすぐ暴れ出す
const HOP_INTERVAL: [number, number] = [0.9, 1.8]; // 怒った子が跳ねる間隔

const GRAVITY = 2000; // px/s²
const RESTITUTION = 0.14; // 跳ね返り(小さめ=もっちり積み上がる)
const AIR_DRAG = 0.12; // 空気抵抗(/s)
const FLOOR_FRICTION = 2.8; // 床の横摩擦(/s)
const SUBSTEPS = 3; // 物理の分割ステップ(すり抜け防止)
const ITERATIONS = 3; // 衝突解決の反復(積み上げの安定性)
const SETTLE_GRACE = 1.1; // 落下直後はゲームオーバー判定しない猶予(秒)
const DANGER_LIMIT = 1.8; // ラインより上に居座れる秒数(超えたらゲームオーバー)

function rand([lo, hi]: [number, number]): number {
  return lo + Math.random() * (hi - lo);
}

export interface MergeLayout {
  width: number;
  height: number;
  left: number; // 壁の内側x
  right: number;
  floorY: number; // 床(ボールの下端がここまで)
  topY: number; // デンジャーライン(ここより上に積み上がるとゲームオーバー)
}

export function createMergeLayout(width: number, height: number): MergeLayout {
  return {
    width,
    height,
    left: 12,
    right: width - 12,
    floorY: height - 92, // 下は進化チェーン表示のスペース
    topY: 168, // 上はスコアバー+落とすスペース
  };
}

export function mergeRadius(layout: MergeLayout, tier: number): number {
  const frac = tier === ZOMBIE_TIER ? ZOMBIE_RADIUS_FRAC : RADIUS_FRAC[tier];
  return frac * Math.min(layout.width, 480);
}

export interface MergeBall {
  id: number;
  tier: number; // 0..6(MERGE_CHAINのindex)、ゾンビはZOMBIE_TIER
  kind: 'animal' | 'zombie';
  hp: number; // ゾンビの残り耐久(動物は1)
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dropT: number; // フィールドに入ってからの秒数(空腹とゲームオーバー猶予に使う)
  hungerLimit: number; // これを超えるとおなかがすいて暴れ出す
  hopT: number; // 次に跳ねるまでの秒数(怒っているあいだ使う)
  flashT: number; // 合体・被弾のフラッシュ演出の残り時間
  dead: boolean;
}

// おなかがすいて怒っているか(描画の「!」マークにも使う)
export function isHungry(ball: MergeBall): boolean {
  return ball.dropT > ball.hungerLimit;
}

export interface MergeState {
  balls: MergeBall[];
  particles: Particle[];
  score: number;
  bestTier: number; // これまでに作った最高の動物
  lions: number; // らいおん同士で消した回数
  zombiesCleared: number; // 退治したゾンビの数
  drops: number; // 落とした数
  current: number; // いま持っている動物のtier(ゾンビのこともある)
  next: number; // その次に来る動物のtier
  zombieIn: number; // あと何回落とすとゾンビが混ざるか
  cooldown: number; // 次に落とせるまでの秒数
  dangerT: number; // ラインより上に積み上がっている継続秒数
  over: boolean;
  shakeT: number;
  elapsed: number;
  nextId: number;
}

function randomDropTier(): number {
  const roll = Math.random();
  let acc = 0;
  for (let i = 0; i < MERGE_DROP_TIERS; i++) {
    acc += DROP_WEIGHTS[i];
    if (roll < acc) return i;
  }
  return 0;
}

export function createMergeState(): MergeState {
  return {
    balls: [],
    particles: [],
    score: 0,
    bestTier: 0,
    lions: 0,
    zombiesCleared: 0,
    drops: 0,
    current: randomDropTier(),
    next: randomDropTier(),
    zombieIn: Math.round(rand(ZOMBIE_EVERY)),
    cooldown: 0,
    dangerT: 0,
    over: false,
    shakeT: 0,
    elapsed: 0,
    nextId: 1,
  };
}

function makeBall(state: MergeState, layout: MergeLayout, tier: number, x: number, y: number): MergeBall {
  const zombie = tier === ZOMBIE_TIER;
  return {
    id: state.nextId++,
    tier,
    kind: zombie ? 'zombie' : 'animal',
    hp: zombie ? zombieHp(state.elapsed) : 1,
    x,
    y,
    vx: 0,
    vy: 0,
    r: mergeRadius(layout, tier),
    dropT: 0,
    hungerLimit: rand(zombie ? ZOMBIE_HUNGER : HUNGER_LIMIT),
    hopT: rand(HOP_INTERVAL),
    flashT: 0,
    dead: false,
  };
}

// いま持っている動物を落とす。落とせたらtrue
export function dropMergeBall(state: MergeState, layout: MergeLayout, x: number): boolean {
  if (state.over || state.cooldown > 0) return false;
  const tier = state.current;
  const r = mergeRadius(layout, tier);
  const ball = makeBall(
    state,
    layout,
    tier,
    Math.min(Math.max(x, layout.left + r), layout.right - r),
    dropGuideY(layout, r),
  );
  ball.vy = 60; // 置いた感を出す初速
  state.balls.push(ball);
  state.drops++;
  state.current = state.next;
  // 次の動物を決める。カウントが尽きたらはらぺこゾンビが混ざる
  state.zombieIn--;
  if (state.zombieIn <= 0) {
    state.next = ZOMBIE_TIER;
    // 時間が経つほど間隔が縮む(最低2回に1回)
    state.zombieIn = Math.max(2, Math.round(rand(ZOMBIE_EVERY) * zombieEveryScale(state.elapsed)));
  } else {
    state.next = randomDropTier();
  }
  state.cooldown = MERGE_COOLDOWN;
  return true;
}

// 落とす前のガイド位置(デンジャーラインの少し上に浮かせる)
export function dropGuideY(layout: MergeLayout, r: number): number {
  return layout.topY - r - 10;
}

export interface MergeEvents {
  mergedTier: number; // このフレームで合体した最高tier(なければ-1)
  lionBlast: boolean; // らいおん同士が消えた
  zombieDown: boolean; // ゾンビを退治した
  gameOver: boolean;
}

const MERGE_BURST_COLORS = ['#FFD700', '#FF7043', '#FFF176', '#CE93D8'];
const ZOMBIE_BURST_COLORS = ['#9E9E9E', '#616161', '#AED581'];

function spawnBurst(state: MergeState, x: number, y: number, r: number, colors: string[]) {
  const n = Math.min(14, 8 + Math.floor(r / 10));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 90 + Math.random() * 160;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      age: 0,
      life: 0.4 + Math.random() * 0.3,
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

// 合体地点の近くのゾンビにダメージを与える(らいおん爆発は即退治)
function damageZombies(
  state: MergeState,
  x: number,
  y: number,
  range: number,
  instant: boolean,
  events: MergeEvents,
) {
  for (const z of state.balls) {
    if (z.dead || z.kind !== 'zombie') continue;
    if (Math.hypot(z.x - x, z.y - y) > range + z.r) continue;
    z.hp = instant ? 0 : z.hp - 1;
    z.flashT = 0.25;
    if (z.hp <= 0) {
      z.dead = true;
      state.zombiesCleared++;
      state.score += ZOMBIE_CLEAR_SCORE;
      spawnBurst(state, z.x, z.y, z.r, ZOMBIE_BURST_COLORS);
      events.zombieDown = true;
    }
  }
}

// 2匹を合体させる。らいおん同士は消滅+ボーナス+爆発でゾンビ一掃
function mergePair(state: MergeState, layout: MergeLayout, a: MergeBall, b: MergeBall, events: MergeEvents) {
  a.dead = true;
  b.dead = true;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  state.score += MERGE_SCORE[a.tier];
  spawnBurst(state, mx, my, a.r, MERGE_BURST_COLORS);

  if (a.tier >= MERGE_TIERS - 1) {
    // らいおん×らいおん: 消滅ボーナス+爆発は範囲内のゾンビをまとめて退治
    state.lions++;
    state.shakeT = 0.4;
    events.lionBlast = true;
    damageZombies(state, mx, my, a.r * LION_BLAST_SCALE, true, events);
    return;
  }

  const tier = a.tier + 1;
  const r = mergeRadius(layout, tier);
  state.bestTier = Math.max(state.bestTier, tier);
  events.mergedTier = Math.max(events.mergedTier, tier);
  const merged = makeBall(
    state,
    layout,
    tier,
    Math.min(Math.max(mx, layout.left + r), layout.right - r),
    Math.min(my, layout.floorY - r),
  );
  merged.vx = (a.vx + b.vx) / 2;
  merged.vy = Math.min((a.vy + b.vy) / 2, 0); // 少し浮かせて弾む感じに
  merged.flashT = 0.25;
  state.balls.push(merged);
  // 合体の衝撃で近くのゾンビにダメージ
  damageZombies(state, mx, my, r + ZOMBIE_HIT_RANGE, false, events);
}

// 壁・床との衝突
function collideWalls(layout: MergeLayout, ball: MergeBall) {
  if (ball.x - ball.r < layout.left) {
    ball.x = layout.left + ball.r;
    ball.vx = Math.abs(ball.vx) * RESTITUTION * 2;
  } else if (ball.x + ball.r > layout.right) {
    ball.x = layout.right - ball.r;
    ball.vx = -Math.abs(ball.vx) * RESTITUTION * 2;
  }
  if (ball.y + ball.r > layout.floorY) {
    ball.y = layout.floorY - ball.r;
    ball.vy = -Math.abs(ball.vy) * RESTITUTION;
    if (Math.abs(ball.vy) < 20) ball.vy = 0; // 小さなバウンドは止める
  }
}

// 1物理ステップ: 重力→移動→衝突解決(+同じ動物は合体)
function physicsStep(state: MergeState, layout: MergeLayout, h: number, events: MergeEvents) {
  const balls = state.balls;
  for (const ball of balls) {
    if (ball.dead) continue;
    ball.vy += GRAVITY * h;
    ball.vx *= Math.max(0, 1 - AIR_DRAG * h);
    // 床に接しているあいだは横方向も減速(ころころ転がり続けないように)
    if (ball.y + ball.r >= layout.floorY - 0.5) ball.vx *= Math.max(0, 1 - FLOOR_FRICTION * h);
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    collideWalls(layout, ball);
  }

  // ボール同士: 同じ動物は合体、それ以外(ゾンビ含む)は押し合い(質量は面積比)
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.dead) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist) continue;

        if (a.kind === 'animal' && a.tier === b.tier && iter === 0) {
          mergePair(state, layout, a, b, events);
          break; // aは消えたので次のiへ
        }

        const dist = Math.max(Math.sqrt(distSq), 0.01);
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const ma = a.r * a.r;
        const mb = b.r * b.r;
        const total = ma + mb;
        // 位置補正(重い方が動かない)
        const push = overlap * 0.8;
        a.x -= nx * push * (mb / total);
        a.y -= ny * push * (mb / total);
        b.x += nx * push * (ma / total);
        b.y += ny * push * (ma / total);
        // 速度の反発(近づいているときだけ)
        const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rvn < 0) {
          const imp = (-(1 + RESTITUTION) * rvn) / (1 / ma + 1 / mb);
          a.vx -= (imp / ma) * nx;
          a.vy -= (imp / ma) * ny;
          b.vx += (imp / mb) * nx;
          b.vy += (imp / mb) * ny;
        }
        collideWalls(layout, a);
        collideWalls(layout, b);
      }
    }
  }
  state.balls = state.balls.filter((ball) => !ball.dead);
}

// おなかすき暴れ: 怒った子はときどき跳ねてタワーを揺らす(ほぼ静止しているときだけ)
function stepHunger(state: MergeState, dt: number) {
  for (const ball of state.balls) {
    if (ball.dead || !isHungry(ball)) continue;
    ball.hopT -= dt;
    if (ball.hopT > 0) continue;
    ball.hopT = rand(HOP_INTERVAL);
    if (Math.abs(ball.vy) > 40) continue; // 落下・バウンド中は跳ねない
    ball.vy = -(240 + Math.random() * 180);
    ball.vx += (Math.random() - 0.5) * 260;
  }
}

// 毎フレーム呼ぶ。dtは呼び出し側で上限を掛けておくこと
export function stepMerge(state: MergeState, layout: MergeLayout, dt: number): MergeEvents {
  const events: MergeEvents = { mergedTier: -1, lionBlast: false, zombieDown: false, gameOver: false };
  if (state.over) return events;

  state.elapsed += dt;
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.shakeT = Math.max(0, state.shakeT - dt);

  for (const ball of state.balls) {
    ball.dropT += dt;
    ball.flashT = Math.max(0, ball.flashT - dt);
  }
  stepHunger(state, dt);

  const h = dt / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) physicsStep(state, layout, h, events);

  // パーティクル
  for (const p of state.particles) {
    p.age += dt;
    p.vy += 700 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.particles = state.particles.filter((p) => p.age < p.life);

  // ゲームオーバー判定: 落ち着いたボールがデンジャーラインより上に居座り続けたら終了
  const anyAbove = state.balls.some((b) => b.dropT > SETTLE_GRACE && b.y - b.r < layout.topY);
  state.dangerT = anyAbove ? state.dangerT + dt : Math.max(0, state.dangerT - dt);
  if (state.dangerT >= DANGER_LIMIT) {
    state.over = true;
    events.gameOver = true;
  }

  return events;
}
