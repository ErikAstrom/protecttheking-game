import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Arena, GLYPHS } from './arena.tsx';
import { GameAudio } from './audio.ts';
import { ITEMS, ITEM_KINDS, LIMITS, TEAMS } from './rules.ts';
import type { Command, Direction, ServerMessage, Settings, State } from './rules.ts';
import './style.css';

const keys = new Map<string, Direction>([
  ['KeyW', 'up'], ['ArrowUp', 'up'], ['KeyS', 'down'], ['ArrowDown', 'down'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
]);

const fields = [
  ['teamSize', 'Players per team'], ['seconds', 'Round seconds'],
  ['wins', 'Points to win'], ['size', 'Board side'], ['pickupCount', 'Pickups on board'],
] as const;

function SettingsForm({ settings, send }: { settings: Settings; send: (command: Command) => void }) {
  const [draft, setDraft] = useState(settings);
  return <form className="settings" onSubmit={event => {
    event.preventDefault();
    send({ type: 'settings', settings: draft });
  }}>
    <h2>Match settings</h2>
    <div className="fields">
      {fields.map(([key, label]) => <label key={key}>{label}
        <input type="number" required min={LIMITS[key].min} max={LIMITS[key].max}
          value={Number.isNaN(draft[key]) ? '' : draft[key]}
          onChange={event => setDraft({ ...draft, [key]: event.currentTarget.valueAsNumber })} />
      </label>)}
      <label>Timeout rule
        <select value={draft.timeout} onChange={event => setDraft({
          ...draft, timeout: event.currentTarget.value === 'proximity' ? 'proximity' : 'draw',
        })}>
          <option value="draw">Draw</option><option value="proximity">Proximity</option>
        </select>
      </label>
      <label>Movement
        <select value={draft.movement} onChange={event => setDraft({
          ...draft, movement: event.currentTarget.value === 'smooth' ? 'smooth' : 'classic',
        })}>
          <option value="classic">Classic (tiles)</option><option value="smooth">Smooth (8 directions)</option>
        </select>
      </label>
    </div>
    <button>Apply settings</button>
  </form>;
}

function App() {
  const socket = useRef<WebSocket | null>(null);
  const [id, setId] = useState('');
  const [state, setState] = useState<State | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [sound, setSound] = useState(false);
  const [soundPending, setSoundPending] = useState(false);
  const audio = useRef<GameAudio | null>(null);
  const audioPrevious = useRef<State | null>(null);
  useEffect(() => () => audio.current?.close(), []);
  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/game`);
    socket.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setError('Disconnected. Reload the page to rejoin.');
    };
    ws.onerror = () => setError('Could not connect to the game host.');
    ws.onmessage = event => {
      const message: ServerMessage = JSON.parse(event.data);
      if (message.type === 'hello') setId(message.id);
      else if (message.type === 'state') setState(message.state);
      else setError(message.message);
    };
    return () => ws.close();
  }, []);

  const player = state?.players.find(candidate => candidate.id === id);
  const canMove = !!player && state?.phase === 'playing' && connected;
  const smooth = state?.settings.movement === 'smooth';
  useEffect(() => {
    if (!canMove) return;
    const held = new Map<string, Direction>();
    let active: Direction | null = null;
    function update() {
      const all = [...held.values()];
      let direction = all.at(-1) ?? null;
      if (smooth) {
        const latestFirst = all.reverse();
        const vertical = latestFirst.find(value => value === 'up' || value === 'down');
        const horizontal = latestFirst.find(value => value === 'left' || value === 'right');
        direction = vertical && horizontal ? `${vertical}-${horizontal}` : vertical ?? horizontal ?? null;
      }
      if (direction === active) return;
      active = direction;
      transmit({ type: 'input', direction });
    }
    function down(event: KeyboardEvent) {
      if (event.code === 'Space') {
        if (event.target instanceof HTMLElement && event.target.closest('button, input, select, textarea, [contenteditable="true"]')) return;
        event.preventDefault();
        if (!event.repeat) transmit({ type: 'use-item' });
        return;
      }
      const direction = keys.get(event.code);
      if (!direction) return;
      event.preventDefault();
      if (event.repeat) return;
      held.set(event.code, direction);
      update();
    }
    function up(event: KeyboardEvent) {
      held.delete(event.code);
      update();
    }
    function stop() {
      held.clear();
      update();
    }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      stop();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [canMove, smooth]);

  useEffect(() => {
    const previous = audioPrevious.current;
    audioPrevious.current = state;
    const engine = audio.current;
    if (!engine || !sound) return;
    engine.setMusic(connected && state?.phase === 'playing');
    if (!connected || !state || !previous || state === previous) return;
    if (state.phase === 'playing' && previous.phase !== 'playing') engine.cue('round');
    if (state.result && !previous.result) engine.cue(state.result.reason);
    if (state.phase === 'playing' && state.round === previous.round) {
      const local = state.players.find(member => member.id === id);
      const old = previous.players.find(member => member.id === id);
      if (local && old) {
        if (local.collected > old.collected) engine.cue('pickup');
        if (local.used > old.used) engine.cue('use');
        if (local.tripped > old.tripped) engine.cue('trap');
      }
      if (state.deadline - state.now <= 10000 && previous.deadline - previous.now > 10000) engine.cue('urgent');
    }
  }, [state, id, sound, connected]);

  async function toggleSound() {
    setSoundPending(true);
    try {
      const engine = audio.current ??= new GameAudio();
      if (sound) await engine.mute();
      else await engine.enable();
      setSound(!sound);
    } catch (error) {
      console.error('Could not change game audio:', error);
      setError('Audio could not be changed in this browser.');
    } finally {
      setSoundPending(false);
    }
  }

  function transmit(command: Command) {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(command));
  }
  function send(command: Command) {
    setError('');
    transmit(command);
  }

  const host = !!player && state?.host === id;
  const lobby = state?.phase === 'lobby';
  const seconds = state ? Math.max(0, Math.ceil((state.deadline - state.now) / 1000)) : 0;
  const full = !!state && state.players.length === state.settings.teamSize * TEAMS.length;
  const result = state?.result;
  return <main className={state?.phase === 'playing' ? 'in-match' : ''}>
    <header>
      <button className="audio-toggle" aria-pressed={sound} disabled={soundPending} onClick={event => {
        event.currentTarget.blur();
        void toggleSound();
      }}>{sound ? 'Sound on' : 'Enable sound'}</button>
      <p className="eyebrow">LAN party game</p>
      <h1>Protect the King</h1>
      <p>Block their hunters. Tag their king.</p>
    </header>
    {error && <p className="status" role="alert">{error}</p>}
    {state?.notice && <p className="status" role="status">{state.notice}</p>}
    {!state && connected && <p>Loading lobby...</p>}
    {!state && !connected && !error && <p>Connecting to host...</p>}
    {connected && state && <>
      {lobby && !player && <form className="join" onSubmit={event => {
        event.preventDefault();
        send({ type: 'join', name });
      }}>
        <label>Player name <input required maxLength={24} value={name} onChange={event => setName(event.currentTarget.value)} /></label>
        <button>Join lobby</button>
      </form>}
      <section className="teams" aria-label="Scoreboard">
        {TEAMS.map(team => {
          const roster = state.players.filter(candidate => candidate.team === team);
          return <div key={team} className={`team ${team}`}>
            <h2>{team} <strong>{state.score[team]}</strong></h2>
            <p>{roster.length}/{state.settings.teamSize} players</p>
            <ul>{roster.map(member => <li key={member.id}>
              {member.name}{member.id === id ? ' (you)' : ''}{member.king ? ' · King' : ''}{member.id === state.host ? ' · Host' : ''}
            </li>)}</ul>
            {lobby && player && player.team !== team && <button disabled={roster.length >= state.settings.teamSize}
              onClick={() => send({ type: 'team', team })}>Join {team}</button>}
          </div>;
        })}
      </section>
      {lobby && host && <>
        <SettingsForm key={JSON.stringify(state.settings)} settings={state.settings} send={send} />
        <button disabled={!full} onClick={() => send({ type: 'start' })}>Start match</button>
        {!full && <p>Fill both teams before starting. Share <code>{location.origin}</code> from your LAN address.</p>}
      </>}
      {!lobby && <>
        <section className={`round${seconds <= 10 && state.phase === 'playing' ? ' urgent' : ''}`} aria-label="Round status">
          <strong>Round {state.round} · {seconds}s · First to {state.settings.wins} · {smooth ? 'Smooth' : 'Classic'}</strong>
          {player ? <span>{player.king ? 'You wear the crown' : 'Guard or hunt'} · WASD / arrows
            {player.strengthUntil > state.now ? ' · Strength active' : ''}
            {player.paceUntil > state.now ? ` · ${player.pace === 'speed' ? 'Speed boost' : 'Slowed'}` : ''}
          </span> : <span>Spectating until the match ends</span>}
        </section>
        {result && <p className="status" role="status">
          {result.winner ? `${result.winner === 'red' ? 'Red' : 'Blue'} wins the ${state.phase === 'finished' ? 'match' : 'round'}` : 'Round drawn'}
          {' — '}{result.reason === 'capture' ? 'king captured' : 'time expired'}.
        </p>}
        {host && state.phase === 'between' && <button onClick={() => send({ type: 'next' })}>Next round</button>}
        {host && state.phase === 'finished' && <button onClick={() => send({ type: 'reset' })}>Back to lobby</button>}
        {player && <section className="inventory" aria-label="Your item queue">
          <strong><kbd>Space</kbd> Use first item</strong>
          {player.inventory.length ? <ol aria-label="Items in pickup order">
            {player.inventory.map((kind, index) => <li key={`${player.used + index}-${kind}`} className={kind}
              title={ITEMS[kind].name} aria-label={`${index === 0 ? 'Next: ' : ''}${ITEMS[kind].name}`}>
              <span aria-hidden="true">{GLYPHS[kind]}</span>{index === 0 && <span>{ITEMS[kind].name}</span>}
            </li>)}
          </ol> : <span className="empty-queue">No items yet — move over a pickup.</span>}
        </section>}
        <Arena key={state.replay ? `capture-${state.round}` : 'live'} state={state} id={id} />
        <p className="legend"><span>Gold crown: king</span><span>White ring: you</span>
          {ITEM_KINDS.map(kind => <span className={kind} key={kind}>{GLYPHS[kind]} {ITEMS[kind].name}</span>)}</p>
      </>}
    </>}
  </main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root.');
createRoot(root).render(<App />);
