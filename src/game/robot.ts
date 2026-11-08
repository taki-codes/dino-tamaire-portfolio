// 闘魂ロボットバトル: ビーダマで自陣の操作パネルを撃つと、ロボット(動物)が
// 対応する攻撃をくり出す対戦モード。相手のHPを先に0にすれば勝ち、
// 時間切れなら残りHPが多いほうの勝ち。
// パネルは撃つたびに配置がランダムに入れかわる(原作リスペクト)。
import { BALL_RADIUS, PARTICLE_MAX, WALL_BOUNCE } from '../constants';
import { Aim, AnimalId, CpuLevel, Layout, Notice, Particle, PlayerId } from '../types';
import { survivalLevel } from './cpu';
import { gravityFor, launchVelocity } from './physics';

export type RobotPanelKind = 'punch' | 'kick' | 'green' | 'blue' | 'special' | 'guard';
export type RobotAttackKind = Exclude<RobotPanelKind, 'guard'>;

export const ROBOT_MAX_HP = 150; // 既定HP(実際の試合は設定のgetRobotHp()を渡す)
export const ROBOT_DURATION = 120; // 通常戦の制限時間(秒)。原作と同じ2分
export const ROBOT_SURVIVAL_DURATION = 60; // かちぬきは短期決戦
export const ROBOT_SURVIVAL_HEAL = 35; // 勝ち抜き時のHP回復量
export const ROBOT_COOLDOWN_MS = 550; // ビーダマの発射クールダウン
export const PANEL_HIT_R = 34; // ビーダマがパネルに当たる距離
export const PANEL_SIZE = 60; // パネルの見た目サイズ(正方形)
const GUARD_DURATION = 1.8; // ガード姿勢の持続時間
const GUARD_FACTOR = 0.5; // ガード中に受けるダメージ倍率
const COUNTER_FACTOR = 0.5; // カウンターで相手に返すダメージ倍率
const PROJECTILE_SPEED = 380; // ビーダマ攻撃(緑/青)の弾速
const BALL_MAX_AGE = 3; // 操作用ビーダマの寿命(秒)
const NOTICE_T = 1.6;

// パネル定義。costが負の値は「撃つとゲージがたまる」
export interface RobotPanelSpec {
  emoji: string;
  nameJa: string;
  sub: string; // パネルに書く小さな説明(ため/⚡消費)
  color: string;
  cost: number; // 必要B魂ゲージ(0..1)。負ならためる
  dmg: number;
  windup: number; // ふりかぶり時間(この間ガード/カウンターできる)
  projectile?: boolean; // 玉を飛ばす遠距離攻撃か
}

export const PANEL_INFO: Record<RobotPanelKind, RobotPanelSpec> = {
  punch: { emoji: '👊', nameJa: 'パンチ', sub: 'ゲージ+', color: '#FF7043', cost: -0.25, dmg: 6, windup: 0.55 },
  kick: { emoji: '🦵', nameJa: 'キック', sub: 'キック⚡', color: '#FFA726', cost: 0.05, dmg: 10, windup: 0.65 },
  green: { emoji: '🟢', nameJa: 'ビーダマ', sub: 'たま⚡', color: '#66BB6A', cost: 0.18, dmg: 9, windup: 0.6, projectile: true },
  blue: { emoji: '🔵', nameJa: 'つよビーダマ', sub: 'つよい⚡⚡', color: '#42A5F5', cost: 0.4, dmg: 18, windup: 0.85, projectile: true },
  special: { emoji: '💎', nameJa: 'ひっさつ', sub: 'ゲージMAX', color: '#ECEFF1', cost: 1, dmg: 0, windup: 0.9 },
  guard: { emoji: '🛡️', nameJa: 'ガード', sub: 'まもる', color: '#90A4AE', cost: 0.06, dmg: 0, windup: 0 },
};

export const PANEL_KINDS: RobotPanelKind[] = ['punch', 'kick', 'green', 'blue', 'special', 'guard'];

