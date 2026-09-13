import { useEffect, useRef, useState, type ReactElement } from 'react';
import { describeRules } from '../game/ruleLabels';
import { HINTS, HOW_TO_PLAY_STEPS, type RuleContentItem } from './ruleContent';
import {
  AttackIllustration,
  BlockRuleIllustration,
  EndRuleIllustration,
  GoalAllIllustration,
  GoalRuleIllustration,
  MoveIllustration,
  SixAgainIllustration,
  StartRuleIllustration,
} from './ruleIllustrations';
import type { Rules } from '../game/types';

type Tab = '遊び方' | 'ルール' | 'ヒント';
const TABS: Tab[] = ['遊び方', 'ルール', 'ヒント'];

const STEP_ILLUSTRATIONS: Record<NonNullable<RuleContentItem['illustration']>, () => ReactElement> = {
  move: MoveIllustration,
  start: StartRuleIllustration,
  attack: AttackIllustration,
  sixAgain: SixAgainIllustration,
  goalAll: GoalAllIllustration,
};

const CURRENT_RULE_ILLUSTRATIONS: Record<string, () => ReactElement> = {
  コマ出し: StartRuleIllustration,
  ブロック: BlockRuleIllustration,
  ゴール条件: GoalRuleIllustration,
  終了条件: EndRuleIllustration,
};

function StepList({ items }: { items: RuleContentItem[] }) {
  return (
    <>
      {items.map(({ title, body, illustration }) => {
        const Illustration = illustration ? STEP_ILLUSTRATIONS[illustration] : undefined;
        return (
          <div key={title} className="rule-popover-item">
            <div className="rule-popover-row">
              <span>{title}</span>
            </div>
            <p className="rule-popover-body">{body}</p>
            {Illustration && (
              <div className="rule-popover-illustration">
                <Illustration />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/** 現在のルール設定・遊び方・ヒントをいつでも確認できる、共通のルール確認ボタン+ポップアップ */
export function RulesInfoButton({ rules, className }: { rules: Rules; className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('遊び方');
  const containerRef = useRef<HTMLDivElement>(null);

  // ポップアップの外側をクリックしたら閉じる
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className={`rules-info${className ? ` ${className}` : ''}`}>
      <button type="button" className="link-button" onClick={() => setOpen((v) => !v)}>
        ルール確認
      </button>
      {open && (
        <div className="rule-popover rule-popover-wide">
          <div className="rule-popover-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`rule-tab-button${t === tab ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === '遊び方' && <StepList items={HOW_TO_PLAY_STEPS} />}
          {tab === 'ヒント' && <StepList items={HINTS} />}
          {tab === 'ルール' &&
            describeRules(rules).map(({ label, value }) => {
              const Illustration = CURRENT_RULE_ILLUSTRATIONS[label];
              return (
                <div key={label} className="rule-popover-item">
                  <div className="rule-popover-row">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                  {Illustration && (
                    <div className="rule-popover-illustration">
                      <Illustration />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
