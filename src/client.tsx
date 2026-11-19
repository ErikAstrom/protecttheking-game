import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LIMITS, TEAMS } from './rules.ts';
import type { Command, Direction, ServerMessage, Settings, State } from './rules.ts';
import './style.css';

const colors = { red: '#ff737b', blue: '#62bcff' };
const pickupColors = { strength: '#ffb657', speed: '#62e4a6', slow: '#ce99ff' };
const keys = new Map<string, Direction>([
  ['KeyW', 'up'], ['ArrowUp', 'up'], ['KeyS', 'down'], ['ArrowDown', 'down'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
]);

function Arena({ state, id }: { state: State; id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const size = state.settings.size;
    const tile = canvas.width / size;
    ctx.fillStyle = '#101d2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#445873';
    for (const { x, y } of state.walls) ctx.fillRect(x * tile, y * tile, tile + 0.1, tile + 0.1);
    for (const { x, y, kind } of state.pickups) {
      ctx.fillStyle = pickupColors[kind];
      ctx.fillRect((x + 0.12) * tile, (y + 0.12) * tile, tile * 0.76, tile * 0.76);
    }
    for (const player of state.players) {
      const x = (player.x + 0.5) * tile;
      const y = (player.y + 0.5) * tile;
      if (player.id === id || player.king) {
        ctx.beginPath();
        ctx.arc(x, y, tile * (player.king ? 0.85 : 0.63), 0, Math.PI * 2);
        ctx.strokeStyle = player.king ? '#ffe18a' : '#fff';
        ctx.lineWidth = Math.max(1.5, tile * 0.13);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, tile * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = colors[player.team];
      ctx.fill();
      if (player.strengthUntil > state.now) {
        ctx.fillStyle = pickupColors.strength;
        ctx.fillRect(x - tile * 0.16, y - tile * 0.16, tile * 0.32, tile * 0.32);
      }
    }
  }, [state, id]);
  return <canvas ref={ref} width={1024} height={1024} aria-label="Full game board" />;
}

const fields = [
  ['teamSize', 'Players per team'], ['seconds', 'Round seconds'],
  ['wins', 'Points to win'], ['size', 'Board side (tiles)'],
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
  useEffect(() => {
    if (!canMove) return;
    const held = new Map<string, Direction>();
    let active: Direction | null = null;
    function update() {
      const direction = [...held.values()].at(-1) ?? null;
      if (direction === active) return;
      active = direction;
      transmit({ type: 'input', direction });
    }
    function down(event: KeyboardEvent) {
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
  }, [canMove]);

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
  return <main>
    <header>
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
        <section className="round" aria-label="Round status">
          <strong>Round {state.round} · {seconds}s · First to {state.settings.wins}</strong>
          {player ? <span>{player.king ? 'You are the king' : 'Guard or hunt'} · WASD / arrows
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
        <Arena state={state} id={id} />
        <p className="legend"><span>Gold ring: king</span><span>White ring: you (when not king)</span>
          <span className="strength">■ Strength</span><span className="speed">■ Speed</span><span className="slow">■ Slow trap</span></p>
      </>}
    </>}
  </main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root.');
createRoot(root).render(<App />);
