export type PlayerId = 1 | 2;

export type Phase = 'title' | 'mode' | 'rule' | 'character' | 'playing' | 'result';

export type GameMode =
  | 'vs2p'
  | 'vsCpu'
  | 'survival'
  | 'zombie'
  | 'gallery'
  | 'merge'
  | 'practice'
  | 'robot' // 闘魂ロボットバトル(2人対戦 or CPU対戦)
  | 'robotSurvival'; // 闘魂ロボットバトルの勝ち抜きサバイバル

// バトルルール(対戦モードで選ぶ。練習はnormal固定)
export type BattleRule = 'normal' | 'rapid' | 'gimmick' | 'item';

export type CpuLevel = 'turtle' | 'rabbit' | 'cat' | 'lion';

export type AnimalId = 'dog' | 'panda' | 'cat' | 'rabbit' | 'turtle' | 'bear' | 'lion';

// 1ゲーム分の設定(モード選択〜リザルトまで引き回す)
export interface GameConfig {
  mode: GameMode;
  rule: BattleRule;
  cpuLevel?: CpuLevel;
  survivalStage?: number; // サバイバル: いま何人目の相手か(1始まり)
  carryHp?: number; // ロボットサバイバル: 前の試合から持ち越す自分のHP
  players?: 1 | 2; // ゾンビサバイバル・まとあて射的: ひとり/ふたり
  p1Animal: AnimalId;
  p2Animal: AnimalId; // vsCpu/survivalではレベルの動物に固定
}

// ゲーム終了時の結果(練習モードは成功率表示に使う)
export interface GameResult {
  score1: number;
  score2: number;
  shots1: number;
  shots2: number;
  aborted?: boolean; // ポーズメニューから途中終了した(サバイバルの勝ち抜き判定はしない)
  wave?: number; // ゾンビ: 到達ウェーブ
  defeated?: number; // ゾンビ: 撃退した数 / まとあて: 当てたまとの数
  bestAnimal?: AnimalId; // マージ: いちばん進化した動物
  lions?: number; // マージ: らいおん同士で消した回数
}

export interface Ball {
  id: number;
  owner: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  floorBounces: number;
  age: number;
  dead: boolean;
  points: number; // ゴール時の得点(かめの必殺技中は2)
  scale: number; // 見た目の大きさ倍率(パンダの必殺技中は拡大)
}

// えさを待つ動物の状態(空腹突進システム)
export type CarrierMode = 'center' | 'charging' | 'returning';

// 変則移動の行動: 歩く / ダッシュ / 立ち止まる
export type MovePlan = 'walk' | 'dash' | 'pause';

export interface CarrierState {
  mode: CarrierMode;
  hunger: number; // 最後にえさを食べてからの秒数
  hungerLimit: number; // 今サイクルの突進しきい値(食べるたびランダムに引き直す)
  chargeSpeed: number; // 今回の突進速度(突進開始時にランダムに引く)
  x: number; // 動物の実位置
  y: number;
  dir: 1 | -1; // 移動方向(CPUの先読みにも使う)
  speed: number; // 現在の移動速度
  plan: MovePlan;
  planT: number; // 今の行動の残り時間
}

// アイテムモードでフィールドに出現するアイテム(bomb/dizzy/freeze)と
// ゾンビサバイバルの救世主アイテム(heart/nuke/slow)
export type ItemKind = 'bomb' | 'dizzy' | 'freeze' | 'heart' | 'nuke' | 'slow';

// ゾンビの種類: 通常 / 中ボス(5発) / ボス(50発、350匹フェーズに出る。ソロ1体/協力2体)
export type ZombieKind = 'normal' | 'mid' | 'boss';

// ゾンビサバイバル: 迫ってくるおなかすき動物
export interface Zombie {
  id: number;
  animal: AnimalId; // 見た目(ランダム)
  kind: ZombieKind;
  hp: number; // 残り耐久(通常1/中ボス5/ボス50)
  maxHp: number;
  size: number; // 見た目と当たり判定の倍率(中ボス・ボスは大きい)
  x: number;
  y: number;
  speed: number; // 迫る速さ(px/s)
  target: PlayerId; // どちらの端へ向かうか(ソロは常に1)
  phase: number; // 左右ゆらゆらの位相
  hitT: number; // 被弾フラッシュの残り時間
  dead: boolean;
}

