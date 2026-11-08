// アプリ全体の設定。ミュートと同様に、画面をまたいで使うのでシングルトンで持つ

// 発射操作: ひっぱり(スリングショット) / ボタン(自動で狙って発射)
export type ControlType = 'drag' | 'button';

let controlType: ControlType = 'drag';

export function getControlType(): ControlType {
  return controlType;
}

export function setControlType(type: ControlType): void {
  controlType = type;
}

// 対戦(2人/CPU)の試合時間(秒)。かちぬきサバイバルは30秒固定、練習とゾンビは無制限
export const MATCH_DURATION_MIN = 10;
export const MATCH_DURATION_MAX = 300;

let matchDuration = 60;

export function getMatchDuration(): number {
  return matchDuration;
}

export function setMatchDuration(seconds: number): void {
  matchDuration = Math.min(MATCH_DURATION_MAX, Math.max(MATCH_DURATION_MIN, Math.round(seconds)));
}

// ロボットバトルの操作: ビーダマでパネルを撃つ / パネルを直接タッチ(かんたん)
export type RobotControlType = 'ball' | 'touch';

let robotControl: RobotControlType = 'ball';

export function getRobotControl(): RobotControlType {
  return robotControl;
}

export function setRobotControl(type: RobotControlType): void {
  robotControl = type;
}

// ロボットバトルのHP
export const ROBOT_HP_MIN = 50;
export const ROBOT_HP_MAX = 500;

let robotHp = 150;

export function getRobotHp(): number {
  return robotHp;
}

export function setRobotHp(hp: number): void {
  robotHp = Math.min(ROBOT_HP_MAX, Math.max(ROBOT_HP_MIN, Math.round(hp)));
}
