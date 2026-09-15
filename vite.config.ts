import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Renderへの反映確認用に、ビルド時点のGitコミットハッシュ(短縮形)を埋め込む。
// git情報が取得できない環境(gitが無い等)でもビルド自体は落とさず、
// 'unknown' にフォールバックする
function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_COMMIT__: JSON.stringify(getCommitHash()),
  },
  build: {
    // 既定のビルドターゲットはかなり新しいブラウザを前提にしており、iOS 15 Safari
    // (iPhone 7 Plus等、iOS 15までしか対応しない古い端末の上限)のような環境では
    // 出力されたJSの構文自体を解釈できず、ページが真っ黒のまま何も表示されないことがある。
    // 明示的に少し古めのターゲットを指定し、esbuildに構文レベルで変換させる
    target: 'es2018',
  },
})
