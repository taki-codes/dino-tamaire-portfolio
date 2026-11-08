# 動物えさやりバトル

[![CI](https://github.com/taki-codes/dino-tamaire-portfolio/actions/workflows/verify.yml/badge.svg)](https://github.com/taki-codes/dino-tamaire-portfolio/actions/workflows/verify.yml)

[設計・コードの読みどころと検証結果](docs/portfolio.md)

<img src="assets/icon.png" alt="動物えさやりバトルのアイコン" width="96">

ひっぱってエサを飛ばし、動物に食べさせるスマートフォン向けゲームです。1台の端末を向かい合って使う2人対戦のほか、CPU対戦、協力サバイバル、射的、物理マージパズル、ロボットバトルを収録しています。

React Native / Expo と TypeScript で構築し、ゲームの描画には React Native Skia を使用しています。リポジトリ名は `dino-tamaire`、アプリ内の名称は「動物えさやりバトル」です。

## 遊び方とモード

通常のエサやりでは、発射台を引いて離すとエサが飛びます。引く操作に加えて、照準のタイミングを合わせるボタン操作にも切り替えられます。

| モード | 内容 |
| --- | --- |
| 二人でバトル | 1台の端末の上下に分かれ、同時に操作して対戦 |
| コンピューターとバトル | かめ・うさぎ・ねこ・ライオンの4段階から強さを選択 |
| 勝ち抜きサバイバル | 1試合30秒で、徐々に強くなるCPUに挑戦 |
| ゾンビサバイバル | 1人または2人協力で、迫る動物にエサを投げて生き残る |
| まとあて射的 | 動物が持つ的を狙うスコアアタック。1人・2人に対応 |
| 闘魂ロボットバトル | ビーダマで技のパネルを撃ち、攻撃・ガード・カウンターで対戦。CPU戦と勝ち抜きにも対応 |
| どうぶつマージ | 同じ動物を落として合体させ、ライオンを目指す1人用パズル |
| 一人で練習 | 時間制限なしで発射操作を練習 |

エサやり対戦には、ふつう・連射・動く丸太・アイテムのルールを用意しています。選択できるルールはモードによって異なります。

いぬ・パンダ・ねこ・うさぎ・かめ・くま・ライオンの7キャラクターを収録。ポーズ、ミュート、操作方法の変更、試合時間やロボットのHP設定にも対応しています。

## 技術構成

以下は `package.json` に記載されている依存バージョンです。

| 領域 | 使用技術 |
| --- | --- |
| アプリ | Expo SDK 56 (`~56.0.23`)、React Native 0.85.3、React 19.2.3 |
| 言語 | TypeScript 6 (`~6.0.3`)、strict モード |
| 2D描画 | React Native Skia 2.6.2 |
| 操作・演出 | Gesture Handler 2.31、Reanimated 4.3.1 |
| 音・振動 | expo-audio、expo-haptics |
| Android配布 | EAS Build、APK / AAB |

## 実装の見どころ

- **ゲームロジックと描画の分離**: 弾道・衝突・得点などを `src/game/`、動物やエフェクトの描画を `src/render/`、画面と操作を `src/screens/` に分けています。
- **1台での同時操作**: 上下のジェスチャーを同時に受け付け、画面を向かい合って使う対戦を構成しています。
- **フレーム更新の制御**: `requestAnimationFrame` でゲーム状態を進め、復帰時に時間差が大きくなった場合の更新幅を制限しています。
- **CPUの調整**: 思考間隔、照準の誤差、発射タイミングなどをパラメーター化し、勝ち抜きでは段階的に強くなります。
- **異なるルールへの展開**: エサやりの物理処理に加えて、マージの衝突・合体処理と、ロボットの技・ゲージ・HP処理を個別に実装しています。
- **音と触覚のフィードバック**: 発射・命中・必殺技などに効果音と振動を組み合わせています。

## ローカルで起動する

### 必要な環境

- Node.js **22.22.2**（`.nvmrc` と EAS のビルド設定に合わせたバージョン）
- npm
- SDK 56 に対応した Expo Go、または対応する開発ビルドと実機・エミュレーター

```sh
git clone https://github.com/taki-codes/dino-tamaire-portfolio.git
cd dino-tamaire-portfolio
npm ci
npm start
```

開発サーバーの案内に従って端末で開きます。Android エミュレーターを使う場合は `npm run android`、iOS Simulator は macOS と Xcode を用意したうえで `npm run ios` を使用します。

ゲームには外部APIのキーやバックエンドサーバーの設定は不要です。対戦は同じ端末内で行います。

### 型チェック

```sh
npm run typecheck
npm run test:robot
```

ロボットの攻撃・ガード・カウンター・HPなどを確認する補助コードは [`tools/robot-sim-test.ts`](tools/robot-sim-test.ts) にあります。`npm run test:robot` で既存シミュレーションの25アサーションを実行できます。乱数はテスト内で固定します。全モード・実端末の検証は別途必要です。

## Androidアプリとして使う

APKを作成すると、開発サーバーを起動せずに端末で遊べます。ExpoアカウントでのログインとEAS Buildの利用が必要です。

```sh
npm run login:expo
npm run build:android
```

- `build:android`: 端末に直接インストールするAPK
- `build:android:store`: Google Play向けのAAB

インストール、署名、ビルド設定の詳細は [`ANDROID.md`](ANDROID.md) を参照してください。AABの生成とストア公開は別の手順です。

## ディレクトリ

```text
App.tsx                    # タイトルから結果までの画面遷移・対戦設定
src/
├── game/                  # 物理、CPU、ルール、マージ、ロボット、ゲームループ
├── render/                # Skiaによるキャラクター・フィールド・エフェクト描画
├── screens/               # モード選択、プレイ画面、結果画面
├── components/            # ボタン、操作切替、ミュートなどの共通UI
├── audio/                 # BGM・効果音
├── characters.ts          # キャラクターとCPUレベルの定義
├── settings.ts            # 操作方法、試合時間、ロボットHPの設定
└── types.ts               # ゲーム状態と設定の型
assets/                    # アイコン、同梱音声
tools/                     # Androidビルド、音声生成、補助検証
```

## 現在の対応範囲

- Android向けのビルド手順を整備しています。iOS・Webの同等な動作は未検証です。
- Web用の起動スクリプトはありますが、現在の依存一覧には `react-dom` / `react-native-web` がありません。Web対応には追加設定と検証が必要です。
- 設定値はアプリのメモリ内に保持します。再起動後に復元する永続化処理はありません。
- Node.js 24.22.1 の環境で `npm ci --ignore-scripts` と `npm run typecheck` の成功を確認しました。実機プレイ、ネイティブのビルド、APKの生成は未検証です。

## ライセンス

[MIT License](LICENSE)。既存のライセンス表記はそのまま保持しています。

## この公開用ソースについて

[元のコードとの差分・含める範囲](PORTFOLIO-SOURCE.md)を参照してください。個別の運用情報と元のGit履歴を含まない公開用ソースです。
