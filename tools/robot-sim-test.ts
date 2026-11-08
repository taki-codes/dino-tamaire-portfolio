// 闘魂ロボットバトルのロジック簡易シミュレーション(node実行用、コミット不要の動作確認)
import {
  PANEL_INFO,
  ROBOT_CPU_CONFIGS,
  ROBOT_MAX_HP,
  RobotEvents,
  createRobotCpuState,
  createRobotState,
  fireRobotBall,
  robotPanels,
  stepRobot,
  stepRobotCpu,
  triggerPanel,
} from '../src/game/robot';
import { Layout } from '../src/types';

const layout: Layout = {
  width: 390,
  height: 800,
  centerY: 400,
  launcher1: { x: 195, y: 700 },
  launcher2: { x: 195, y: 100 },
};

function ev(): RobotEvents {
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

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('ok:', msg);
  }
}

function findIdx(s: ReturnType<typeof createRobotState>, owner: 1 | 2, kind: string) {
  return robotPanels(s, owner).findIndex((p) => p.kind === kind);
}

// 1. パンチ: ゲージがたまり、ふりかぶり後にダメージ
{
  const s = createRobotState(layout, 'dog', 'cat', 120);
  const e = ev();
  triggerPanel(s, layout, 1, findIdx(s, 1, 'punch'), e);
  assert(e.attackStart, 'パンチでふりかぶり開始');
  assert(Math.abs(s.p1.gauge - 0.25) < 1e-9, `パンチでゲージ+0.25 (実際 ${s.p1.gauge})`);
  for (let i = 0; i < 60; i++) stepRobot(s, layout, 1 / 60);
  assert(s.p2.hp === ROBOT_MAX_HP - PANEL_INFO.punch.dmg, `パンチのダメージ (p2.hp=${s.p2.hp})`);
}

// 2. ゲージ不足の技は出ない
{
  const s = createRobotState(layout, 'dog', 'cat', 120);
  const e = ev();
  triggerPanel(s, layout, 1, findIdx(s, 1, 'blue'), e);
  assert(!e.attackStart && s.p1.attack === null, 'ゲージ0で青玉は撃てない');
}

// 3. ガード: ダメージ半分
{
  const s = createRobotState(layout, 'dog', 'cat', 120);
  s.p1.gauge = 0.5;
  s.p2.gauge = 0.5;
  const e = ev();
  triggerPanel(s, layout, 2, findIdx(s, 2, 'kick'), e); // P2がキック(10dmg)
  triggerPanel(s, layout, 1, findIdx(s, 1, 'guard'), e); // P1がガード
  assert(s.p1.guardT > 0, 'ガード姿勢');
  for (let i = 0; i < 60; i++) stepRobot(s, layout, 1 / 60);
  assert(s.p1.hp === ROBOT_MAX_HP - 5, `ガードでキック半減 (p1.hp=${s.p1.hp})`);
}

// 4. カウンター: 同じパネルで打ち消し+反撃
{
  const s = createRobotState(layout, 'dog', 'cat', 120);
  const e = ev();
  triggerPanel(s, layout, 2, findIdx(s, 2, 'punch'), e); // P2がパンチふりかぶり
  const e2 = ev();
  triggerPanel(s, layout, 1, findIdx(s, 1, 'punch'), e2); // P1が同じパネル
  assert(e2.counter, 'カウンター発生');
  assert(s.p2.attack === null, '相手の攻撃が打ち消される');
  assert(s.p2.hp === ROBOT_MAX_HP - 3, `カウンター反撃3ダメージ (p2.hp=${s.p2.hp})`);
  assert(s.p1.hp === ROBOT_MAX_HP, 'P1は無傷');
}

// 5. 必殺技(かめ=回復つき)
{
  const s = createRobotState(layout, 'turtle', 'cat', 120);
  s.p1.gauge = 1;
  s.p1.hp = 50;
  const e = ev();
  triggerPanel(s, layout, 1, findIdx(s, 1, 'special'), e);
  assert(e.attackStart, '必殺ふりかぶり');
  for (let i = 0; i < 90; i++) stepRobot(s, layout, 1 / 60);
  assert(s.p2.hp === ROBOT_MAX_HP - 20, `こうらクラッシュ20ダメージ (p2.hp=${s.p2.hp})`);
  assert(s.p1.hp === 64, `かめは14回復 (p1.hp=${s.p1.hp})`);
  assert(s.p1.gauge === 0, 'ゲージ消費');
}

