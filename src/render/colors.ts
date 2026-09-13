import type { Color } from '../game/types';

/**
 * 色ごとの表示カラー。Three.js/@react-three に依存しないプレーンなデータなので、
 * 3D非依存の画面(色選択・結果画面など)からも軽量に参照できるよう独立したモジュールに切り出している。
 */
// 赤とマス/コマの区別がつきやすいよう、赤は少し明度を上げている
export const COLOR_HEX: Record<Color, string> = {
  red: '#ef5350',
  blue: '#1565c0',
  yellow: '#f9a825',
  green: '#2e7d32',
};
