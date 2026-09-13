# ai-ludo

Nintendo Switch「世界のアソビ大全51」の「ルドー」を再現するWebアプリ。第一弾はCPU対戦のみ。
仕様は [claude-code-start-prompt.md](./claude-code-start-prompt.md) / [ludo-app-dev-prompt.md](./ludo-app-dev-prompt.md) を参照。

## 開発環境についての注意(重要)

このプロジェクトフォルダは Google ドライブの同期フォルダ(`G:\`)配下にあります。
Google ドライブの仮想ドライブは `npm install` が行う大量の小ファイル書き込みやシンボリックリンク作成に対応しておらず、
このフォルダで直接 `npm install` を実行すると `EBADF` / `EPERM` エラーで失敗します。

**そのため、`node_modules` はこのフォルダには作らず、ローカルディスク(`C:\Users\<user>\dev\ai-ludo` 等)にプロジェクトのコピーを置いて開発してください。**

開発の流れ:
1. `src/` `package.json` 等のソースはこのGドライブフォルダを正(バックアップ)とする
2. 編集・`npm install`・`npm run dev`・`npm test` はローカルディスクのコピー側で行う
3. 作業が一段落したら、ローカルの `src/` `package.json` 等(`node_modules` を除く)をこのGドライブフォルダへコピーして同期する

## 技術スタック
- React + TypeScript (Vite)
- Three.js + @react-three/fiber + @react-three/drei (3D表示は次段階で実装)
- zustand (状態管理、UI層で使用予定)
- vitest (ゲームロジックのユニットテスト)

## ディレクトリ構成
```
src/
  game/            # ゲームロジック層(3D表示・UIから独立した純粋関数群)
    types.ts       # 型定義
    board.ts       # 盤面データ構造・座標変換
    moves.ts       # 合法手算出
    turn.ts         # ターン進行・ゲーム状態遷移
    ai.ts          # CPU AI(基本戦略)
    game.test.ts   # ユニットテスト
  App.tsx          # 簡易テキスト表示による動作確認UI(本格的な3D表示は次段階)
```

## コマンド
```bash
npm install
npm run dev     # 開発サーバー起動(Reactアプリ)
npm run server  # オンライン対戦用WebSocketサーバー起動(ローカル: ws://localhost:8787)
npm test        # ゲームロジックのユニットテスト実行
npm run build   # 型チェック + 本番ビルド
```

## オンライン対戦(友達と)

`server/` に、部屋の作成/参加・ロール/移動をサーバー側で権威的に処理するWebSocketサーバーがある(`src/game/*` の
ゲームロジックをそのまま再利用)。ローカルでは `npm run server` で起動するだけで動作するが、実際に友達とインターネット
越しに遊ぶには両方(フロントエンドの静的ビルドと、このWebSocketサーバー)を公開する必要がある。

### デプロイ(Render想定)

このリポジトリには [render.yaml](./render.yaml) が用意されており、Renderの Blueprint 機能で
「`ai-ludo-server`(WebSocketサーバー)」と「`ai-ludo-web`(フロントエンドの静的サイト)」の2サービスを
まとめてデプロイできる(いずれも無料枠で動作する想定)。手順:

1. このリポジトリをGitHubに push する(未pushの場合)
2. Renderで「New Blueprint」からこのリポジトリを指定して `render.yaml` を読み込ませる
3. `ai-ludo-server` のデプロイが完了したら、発行されたURL(`https://ai-ludo-server-xxxx.onrender.com`)を控える
4. `ai-ludo-web` サービスの環境変数 `VITE_WS_URL` に、3で控えたURLの `https://` を `wss://` に置き換えた値
   (例: `wss://ai-ludo-server-xxxx.onrender.com`)を設定し、`ai-ludo-web` を再デプロイする
   (Vite の環境変数はビルド時に埋め込まれるため、設定後の再デプロイが必要)

無料プランはアクセスがない時間が続くとスリープするため、久しぶりに部屋を作る際はサーバーが起動するまで
数十秒かかることがある。
