import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 既定のビルドターゲットはかなり新しいブラウザを前提にしており、iOS 15 Safari
    // (iPhone 7 Plus等、iOS 15までしか対応しない古い端末の上限)のような環境では
    // 出力されたJSの構文自体を解釈できず、ページが真っ黒のまま何も表示されないことがある。
    // 明示的に少し古めのターゲットを指定し、esbuildに構文レベルで変換させる
    target: 'es2018',
  },
})
