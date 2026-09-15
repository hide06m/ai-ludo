import { useAppStore } from '../app/store';
import { RulesInfoButton } from '../components/RulesInfoButton';
import { SoundToggleButton } from '../components/SoundToggleButton';
import { TitlePieceSpinner } from '../render/TitlePieceSpinner';

export function TitleScreen() {
  const goTo = useAppStore((s) => s.goTo);
  const rules = useAppStore((s) => s.rules);
  return (
    <div className="screen screen-center">
      {/* Renderへのデプロイが最新コミットまで反映されているか目視で確認できるよう、
          ビルド時点のGitコミットハッシュを表示する */}
      <div className="build-version">#{__APP_COMMIT__}</div>
      <SoundToggleButton />
      <h1 className="title-logo-heading">
        <img src="/logo.png" alt="ルドー" className="title-logo" />
      </h1>
      <div className="title-spinner">
        <TitlePieceSpinner />
      </div>
      <p className="subtitle">インド生まれでイギリス育ちのすごろく</p>
      <button type="button" className="image-button title-action-button" onClick={() => goTo('rules')}>
        <img src="/button-cpu.png" alt="CPU対戦を始める" />
      </button>
      <button type="button" className="image-button title-action-button" onClick={() => goTo('onlineLobby')}>
        <img src="/button-friend.png" alt="友達とオンライン対戦" />
      </button>
      <RulesInfoButton rules={rules} />
    </div>
  );
}
