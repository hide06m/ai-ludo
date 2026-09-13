import type { BlockRule, EndRule, GoalRule, Rules, StartRule } from './types';

export const START_RULE_LABEL: Record<StartRule, string> = {
  startDice3: 'スタートダイス3回',
  startDice1: 'スタートダイス1回',
  noDice: 'サイコロなし',
};

export const BLOCK_RULE_LABEL: Record<BlockRule, string> = {
  on: 'あり',
  off: 'なし',
};

export const GOAL_RULE_LABEL: Record<GoalRule, string> = {
  exact: 'ピッタリ',
  overOk: '大きい目でもOK',
};

export const END_RULE_LABEL: Record<EndRule, string> = {
  allRanked: '全員順位決定',
  firstWins: '1位決定で終了',
};

/** ルール4項目を「コマ出し: スタートダイス3回」のような読める形の配列にする */
export function describeRules(rules: Rules): { label: string; value: string }[] {
  return [
    { label: 'コマ出し', value: START_RULE_LABEL[rules.startRule] },
    { label: 'ブロック', value: BLOCK_RULE_LABEL[rules.blockRule] },
    { label: 'ゴール条件', value: GOAL_RULE_LABEL[rules.goalRule] },
    { label: '終了条件', value: END_RULE_LABEL[rules.endRule] },
  ];
}
