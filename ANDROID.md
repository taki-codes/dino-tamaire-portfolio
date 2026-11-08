# Android にインストールする

このゲームは APK としてビルドすると、Expo Go や開発用サーバーを使わずに遊べます。
ゲームと画像・音声はアプリに同梱されます。

## APK を作る

プロジェクトのフォルダーで実行します。
Node.js は 22.13 以降の 22 系を使用してください（`.nvmrc` は 22.22.2）。
クラウドのビルドも Node.js 22.22.2 に固定しています。

```powershell
npm ci
npm run login:expo
npm run build:android
```

Expo アカウントが必要です。ログイン済みなら `npm run login:expo` は省略できます。
初回に EAS プロジェクトの作成と Android 署名用 keystore の生成を確認されたら、作成・生成を選択します。
EAS に紐づくプロジェクト情報は CLI が `app.json` に追記します。
署名用 keystore は EAS が管理します。以後の更新も同じアカウント・プロジェクト・署名でビルドしてください。

`build:android` は `eas.json` の `preview` 設定で、端末に直接インストールできる署名付き APK を作ります。
ビルド処理は Expo のクラウドで行われるので、この PC に Android SDK を用意する必要はありません。
スクリプトは対象をこのプロジェクトのフォルダーに固定し、`.easignore` に従って必要なファイルを送信します。

## Android 端末に入れる

ビルドの一覧は [このゲームの Expo プロジェクト](https://expo.dev/accounts/taki_code/projects/dino-tamaire/builds) で確認できます。

1. ビルド完了時に表示されるリンクを Android 端末で開きます。
2. APK をダウンロードして開きます。
3. Android から確認された場合は、そのブラウザー／ファイルアプリの「この提供元のアプリを許可」を有効にします。
4. インストール後、ホーム画面の「動物えさやりバトル」を開きます。

USB 接続と USB デバッグを使う場合は、ダウンロードした APK を次のように入れられます。

```powershell
adb install -r path/to/game.apk
```

## Google Play 向け

```powershell
npm run build:android:store
```

これは Google Play にアップロードする AAB を生成します。ストアへの公開は別途行います。
端末に直接入れる場合は `npm run build:android` を使ってください。

アプリ識別子は `com.dinotamaire.app`、初期バージョンは `1.0.0` / `versionCode: 1` です。
ストア向けビルドでは `versionCode` を自動で増やします。

公式資料: [APK のビルドとインストール](https://docs.expo.dev/build-reference/apk/)、[EAS Build の設定](https://docs.expo.dev/build/setup/)。
