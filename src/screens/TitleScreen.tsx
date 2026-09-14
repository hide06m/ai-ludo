import { useAppStore } from '../app/store';
import { RulesInfoButton } from '../components/RulesInfoButton';
import { TitlePieceSpinner } from '../render/TitlePieceSpinner';

export function TitleScreen() {
  const goTo = useAppStore((s) => s.goTo);
  const rules = useAppStore((s) => s.rules);
  return (
    <div className="screen screen-center">
      <h1>ルドー</h1>
      <div className="title-spinner">
        <TitlePieceSpinner />
      </div>
      <p className="subtitle">インド生まれでイギリス育ちのすごろく、ルドーです</p>
      <button type="button" className="primary-button title-action-button" onClick={() => goTo('rules')}>
        CPU対戦を始める
      </button>
      <button type="button" className="secondary-button title-action-button" onClick={() => goTo('onlineLobby')}>
        友達とオンライン対戦
      </button>
      <RulesInfoButton rules={rules} />
    </div>
  );
}
