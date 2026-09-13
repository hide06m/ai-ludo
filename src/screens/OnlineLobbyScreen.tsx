import { useState } from 'react';
import { useAppStore } from '../app/store';
import { loadLastSession } from '../net/clientId';

type Tab = 'create' | 'join';

export function OnlineLobbyScreen() {
  const goTo = useAppStore((s) => s.goTo);
  const rules = useAppStore((s) => s.rules);
  const status = useAppStore((s) => s.online.status);
  const error = useAppStore((s) => s.online.error);
  const connectOnlineCreate = useAppStore((s) => s.connectOnlineCreate);
  const connectOnlineJoin = useAppStore((s) => s.connectOnlineJoin);
  const reconnectOnline = useAppStore((s) => s.reconnectOnline);
  const clearOnlineError = useAppStore((s) => s.clearOnlineError);

  const [tab, setTab] = useState<Tab>('create');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  // 画面表示時点のセッションを覚えておく(再接続開始後にlocalStorageが更新/消去されても
  // ボタンの表示がちらつかないように、Stateとして一度だけ読み込む)
  const [lastSession] = useState(() => loadLastSession());

  const connecting = status === 'connecting';

  const handleCreate = () => {
    if (!name.trim()) return;
    clearOnlineError();
    connectOnlineCreate(name.trim(), rules);
  };

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim()) return;
    clearOnlineError();
    connectOnlineJoin(roomCode.trim().toUpperCase(), name.trim());
  };

  const handleReconnect = () => {
    clearOnlineError();
    reconnectOnline();
  };

  return (
    <div className="screen screen-center">
      <h2>友達とオンライン対戦</h2>
      <p className="subtitle">合言葉(部屋コード)を共有して、最大4人まで一緒に遊べます</p>

      {lastSession && (
        <div className="online-reconnect">
          <p className="subtitle">
            前回の部屋({lastSession.roomCode})に「{lastSession.name}」として参加していました
          </p>
          <button type="button" className="primary-button" disabled={connecting} onClick={handleReconnect}>
            {connecting ? '接続中…' : '前回の部屋に再接続する'}
          </button>
        </div>
      )}

      <div className="rule-popover-tabs online-lobby-tabs">
        <button
          type="button"
          className={`rule-tab-button ${tab === 'create' ? 'active' : ''}`}
          onClick={() => setTab('create')}
        >
          部屋を作る
        </button>
        <button
          type="button"
          className={`rule-tab-button ${tab === 'join' ? 'active' : ''}`}
          onClick={() => setTab('join')}
        >
          部屋に入る
        </button>
      </div>

      <div className="online-form">
        <label className="online-form-row">
          <span>名前</span>
          <input
            type="text"
            value={name}
            maxLength={20}
            placeholder="ニックネーム"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {tab === 'join' && (
          <label className="online-form-row">
            <span>部屋コード</span>
            <input
              type="text"
              value={roomCode}
              maxLength={4}
              placeholder="ABCD"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => setRoomCode(e.target.value)}
            />
          </label>
        )}

        {error && <p className="online-error">{error}</p>}

        <button
          type="button"
          className="primary-button"
          disabled={connecting || !name.trim() || (tab === 'join' && !roomCode.trim())}
          onClick={tab === 'create' ? handleCreate : handleJoin}
        >
          {connecting ? '接続中…' : tab === 'create' ? '部屋を作る' : '部屋に入る'}
        </button>
      </div>

      <div className="screen-actions">
        <button type="button" onClick={() => goTo('title')}>
          戻る
        </button>
      </div>
    </div>
  );
}