// まとあて射的: 動物が持っているもの
// target=ふつうのまと / rare=パンダまと(大得点) / baby=あかちゃんおんぶ(撃っちゃダメ)
export type GalleryHold = 'target' | 'rare' | 'baby';

// まとあて射的: まとを掲げて画面を横切る動物
export interface GalleryWalker {
  id: number;
  animal: AnimalId; // 見た目(ランダム)
  side: PlayerId; // どちらのプレイヤーのまとか(ソロは常に1)
  hold: GalleryHold;
  exiting: boolean; // まとを撃ち抜かれた/あかちゃんを守って退場中(当たり判定なし)
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number; // 行進の速さ(px/s)
  phase: number; // 歩きバウンスの位相
  hitT: number; // 被弾フラッシュの残り時間
  dead: boolean;
}

export interface FieldItem {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  age: number; // 出現からの秒数(寿命で消える)
}

// アイテム効果などをプレイヤーに知らせる短いメッセージ
export interface Notice {
  text: string;
  t: number; // 残り表示時間
}

// ゴール時のエフェクト(広がるリング)
export interface ScorePop {
  id: number;
  x: number;
  y: number;
  owner: PlayerId;
  age: number;
}

// ゴール時に飛び散るパーティクル
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

// 画面サイズから計算するレイアウト情報
export interface Layout {
  width: number;
  height: number;
  centerY: number;
  launcher1: { x: number; y: number }; // 下側(P1)の発射台
  launcher2: { x: number; y: number }; // 上側(P2)の発射台
}

export interface GameState {
  elapsed: number;
  duration: number; // 試合時間(通常60秒、かちぬきサバイバルは30秒)
  timeLeft: number;
  coop: boolean; // ゾンビサバイバルの2人協力か
  score1: number;
  score2: number;
  shots1: number;
  shots2: number;
  carrier1: CarrierState; // 下側(P1)の動物(位置・移動・空腹・突進)
  carrier2: CarrierState;
  gauge1: number; // 必殺技ゲージ(0..1)
  gauge2: number;
  special1: number; // 必殺技の残り効果時間(0=非発動)
  special2: number;
  balls: Ball[];
  pops: ScorePop[];
  particles: Particle[];
  items: FieldItem[]; // アイテムモードのみ使用
  itemTimer: number; // 次のアイテム出現までの秒数
  held1: ItemKind | null; // 拾って手持ちにしているアイテム(ボタンで任意発動)
  held2: ItemKind | null;
  dizzy1: number; // めまい(🌀)の残り時間: 動物が暴走して狙いにくい
  dizzy2: number;
  freeze1: number; // こおり(🧊)の残り時間: えさを発射できない
  freeze2: number;
  notice1: Notice | null; // 各プレイヤー側に出す通知メッセージ
  notice2: Notice | null;
  // ゾンビサバイバル
  zombies: Zombie[];
  zombieQueue: number; // このウェーブでまだ出てくる数
  zombieSpawnT: number; // 次のスポーンまでの秒数
  wave: number; // 現在のウェーブ(0=開始前)
  hearts: number; // 残りハート
  defeated: number; // 撃退した合計
  waveBannerT: number; // 「ウェーブn!」バナーの残り表示時間
  invulnT: number; // ぶつかられた直後の無敵時間(連続でハートが溶けないように)
  zombieSlowT: number; // ⏳アイテムでゾンビが遅くなる残り時間
  rushT: number; // 次の突発ラッシュまでの秒数(ウェーブ2以降に発生)
  // まとあて射的
  walkers: GalleryWalker[];
  walkerSpawnT: number; // 次の動物が出てくるまでの秒数
  ultra1Used: boolean; // 一撃必殺ボム(1試合1回)を使ったか
  ultra2Used: boolean;
  shakeT: number; // 画面シェイクの残り時間
  react1: number; // ゴール時のキャラ喜びリアクション残り時間
  react2: number;
  streak1: number; // 連続ゴール数(練習モードのトースト用)
  nextId: number;
}

// ドラッグ中の照準情報(発射台からの引っ張りベクトル)
export interface Aim {
  dx: number;
  dy: number;
}