// キャラクターごとの必殺技(💎パネル、ゲージ満タンで発動)
export interface RobotSpecialSpec {
  name: string;
  desc: string;
  dmg: number;
  windup?: number; // 未指定ならPANEL_INFO.special.windup
  heal?: number; // 自分のHP回復
  stun?: number; // 相手をしびれさせる秒数(パネル操作不能)
  drain?: number; // 相手のゲージを減らす量
  pierce?: boolean; // ガード貫通
}

export const ROBOT_SPECIALS: Record<AnimalId, RobotSpecialSpec> = {
  dog: { name: 'くんくんラッシュ', desc: 'においで追いつめる連続パンチ!', dmg: 26 },
  panda: { name: 'ころころプレス', desc: '大玉プレス! 相手のゲージも減らす!', dmg: 24, drain: 0.4 },
  cat: { name: 'ねこパンチらんぶ', desc: '相手はしびれてうごけない!', dmg: 22, stun: 2.5 },
  rabbit: { name: 'ぴょんぴょんキック', desc: '超スピードでよけられない!', dmg: 26, windup: 0.5 },
  turtle: { name: 'こうらクラッシュ', desc: 'こうげきしながら体力かいふく!', dmg: 20, heal: 14 },
  bear: { name: 'パワーボンバー', desc: 'ちょっとおそいが超強力!', dmg: 34, windup: 1.15 },
  lion: { name: 'おうさまビーム', desc: 'ガードをつらぬく王の一撃!', dmg: 28, pierce: true },
};

export interface RobotPanel {
  kind: RobotPanelKind;
  x: number;
  y: number;
  flashT: number; // 被弾フラッシュの残り時間
}

// プレイヤーが撃つ操作用ビーダマ
export interface RobotBall {
  id: number;
  owner: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  dead: boolean;
}

// ロボットが撃つ攻撃弾(緑/青)
export interface RobotProjectile {
  id: number;
  owner: PlayerId; // 撃った側
  kind: 'green' | 'blue';
  x: number;
  y: number;
  dmg: number;
  dead: boolean;
}

// 浮かび上がるダメージ数字
export interface DamagePop {
  id: number;
  x: number;
  y: number;
  amount: number;
  defender: PlayerId;
  age: number;
}

export interface RobotFighter {
  animal: AnimalId;
  hp: number;
  gauge: number; // B魂ゲージ(0..1)
  attack: { kind: RobotAttackKind; t: number; windup: number; seq: number } | null;
  strikeT: number; // 攻撃ヒット時の踏み込み演出
  guardT: number; // ガード姿勢の残り時間
  stunT: number; // しびれ(ねこ必殺)の残り時間
  hitT: number; // 被弾フラッシュ
  specialFlashT: number; // 必殺技バナー・演出の残り時間
}

export interface RobotState {
  elapsed: number;
  duration: number;
  timeLeft: number;
  maxHp: number; // 設定で変えられる(HPバーの割合表示・回復の上限に使う)
  over: boolean;
  winner: PlayerId | 0 | null; // 0=引き分け
  timeUp: boolean; // 時間切れ決着か(KO演出と出し分ける)
  koT: number; // 決着演出の残り時間(0になったらリザルトへ)
  p1: RobotFighter;
  p2: RobotFighter;
  panels1: RobotPanel[];
  panels2: RobotPanel[];
  balls: RobotBall[];
  projectiles: RobotProjectile[];
  particles: Particle[];
  pops: DamagePop[];
  notice1: Notice | null;
  notice2: Notice | null;
  shots1: number;
  shots2: number;
  shakeT: number;
  nextId: number;
}

export interface RobotEvents {
  panelHit: boolean; // パネルに当たった(有効無効問わず)
  attackStart: boolean; // ふりかぶり開始
  damaged: boolean; // ダメージが入った
  counter: boolean;
  guard: boolean; // ガード姿勢をとった
  special: boolean; // 必殺技が炸裂した
  ko: boolean;
  timeUp: boolean;
}

