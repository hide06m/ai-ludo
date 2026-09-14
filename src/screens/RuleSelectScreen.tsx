import { useAppStore } from '../app/store';
import { RulesInfoButton } from '../components/RulesInfoButton';
import { SoundToggleButton } from '../components/SoundToggleButton';
import type { BlockRule, EndRule, GoalRule, Rules, StartRule } from '../game/types';

export function RadioGroup<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="rule-group">
      <legend>{label}</legend>
      <p className="rule-description">{description}</p>
      {options.map(([v, l]) => (
        <label key={v} className="rule-option">
          <input type="radio" name={label} checked={value === v} onChange={() => onChange(v)} />
          {l}
        </label>
      ))}
    </fieldset>
  );
}

export function RuleSelectScreen() {
  const rules = useAppStore((s) => s.rules);
  const setRules = useAppStore((s) => s.setRules);
  const goTo = useAppStore((s) => s.goTo);

  const update = (patch: Partial<Rules>) => setRules({ ...rules, ...patch });

  return (
    <div className="screen">
      <SoundToggleButton />
      <div className="screen-header">
        <h2>ルール設定</h2>
        <RulesInfoButton rules={rules} />
      </div>
      <RadioGroup
        label="コマ出しルール"
        description="場にコマが1つもない時、サイコロで6を出すとスタートマスに出せます。規定回数以内に6が出なければパスします(サイコロなしなら振らずに自動で出ます)。"
        value={rules.startRule}
        options={[
          ['startDice3', 'スタートダイス3回'],
          ['startDice1', 'スタートダイス1回'],
          ['noDice', 'サイコロなし'],
        ]}
        onChange={(v: StartRule) => update({ startRule: v })}
      />
      <RadioGroup
        label="ブロック"
        description="相手のコマが止まっているマスの扱いです。「あり」はそのマスを通過できず、ピッタリの目で止まって弾き飛ばすしかありません。「なし」は自由に通過でき、ピッタリ止まれば弾き飛ばします。"
        value={rules.blockRule}
        options={[
          ['on', 'あり'],
          ['off', 'なし'],
        ]}
        onChange={(v: BlockRule) => update({ blockRule: v })}
      />
      <RadioGroup
        label="ゴール条件"
        description="ゴールマスの一番奥への到達条件です。「ピッタリ」は残り数と出た目が完全に一致しないと動けません。「大きい目でもOK」は残り数以上の目ならそのまま奥まで進めます。"
        value={rules.goalRule}
        options={[
          ['exact', 'ピッタリ'],
          ['overOk', '大きい目でもOK'],
        ]}
        onChange={(v: GoalRule) => update({ goalRule: v })}
      />
      <RadioGroup
        label="ゲーム終了条件"
        description="「全員順位決定」は全プレイヤーがゴールするまで続け、順位を決めます。「1位決定で終了」は誰か1人が4個全てゴールさせた時点でゲーム終了です。"
        value={rules.endRule}
        options={[
          ['allRanked', '全員順位決定'],
          ['firstWins', '1位決定で終了'],
        ]}
        onChange={(v: EndRule) => update({ endRule: v })}
      />
      <div className="screen-actions">
        <button type="button" onClick={() => goTo('title')}>
          戻る
        </button>
        <button type="button" className="primary-button" onClick={() => goTo('colorSelect')}>
          スタート
        </button>
      </div>
    </div>
  );
}
