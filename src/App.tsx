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
