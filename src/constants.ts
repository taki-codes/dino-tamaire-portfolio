// ゲーム全体のチューニング用定数
export const GAME_DURATION = 60; // 制限時間(秒)
export const SURVIVAL_DURATION = 30; // かちぬきサバイバルの1試合(秒)

// 物理
export const GRAVITY = 900; // px/s^2 (各プレイヤー側に向かって働く)
export const BALL_RADIUS = 10;
export const WALL_BOUNCE = 0.75; // 左右壁の反発係数
export const FLOOR_BOUNCE = 0.45; // 自陣床の反発係数
export const MAX_FLOOR_BOUNCES = 2; // 床で跳ねられる回数(超えたら消滅)
export const BALL_LIFETIME = 6; // 玉の寿命(秒)

// 発射(スリングショット)
export const LAUNCH_POWER = 7; // ドラッグ距離→初速の倍率
export const MAX_DRAG = 140; // ドラッグ最大距離(px)
export const MIN_LAUNCH_SPEED = 200; // これ未満なら発射キャンセル
export const COOLDOWN_MS = 700; // 発射クールダウン(連射防止)

// えさを待つ動物(変則移動)
export const LANE_OFFSET = 46; // 中央ラインから各陣地側のレーンまでの距離
export const ANIMAL_HIT_W = 76; // えさの当たり判定(動物本体)
export const ANIMAL_HIT_H = 62;
export const WALK_SPEED: [number, number] = [60, 180]; // 歩き速度の乱数範囲
export const DASH_SPEED: [number, number] = [300, 400]; // ダッシュ速度
export const PLAN_WALK_T: [number, number] = [0.5, 1.6]; // 各行動の持続時間範囲
export const PLAN_DASH_T: [number, number] = [0.2, 0.5];
export const PLAN_PAUSE_T: [number, number] = [0.15, 0.5];
export const SPEED_RAMP_MAX = 1.4; // 時間経過での機敏さ上限(倍率)
export const SPEED_RAMP_TIME = 45; // この秒数かけて上限まで機敏になる

// 空腹突進システム
export const CHARGE_DELAY_MIN = 1.5; // 突進までの秒数(毎サイクルこの範囲でランダム)
export const CHARGE_DELAY_MAX = 5;
export const CHARGE_WARN_LEAD = 0.45; // 突進の何秒前から「!」警告を出すか
export const CHARGE_SPEED_RANGE: [number, number] = [300, 800]; // 突進速度(毎回ランダム、爆速もある)
export const RETURN_SPEED = 260; // 帰還速度(px/s)
export const CHARGE_PENALTY = 5; // ぶつかったときの減点(0未満にはならない)
export const CHARGE_HIT_DISTANCE = 46; // 発射台までこの距離で衝突

// 必殺技
export const GAUGE_PER_GOAL = 0.2; // 1ゴールでたまるゲージ量(5回で満タン)
export const SPECIAL_DURATION = 7; // 効果時間(秒)

// バトルルール: れんしゃモード
export const RAPID_COOLDOWN_MS = 220; // 連射時の発射クールダウン

// ボタン発射モード: 照準が左右にスイングし、タイミングを合わせて発射する
export const BUTTON_PULL = 132; // 発射の強さ(ひっぱり距離換算、px)。端の角度でもレーンに届く強さ
export const BUTTON_SWEEP_MAX = 0.6; // スイングの最大角(ラジアン、真上から±)
export const BUTTON_SWEEP_SPEED = 1.6; // スイング速度(ラジアン/秒)
export const BUTTON_MANUAL_SENS = 0.008; // 手動調整: ドラッグ1pxあたりの角度

// バトルルール: ギミックモード(うごく丸太)
// 各陣地の発射台と動物の間を丸太が往復し、当たったえさを跳ね返す
export const LOG_W = 110; // 丸太の幅
export const LOG_H = 22; // 丸太の太さ
export const LOG_OFFSET = 136; // 中央ラインから丸太のy位置までの距離
export const LOG_MARGIN = 10; // 画面端との余白
export const LOG_SPEED = 130; // 移動速度(px/s)
export const LOG_BOUNCE = 0.75; // 反発係数

// バトルルール: アイテムモード
export const ITEM_SPAWN_INTERVAL: [number, number] = [4.5, 7.5]; // 出現間隔(乱数範囲)
export const ITEM_LIFETIME = 9; // アイテムの寿命(秒)
export const ITEM_MAX = 6; // 同時に存在できる数
export const ITEM_HIT_RADIUS = 26; // えさがこの距離で当たると取得
export const BOMB_PENALTY = 3; // 💣: 相手の減点
export const DIZZY_DURATION = 4; // 🌀: 相手の動物が暴走する時間
export const DIZZY_SPEED = 330; // 🌀: 暴走中の移動速度
export const FREEZE_DURATION = 3; // 🧊: 相手が発射できなくなる時間
export const NOTICE_DURATION = 2.2; // アイテム通知の表示時間

