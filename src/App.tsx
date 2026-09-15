import { useEffect } from 'react';
import './App.css';
import { useAppStore } from './app/store';
import { ColorSelectScreen } from './screens/ColorSelectScreen';
import { GameScreen } from './screens/GameScreen';
import { OnlineLobbyScreen } from './screens/OnlineLobbyScreen';
import { OnlineRoomScreen } from './screens/OnlineRoomScreen';
import { ResultScreen } from './screens/ResultScreen';
import { RuleSelectScreen } from './screens/RuleSelectScreen';
import { TitleScreen } from './screens/TitleScreen';

function App() {
  const screen = useAppStore((s) => s.screen);

  // 前の画面でスクロールした状態のまま遷移すると、新しい画面の先頭(部屋コード等)が
  // 画面外になってしまうため、画面が切り替わるたびに先頭へ戻す
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  switch (screen) {
    case 'title':
      return <TitleScreen />;
    case 'rules':
      return <RuleSelectScreen />;
    case 'colorSelect':
      return <ColorSelectScreen />;
    case 'onlineLobby':
      return <OnlineLobbyScreen />;
    case 'onlineRoom':
      return <OnlineRoomScreen />;
    case 'game':
      return <GameScreen />;
    case 'result':
      return <ResultScreen />;
    default:
      return null;
  }
}

export default App;