// 6. 遠距離(緑)が飛んで当たる
{
  const s = createRobotState(layout, 'dog', 'cat', 120);
  s.p1.gauge = 0.3;
  const e = ev();
  triggerPanel(s, layout, 1, findIdx(s, 1, 'green'), e);
  let hit = false;
  for (let i = 0; i < 180; i++) {
    const r = stepRobot(s, layout, 1 / 60);
    if (r.damaged) hit = true;
  }
  assert(hit && s.p2.hp === ROBOT_MAX_HP - PANEL_INFO.green.dmg, `緑玉が着弾 (p2.hp=${s.p2.hp})`);
}

// 7. KO判定
{
  const s = createRobotState(layout, 'dog', 'cat', 120);
  s.p2.hp = 5;
  const e = ev();
  triggerPanel(s, layout, 1, findIdx(s, 1, 'punch'), e);
  let ko = false;
  for (let i = 0; i < 60; i++) if (stepRobot(s, layout, 1 / 60).ko) ko = true;
  assert(ko && s.over && s.winner === 1, `KOでP1勝利 (winner=${s.winner})`);
}

// 8. 時間切れ: HPが多いほうの勝ち
{
  const s = createRobotState(layout, 'dog', 'cat', 5);
  s.p2.hp = 40;
  for (let i = 0; i < 6 * 60; i++) stepRobot(s, layout, 1 / 60);
  assert(s.over && s.timeUp && s.winner === 1, `時間切れでHP勝ち (winner=${s.winner})`);
}

// 9. ビーダマ発射→パネル命中(上向きに撃つ)
{
  const s = createRobotState(layout, 'dog', 'cat', 120);
  const panel = robotPanels(s, 1)[0]; // 奥の列の左端
  // 弾道を逆算: 飛行時間Tでパネルに届く初速(重力900px/s^2)
  const T = 0.35;
  const vy = (panel.y - layout.launcher1.y - 0.5 * 900 * T * T) / T;
  const vx = (panel.x - layout.launcher1.x) / T;
  const okFire = fireRobotBall(s, layout, 1, { dx: -vx / 7, dy: -vy / 7 });
  assert(okFire && s.balls.length === 1 && s.shots1 === 1, 'ビーダマ発射');
  let panelHit = false;
  for (let i = 0; i < 180; i++) if (stepRobot(s, layout, 1 / 60).panelHit) panelHit = true;
  assert(panelHit, 'ビーダマがパネルに命中して技が出る');
  assert(s.balls.length === 0, 'ビーダマは消滅する');
}

// 9b. HP設定(maxHp)の反映: 初期HPと回復上限
{
  const s = createRobotState(layout, 'turtle', 'cat', 120, 300);
  assert(s.p1.hp === 300 && s.p2.hp === 300 && s.maxHp === 300, 'maxHp=300で開始');
  s.p1.gauge = 1;
  s.p1.hp = 295;
  const e = ev();
  triggerPanel(s, layout, 1, findIdx(s, 1, 'special'), e);
  for (let i = 0; i < 90; i++) stepRobot(s, layout, 1 / 60);
  assert(s.p1.hp === 300, `かめの回復はmaxHpでキャップ (p1.hp=${s.p1.hp})`);
  // サバイバル持ち越し: p1Hpがそのまま入る
  const s2 = createRobotState(layout, 'dog', 'cat', 60, 200, 120);
  assert(s2.p1.hp === 120 && s2.p2.hp === 200, `持ち越しHP (p1=${s2.p1.hp}, p2=${s2.p2.hp})`);
}

// 10. CPUが行動してダメージを与えてくる
{
  const s = createRobotState(layout, 'dog', 'cat', 120);
  const cpu = createRobotCpuState();
  const cfg = ROBOT_CPU_CONFIGS.lion;
  for (let i = 0; i < 20 * 60; i++) {
    const e = stepRobot(s, layout, 1 / 60);
    stepRobotCpu(cpu, cfg, s, layout, 1 / 60, e);
    if (s.over) break;
  }
  assert(s.p1.hp < ROBOT_MAX_HP, `CPU(ライオン)が20秒でダメージを与える (p1.hp=${s.p1.hp})`);
  assert(s.shots2 === 0, 'CPUはビーダマを消費しない');
}

console.log('--- シミュレーション完了 ---');
