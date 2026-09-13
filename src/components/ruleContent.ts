/**
 * Nintendo Switch「世界のアソビ大全51」のルドー内蔵ヘルプ(遊び方/ルール/ヒント)を参考にした説明文。
 */

export interface RuleContentItem {
  title: string;
  body: string;
  illustration?: 'move' | 'start' | 'attack' | 'sixAgain' | 'goalAll';
}

export const HOW_TO_PLAY_STEPS: RuleContentItem[] = [
  { title: '基本の遊び方', body: 'サイコロをふって4つのコマをいち早くゴールさせよう', illustration: 'goalAll' },
  { title: '動かし方', body: 'サイコロをふって、進むコマを選びます', illustration: 'move' },
  { title: 'コマのスタート', body: '「6」が出るまでスタートできません', illustration: 'start' },
  { title: '最後は', body: 'いち早く4つすべてのコマを同じ色のゴールに入れた人の勝ち', illustration: 'goalAll' },
  { title: 'アタック！', body: '相手のコマと同じマスに止まるとスタートにもどせる', illustration: 'attack' },
  { title: '6が出たら', body: 'もう1回サイコロをふれる', illustration: 'sixAgain' },
];

export const HINTS: RuleContentItem[] = [
  { title: 'よく考えて…', body: 'アタックされそうなコマは先に逃がそう' },
  { title: 'ジャマしよう', body: 'ライバルのマスに止まるコマを選んでアタック！' },
  { title: 'スタート地点', body: 'ライバルのコマが出てくるから要注意！' },
];