// ゾンビサバイバル
export const ZOMBIE_HEARTS = 3; // ハートの数(上限)
export const ZOMBIE_HIT_R = 30; // えさがこの距離で当たると撃退(ちびキャラの見た目に合わせる)
export const ZOMBIE_SPEED: [number, number] = [24, 58]; // 迫る速さ(乱数範囲、ウェーブで加速)
export const ZOMBIE_WAVE_SPEEDUP = 0.07; // ウェーブごとの速度上昇(+7%/wave)
export const ZOMBIE_SPEED_CAP = 2.6; // 速度倍率の上限(ウェーブ24あたりで到達)
export const ZOMBIE_SPAWN_T: [number, number] = [0.8, 1.6]; // スポーン間隔(終盤ほど短くなる)
export const ZOMBIE_MAX_ALIVE = 18; // 画面上の同時数上限の基本値(ウェーブ9以降じわじわ増えて最大26)
export const ZOMBIE_BIG_WAVE = 150; // この匹数を超えるウェーブは一度に出る数が増える
export const ZOMBIE_RUSH_INTERVAL: [number, number] = [16, 28]; // 突発ラッシュの間隔(ウェーブ2以降)
export const ZOMBIE_RUSH_MAX = 14; // ラッシュ1回で出る数の上限
// 中ボス(5発当てないと倒れない、少し大きい)
export const ZOMBIE_MID_FROM = 300; // この匹数以上のウェーブから時折出現
export const ZOMBIE_MID_HP = 5;
export const ZOMBIE_MID_CHANCE = 0.15; // スポーン1回ごとに混ざる確率
export const ZOMBIE_MID_MAX = 2; // 同時にいられる中ボスの数
export const ZOMBIE_MID_SIZE = 1.45;
// ボスウェーブ(350匹のフェーズはラッシュの代わりにボス。ソロは1体、協力は各プレイヤーに1体ずつ)
export const ZOMBIE_BOSS_WAVE_COUNT = 350; // この匹数のフェーズがボスウェーブになる
export const ZOMBIE_BOSS_HP = 50;
export const ZOMBIE_BOSS_SIZE = 2.3;
export const ZOMBIE_ULTRA_BOSS_DAMAGE = 8; // 必殺ボム/💥はボスには8ダメージ(即死しない)
export const ZOMBIE_INVULN = 1.0; // ぶつかられた後の無敵時間(秒)
export const ZOMBIE_WAVE_BANNER = 2.2; // ウェーブ開始バナー(この間スポーンしない)
export const SAVIOR_INTERVAL: [number, number] = [16, 26]; // 救世主アイテムの出現間隔
export const SAVIOR_SLOW_T = 6; // ⏳: ゾンビが遅くなる時間
export const ZOMBIE_GRAVITY_SCALE = 0.45; // ゾンビモードは重力が弱く、えさが相手側エリアまで届く

// まとあて射的(パンダダーツ風): まとを掲げた動物が画面を横切る。
// まとにえさを当てると得点、動物本体やあかちゃん連れに当てると減点
export const GALLERY_LANES = [64, 128, 192]; // 中央ラインから奥(相手側)へのレーン距離
export const GALLERY_SPAWN_T: [number, number] = [0.8, 1.6]; // 出現間隔(乱数範囲)
export const GALLERY_MAX_WALKERS = 5; // 片側の同時数上限
export const GALLERY_SPEED: [number, number] = [70, 150]; // 行進の速さ(乱数範囲)
export const GALLERY_RAMP_MAX = 1.6; // 終盤の行進スピード・出現ペース倍率
export const GALLERY_TARGET_R = 22; // まとの当たり判定半径
export const GALLERY_BODY_R = 26; // 動物本体の当たり判定半径
export const GALLERY_TARGET_LIFT = 48; // まとを掲げる高さ(動物の中心から)
export const GALLERY_SCORE_TARGET = 1; // ふつうのまと
export const GALLERY_SCORE_RARE = 3; // パンダまと(大得点)
export const GALLERY_PENALTY_BODY = 2; // 動物本体に当てた減点
export const GALLERY_PENALTY_BABY = 5; // あかちゃん連れに当てた減点
export const GALLERY_RARE_CHANCE = 0.14; // パンダまとの出現率
export const GALLERY_BABY_CHANCE = 0.24; // あかちゃん連れの出現率
export const GALLERY_EXIT_SPEED = 260; // 退場ダッシュの速さ

// エフェクト
export const PARTICLE_MAX = 40; // 同時に存在できるパーティクル上限
export const GOAL_BURST_COUNT = 14; // ゴール1回で飛び散る数
export const SHAKE_DURATION = 0.25; // 画面シェイク時間(秒)
export const REACT_DURATION = 0.4; // キャラ喜びリアクション時間(秒)

// 見た目
export const COLORS = {
  fieldP1: '#7CB342', // 下側(Player1)の芝生
  fieldP2: '#8BC34A', // 上側(Player2)の芝生
  fieldP1Deep: '#558B2F', // 下側グラデーションの濃い端
  fieldP2Deep: '#4DB6AC', // 上側グラデーションの濃い端
  centerLine: '#FFF9C4',
  p1: '#E53935', // 紅組
  p2: '#FAFAFA', // 白組
  p1Dark: '#B71C1C',
  p2Dark: '#90A4AE',
  uiBg: '#33691E', // メニュー画面の背景
  uiCard: 'rgba(255,255,255,0.14)', // メニューカード
  uiCardActive: 'rgba(255,255,255,0.32)',
  uiAccent: '#FFB300', // 決定ボタン等
} as const;