function emptyEvents(): RobotEvents {
  return {
    panelHit: false,
    attackStart: false,
    damaged: false,
    counter: false,
    guard: false,
    special: false,
    ko: false,
    timeUp: false,
  };
}

function rand([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

function other(owner: PlayerId): PlayerId {
  return owner === 1 ? 2 : 1;
}

function fighter(s: RobotState, owner: PlayerId): RobotFighter {
  return owner === 1 ? s.p1 : s.p2;
}

export function robotPanels(s: RobotState, owner: PlayerId): RobotPanel[] {
  return owner === 1 ? s.panels1 : s.panels2;
}

// パネル6枚とロボットの立ち位置。ロボットは中央ライン近くで向かい合う
export function robotPositions(layout: Layout) {
  const { width, height, centerY } = layout;
  const cx = width / 2;
  const u = Math.min(width * 0.105, 42);
  // 奥の列(中央寄り)は4枚、手前の列(発射台寄り)は2枚。
  // 同じxに縦へ並べると手前が奥をかくしてしまうので互い違いにする
  const far1 = layout.launcher1.y - height * 0.195;
  const near1 = layout.launcher1.y - height * 0.115;
  const far2 = layout.launcher2.y + height * 0.195;
  const near2 = layout.launcher2.y + height * 0.115;
  const xs4 = [cx - 3 * u, cx - u, cx + u, cx + 3 * u];
  const xs2 = [cx - 3 * u, cx + 3 * u];
  return {
    slots1: [...xs4.map((x) => ({ x, y: far1 })), ...xs2.map((x) => ({ x, y: near1 }))],
    slots2: [...xs4.map((x) => ({ x, y: far2 })), ...xs2.map((x) => ({ x, y: near2 }))],
    robot1: { x: cx, y: centerY + height * 0.085 },
    robot2: { x: cx, y: centerY - height * 0.085 },
  };
}

function shuffledKinds(): RobotPanelKind[] {
  const kinds = [...PANEL_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return kinds;
}

// パネルの技を配置ごと入れかえる(位置は固定スロット、中身をシャッフル)
function shufflePanels(panels: RobotPanel[]): void {
  const kinds = shuffledKinds();
  panels.forEach((p, i) => {
    p.kind = kinds[i];
  });
}

function createFighter(animal: AnimalId, hp: number): RobotFighter {
  return {
    animal,
    hp,
    gauge: 0,
    attack: null,
    strikeT: 0,
    guardT: 0,
    stunT: 0,
    hitT: 0,
    specialFlashT: 0,
  };
}

export function createRobotState(
  layout: Layout,
  p1Animal: AnimalId,
  p2Animal: AnimalId,
  duration: number,
  maxHp = ROBOT_MAX_HP,
  p1Hp = maxHp,
): RobotState {
  const pos = robotPositions(layout);
  const kinds1 = shuffledKinds();
  const kinds2 = shuffledKinds();
  return {
    elapsed: 0,
    duration,
    timeLeft: duration,
    maxHp,
    over: false,
    winner: null,
    timeUp: false,
    koT: 0,
    p1: createFighter(p1Animal, Math.min(p1Hp, maxHp)),
    p2: createFighter(p2Animal, maxHp),
    panels1: pos.slots1.map((sl, i) => ({ kind: kinds1[i], x: sl.x, y: sl.y, flashT: 0 })),
    panels2: pos.slots2.map((sl, i) => ({ kind: kinds2[i], x: sl.x, y: sl.y, flashT: 0 })),
    balls: [],
    projectiles: [],
    particles: [],
    pops: [],
    notice1: null,
    notice2: null,
    shots1: 0,
    shots2: 0,
    shakeT: 0,
    nextId: 1,
  };
}

function setNotice(s: RobotState, owner: PlayerId, text: string): void {
  const n: Notice = { text, t: NOTICE_T };
  if (owner === 1) s.notice1 = n;
  else s.notice2 = n;
}

// 操作用ビーダマの発射(既存のスリングショットと同じ手触り)
export function fireRobotBall(s: RobotState, layout: Layout, owner: PlayerId, aim: Aim): boolean {
  if (s.over) return false;
  const vel = launchVelocity(owner, aim);
  if (!vel) return false;
  const pos = owner === 1 ? layout.launcher1 : layout.launcher2;
  s.balls.push({
    id: s.nextId++,
    owner,
    x: pos.x,
    y: pos.y,
    vx: vel.vx,
    vy: vel.vy,
    age: 0,
    dead: false,
  });
  if (owner === 1) s.shots1++;
  else s.shots2++;
  return true;
}

function spawnBurst(s: RobotState, x: number, y: number, color: string, count = 12): void {
  for (let i = 0; i < count && s.particles.length < PARTICLE_MAX; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 220;
    s.particles.push({
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      age: 0,
      life: 0.4 + Math.random() * 0.4,
      size: 3 + Math.random() * 4,
      color,
    });
  }
}

function attackDamage(f: RobotFighter): number {
  if (!f.attack) return 0;
  if (f.attack.kind === 'special') return ROBOT_SPECIALS[f.animal].dmg;
  return PANEL_INFO[f.attack.kind].dmg;
}

function applyDamage(
  s: RobotState,
  layout: Layout,
  defender: PlayerId,
  dmg: number,
  pierce: boolean,
  ev: RobotEvents,
): void {
  if (s.over) return;
  const f = fighter(s, defender);
  let d = dmg;
  if (f.guardT > 0 && !pierce) {
    d = Math.max(1, Math.ceil(dmg * GUARD_FACTOR));
    f.guardT = 0; // ガードは1回受けたら解除
    setNotice(s, defender, '🛡️ ガード! ダメージ半分!');
    ev.guard = true;
  }
  f.hp = Math.max(0, f.hp - d);
  f.hitT = 0.35;
  s.shakeT = 0.25;
  const pos = robotPositions(layout);
  const rp = defender === 1 ? pos.robot1 : pos.robot2;
  spawnBurst(s, rp.x, rp.y, defender === 1 ? '#FF8A80' : '#FFF176');
  s.pops.push({ id: s.nextId++, x: rp.x, y: rp.y - 40, amount: d, defender, age: 0 });
  ev.damaged = true;
  if (f.hp <= 0) {
    s.over = true;
    s.winner = other(defender);
    s.koT = 2.0;
    ev.ko = true;
  }
}

// パネルが撃たれたときの本処理(プレイヤーのビーダマ命中とCPUの両方から呼ぶ)
export function triggerPanel(
  s: RobotState,
  layout: Layout,
  owner: PlayerId,
  index: number,
  ev: RobotEvents,
): void {
  const panels = robotPanels(s, owner);
  const panel = panels[index];
  if (!panel || s.over) return;
  panel.flashT = 0.3;
  const me = fighter(s, owner);
  const oppId = other(owner);
  const opp = fighter(s, oppId);

  if (me.stunT > 0) {
    setNotice(s, owner, '💫 しびれてうごけない!');
    return;
  }

  const spec = PANEL_INFO[panel.kind];

  // ガード: 少しゲージを使って身がまえる
  if (panel.kind === 'guard') {
    if (me.gauge < spec.cost) {
      setNotice(s, owner, '⚡ ゲージがたりない!');
      return;
    }
    me.gauge -= spec.cost;
    me.guardT = GUARD_DURATION;
    ev.guard = true;
    setNotice(s, owner, '🛡️ ガード!');
    shufflePanels(panels);
    return;
  }

  const kind = panel.kind as RobotAttackKind;

  // カウンター: 相手がふりかぶっている技と同じパネルを撃つと打ち消して反撃!
  if (kind !== 'special' && opp.attack && opp.attack.kind === kind) {
    const reflect = Math.max(1, Math.ceil(attackDamage(opp) * COUNTER_FACTOR));
    opp.attack = null;
    ev.counter = true;
    setNotice(s, owner, '⚡ カウンター!');
    setNotice(s, oppId, '💦 カウンターされた!');
    applyDamage(s, layout, oppId, reflect, true, ev);
    shufflePanels(panels);
    return;
  }

  if (kind === 'special' && me.gauge < 1) {
    setNotice(s, owner, '💎 ゲージ満タンでひっさつ!');
    return;
  }
  if (me.gauge < spec.cost) {
    setNotice(s, owner, '⚡ ゲージがたりない!');
    return;
  }
  if (me.attack) return; // ふりかぶり中は次の技を出せない

  me.gauge = Math.min(1, Math.max(0, me.gauge - spec.cost));
  const sp = kind === 'special' ? ROBOT_SPECIALS[me.animal] : null;
  const windup = sp?.windup ?? spec.windup;
  me.attack = { kind, t: windup, windup, seq: s.nextId++ };
  ev.attackStart = true;
  shufflePanels(panels);
}

// ふりかぶり終了 → 攻撃が実際に出る
function resolveAttack(s: RobotState, layout: Layout, owner: PlayerId, ev: RobotEvents): void {
  const me = fighter(s, owner);
  const atk = me.attack;
  if (!atk || s.over) return;
  me.attack = null;
  me.strikeT = 0.3;
  const pos = robotPositions(layout);
  const myPos = owner === 1 ? pos.robot1 : pos.robot2;

  if (atk.kind === 'green' || atk.kind === 'blue') {
    // 遠距離: 弾を飛ばして着弾時にダメージ
    s.projectiles.push({
      id: s.nextId++,
      owner,
      kind: atk.kind,
      x: myPos.x,
      y: myPos.y,
      dmg: PANEL_INFO[atk.kind].dmg,
      dead: false,
    });
    return;
  }

  const oppId = other(owner);
  if (atk.kind === 'special') {
    const sp = ROBOT_SPECIALS[me.animal];
    me.specialFlashT = 1.4;
    ev.special = true;
    applyDamage(s, layout, oppId, sp.dmg, !!sp.pierce, ev);
    if (sp.heal) me.hp = Math.min(s.maxHp, me.hp + sp.heal);
    if (sp.stun) fighter(s, oppId).stunT = sp.stun;
    if (sp.drain) {
      const opp = fighter(s, oppId);
      opp.gauge = Math.max(0, opp.gauge - sp.drain);
    }
    return;
  }

  // パンチ・キック(近接)
  applyDamage(s, layout, oppId, PANEL_INFO[atk.kind].dmg, false, ev);
}

function decayFighter(f: RobotFighter, dt: number): void {
  f.strikeT = Math.max(0, f.strikeT - dt);
  f.hitT = Math.max(0, f.hitT - dt);
  f.specialFlashT = Math.max(0, f.specialFlashT - dt);
}

export function stepRobot(s: RobotState, layout: Layout, dt: number): RobotEvents {
  const ev = emptyEvents();
  s.elapsed += dt;

  // 演出まわりは決着後も進める
  decayFighter(s.p1, dt);
  decayFighter(s.p2, dt);
  for (const p of [...s.panels1, ...s.panels2]) p.flashT = Math.max(0, p.flashT - dt);
  for (const p of s.particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 500 * dt;
  }
  s.particles = s.particles.filter((p) => p.age < p.life);
  for (const p of s.pops) p.age += dt;
  s.pops = s.pops.filter((p) => p.age < 0.9);
  s.shakeT = Math.max(0, s.shakeT - dt);
  if (s.notice1 && (s.notice1.t -= dt) <= 0) s.notice1 = null;
  if (s.notice2 && (s.notice2.t -= dt) <= 0) s.notice2 = null;

  if (s.over) {
    s.koT = Math.max(0, s.koT - dt);
    return ev;
  }

  s.timeLeft = Math.max(0, s.duration - s.elapsed);
  s.p1.stunT = Math.max(0, s.p1.stunT - dt);
  s.p2.stunT = Math.max(0, s.p2.stunT - dt);
  s.p1.guardT = Math.max(0, s.p1.guardT - dt);
  s.p2.guardT = Math.max(0, s.p2.guardT - dt);

  // 操作用ビーダマ: 自陣のパネルに当たると技が出る
  for (const b of s.balls) {
    if (b.dead) continue;
    b.age += dt;
    b.vy += gravityFor(b.owner) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // 左右の壁で跳ね返る
    if (b.x < BALL_RADIUS) {
      b.x = BALL_RADIUS;
      b.vx = Math.abs(b.vx) * WALL_BOUNCE;
    } else if (b.x > layout.width - BALL_RADIUS) {
      b.x = layout.width - BALL_RADIUS;
      b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
    }
    // 中央ラインを越えたり寿命が来たら消える(相手のパネルは撃てない)
    const crossed = b.owner === 1 ? b.y < layout.centerY + 6 : b.y > layout.centerY - 6;
    const returned = b.owner === 1 ? b.y > layout.height + 30 : b.y < -30;
    if (crossed || returned || b.age > BALL_MAX_AGE) {
      b.dead = true;
      continue;
    }
    const panels = robotPanels(s, b.owner);
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      if (Math.hypot(b.x - p.x, b.y - p.y) < PANEL_HIT_R) {
        b.dead = true;
        ev.panelHit = true;
        triggerPanel(s, layout, b.owner, i, ev);
        break;
      }
    }
  }
  s.balls = s.balls.filter((b) => !b.dead);

  // ふりかぶり → 攻撃発動
  for (const owner of [1, 2] as const) {
    const f = fighter(s, owner);
    if (f.attack) {
      f.attack.t -= dt;
      if (f.attack.t <= 0) resolveAttack(s, layout, owner, ev);
    }
  }

  // 攻撃弾(緑/青): 相手ロボットへまっすぐ飛ぶ
  const pos = robotPositions(layout);
  for (const pr of s.projectiles) {
    if (pr.dead) continue;
    const targetY = pr.owner === 1 ? pos.robot2.y : pos.robot1.y;
    const dir = pr.owner === 1 ? -1 : 1;
    pr.y += dir * PROJECTILE_SPEED * dt;
    const arrived = pr.owner === 1 ? pr.y <= targetY : pr.y >= targetY;
    if (arrived) {
      pr.dead = true;
      applyDamage(s, layout, other(pr.owner), pr.dmg, false, ev);
    }
  }
  s.projectiles = s.projectiles.filter((p) => !p.dead);

  // 時間切れ: 残りHPが多いほうの勝ち
  if (s.timeLeft <= 0 && !s.over) {
    s.over = true;
    s.timeUp = true;
    s.winner = s.p1.hp > s.p2.hp ? 1 : s.p2.hp > s.p1.hp ? 2 : 0;
    s.koT = 1.8;
    ev.timeUp = true;
  }
  return ev;
}

// ---- CPU ----

export interface RobotCpuConfig {
  think: [number, number]; // 次の行動までの秒数
  miss: number; // パネルを外す(何も起きない)確率
  counter: number; // 相手のふりかぶりにカウンターを狙う確率
  guard: number; // カウンターしないときガードする確率
  reaction: [number, number]; // 反応の速さ(秒)
}

export const ROBOT_CPU_CONFIGS: Record<CpuLevel, RobotCpuConfig> = {
  turtle: { think: [1.8, 2.8], miss: 0.3, counter: 0.05, guard: 0.2, reaction: [0.35, 0.6] },
  rabbit: { think: [1.2, 1.9], miss: 0.15, counter: 0.15, guard: 0.35, reaction: [0.25, 0.45] },
  cat: { think: [0.8, 1.3], miss: 0.06, counter: 0.3, guard: 0.5, reaction: [0.15, 0.35] },
  lion: { think: [0.55, 0.95], miss: 0.02, counter: 0.5, guard: 0.65, reaction: [0.1, 0.25] },
};

// かちぬきサバイバル: 5人目以降はライオンがさらに強くなる
export function robotSurvivalCpuConfig(stage: number): RobotCpuConfig {
  const base = ROBOT_CPU_CONFIGS[survivalLevel(stage)];
  const over = Math.max(0, stage - 4);
  if (over === 0) return base;
  const k = Math.pow(0.88, over);
  return {
    think: [base.think[0] * k, base.think[1] * k],
    miss: base.miss * k,
    counter: Math.min(0.75, base.counter / k),
    guard: Math.min(0.8, base.guard / k),
    reaction: [base.reaction[0] * k, base.reaction[1] * k],
  };
}

export interface RobotCpuState {
  timer: number;
  // 撃つと決めたパネル。tが0になったら発動(この間UIに狙いのリングを出す)
  pending: { index: number; t: number; miss: boolean } | null;
  reactedTo: number; // 反応済みの相手攻撃のseq(同じ攻撃に二度反応しない)
}

export function createRobotCpuState(): RobotCpuState {
  return { timer: 1.6, pending: null, reactedTo: 0 };
}

// CPUの思考。パネルを「撃つ」動きはpending(狙い付け)→発動の2段階で見せる。
// 戻り値: このフレームで狙い付けを始めたか(発射音用)
export function stepRobotCpu(
  cpu: RobotCpuState,
  cfg: RobotCpuConfig,
  s: RobotState,
  layout: Layout,
  dt: number,
  ev: RobotEvents,
): boolean {
  if (s.over) return false;
  const me = s.p2;

  // 狙い付け中: 時間が来たら撃つ(missなら空振り)
  if (cpu.pending) {
    cpu.pending.t -= dt;
    if (cpu.pending.t <= 0) {
      if (!cpu.pending.miss) {
        ev.panelHit = true;
        triggerPanel(s, layout, 2, cpu.pending.index, ev);
      }
      cpu.pending = null;
      cpu.timer = rand(cfg.think);
    }
    return false;
  }

  const findPanel = (kind: RobotPanelKind) => s.panels2.findIndex((p) => p.kind === kind);

  // 相手のふりかぶりに反応(攻撃1回につき1度だけ)
  const oppAtk = s.p1.attack;
  if (oppAtk && oppAtk.seq !== cpu.reactedTo && me.stunT <= 0 && !me.attack) {
    cpu.reactedTo = oppAtk.seq;
    const roll = Math.random();
    if (roll < cfg.counter && oppAtk.kind !== 'special') {
      const idx = findPanel(oppAtk.kind);
      if (idx >= 0) {
        cpu.pending = { index: idx, t: rand(cfg.reaction), miss: Math.random() < cfg.miss };
        return true;
      }
    } else if (roll < cfg.counter + cfg.guard && me.gauge >= PANEL_INFO.guard.cost) {
      const idx = findPanel('guard');
      if (idx >= 0) {
        cpu.pending = { index: idx, t: rand(cfg.reaction), miss: Math.random() < cfg.miss };
        return true;
      }
    }
  }

  cpu.timer -= dt;
  if (cpu.timer > 0) return false;
  if (me.attack || me.stunT > 0) {
    cpu.timer = 0.3;
    return false;
  }

  // 技選び: ゲージ満タンなら必殺、たまっていれば強い技、なければパンチでためる
  let kind: RobotPanelKind;
  if (me.gauge >= 1) kind = 'special';
  else if (me.gauge >= PANEL_INFO.blue.cost && Math.random() < 0.45) kind = 'blue';
  else if (me.gauge >= PANEL_INFO.green.cost && Math.random() < 0.5) kind = 'green';
  else if (me.gauge >= PANEL_INFO.kick.cost && Math.random() < 0.45) kind = 'kick';
  else kind = 'punch';

  const idx = findPanel(kind);
  if (idx < 0) {
    cpu.timer = 0.3;
    return false;
  }
  cpu.pending = { index: idx, t: 0.35, miss: Math.random() < cfg.miss };
  return true;
}
