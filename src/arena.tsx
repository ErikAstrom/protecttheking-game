import { useEffect, useRef, useState } from 'react';
import type { ReplayCue } from './audio.ts';
import { ITEMS, REPLAY, TUNING } from './rules.ts';
import type { CaptureReplay, ItemKind, Point, ReplayFrame, State } from './rules.ts';

export const GLYPHS: Record<ItemKind, string> = { strength: '✊', speed: '⚡', slow: '✥' };
const COLORS = { red: '#ff737b', blue: '#62bcff' };
const PORTAL_COLORS = ['#d4adff', '#58f5e1', '#ffcf70', '#ffe6f4'];
const WIDTH = 1000;
const HEIGHT = 620;

function draw(
  ctx: CanvasRenderingContext2D, board: Pick<State, 'settings' | 'obstacles' | 'portals' | 'terrain'>, scene: ReplayFrame,
  next: ReplayFrame, id: string, fraction: number, time: number, replay?: CaptureReplay, impact = false,
) {
  const { size, movement } = board.settings;
  const scale = 914 / size;
  function project(x: number, y: number, z = 0): Point {
    const depth = (y + 0.5) / size;
    return { x: WIDTH / 2 + (x + 0.5 - size / 2) * scale * (0.83 + depth * 0.17), y: 29 + depth * 546 - z };
  }
  function polygon(fill: string, points: Point[]) {
    ctx.beginPath();
    points.forEach(({ x, y }, index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function face(x: number, y: number, width: number, height: number, z = 0): [Point, Point, Point, Point] {
    return [project(x, y, z), project(x + width, y, z), project(x + width, y + height, z), project(x, y + height, z)];
  }
  function ellipse(x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, 2 * Math.PI);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  function text(label: string, x: number, y: number, size: number, fill: string) {
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fill;
    ctx.fillText(label, x, y);
  }

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const [a, b, c, d] = face(-0.5, -0.5, size, size);
  polygon('#0b2228', [d, c, { x: c.x, y: c.y + 21 }, { x: d.x, y: d.y + 21 }]);
  const turf = ctx.createLinearGradient(0, a.y, 0, d.y);
  turf.addColorStop(0, '#315749');
  turf.addColorStop(1, '#23453c');
  ctx.fillStyle = turf;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  for (const point of [b, c, d]) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#578187';
  ctx.lineWidth = 2;
  ctx.stroke();
  const laneWidth = 2;
  const middle = (size - laneWidth - 1) / 2;
  const cobble = '#78898469';
  polygon(cobble, face(-0.5, middle, size, laneWidth));
  polygon(cobble, face(middle, -0.5, laneWidth, size / 2 - laneWidth / 2));
  polygon(cobble, face(middle, middle + laneWidth, laneWidth, size / 2 - laneWidth / 2));
  const cobbleStride = Math.max(2, Math.floor(size / 32));
  for (let i = 0; i < size - cobbleStride; i += cobbleStride) {
    polygon('#b5beb047', face(i, middle + 0.3, cobbleStride * 0.65, 0.48));
    polygon('#b5beb047', face(middle + 0.86, i, 0.48, cobbleStride * 0.65));
  }
  for (const { x, y, width, height, kind } of board.terrain) {
    const ice = kind === 'ice';
    const left = x - 0.5, top = y - 0.5;
    polygon(ice ? '#5d9bb4' : '#895b3e', face(left, top, width, height));
    polygon(ice ? '#93d3dc' : '#b78354', face(left + 0.23, top + 0.23, width - 0.46, height - 0.46));
    for (let i = 1; i < 4; i++) {
      const sx = left + width * i / 4;
      const sy = top + height * (ice ? i : 4 - i) / 4;
      if (ice) {
        polygon('#edffff9c', [project(sx - width * 0.14, sy + height * 0.11),
          project(sx + width * 0.14, sy - height * 0.16), project(sx + width * 0.03, sy + height * 0.08)]);
      } else {
        const point = project(sx, sy);
        ellipse(point.x, point.y, Math.max(4, width * scale * 0.1), Math.max(2, height * scale * 0.042), '#865c47', '#d4a36a');
      }
    }
  }
  if (movement === 'classic') {
    ctx.beginPath();
    const stride = Math.max(1, Math.ceil(size / 64));
    for (let i = stride; i < size; i += stride) {
      const top = project(i - 0.5, -0.5);
      const bottom = project(i - 0.5, size - 0.5);
      const left = project(-0.5, i - 0.5);
      const right = project(size - 0.5, i - 0.5);
      ctx.moveTo(top.x, top.y); ctx.lineTo(bottom.x, bottom.y);
      ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y);
    }
    ctx.strokeStyle = '#92c5bb20';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const crest = project((size - 1) / 2, (size - 1) / 2);
  ellipse(crest.x, crest.y, 46, 26, '#90c6be0d', '#90c6be27');
  text('♜', crest.x, crest.y - 2, 36, '#90c6be45');
  polygon('#ff737b24', face(-0.5, -0.5, 7, 5));
  polygon('#62bcff24', face(size - 7.5, size - 5.5, 7, 5));
  for (const [index, pair] of board.portals.entries()) {
    const color = PORTAL_COLORS[index] ?? PORTAL_COLORS[0] ?? '#fff';
    for (const point of [pair.a, pair.b]) {
      const p = project(point.x, point.y);
      ellipse(p.x, p.y, 13, 8, '#172238', color);
      ellipse(p.x, p.y, 17 + 2 * Math.sin(time / 300 + index), 11, `${color}26`, `${color}99`);
      text(String(index + 1), p.x, p.y, 13, color);
    }
  }

  for (const trap of scene.traps) {
    const p = project(trap.x, trap.y);
    ellipse(p.x, p.y, Math.max(9, scale * 0.68), Math.max(5, scale * 0.4), '#a25be36c', COLORS[trap.team]);
    text(GLYPHS.slow, p.x, p.y, 12, '#fff');
  }
  const actors: { depth: number; draw: () => void }[] = [];
  for (const obstacle of board.obstacles) {
    actors.push({ depth: obstacle.y + 0.5, draw: () => {
      const { kind } = obstacle;
      const x = obstacle.x - 0.5, y = obstacle.y - 0.5;
      const h = Math.max(4, scale * (kind === 'pillar' ? 0.87 : 0.48));
      const near = y + 1;
      polygon('#10272d55', face(x + 0.13, y + 0.35, 1, 1));
      const [front, top, trim] = kind === 'crate' ? ['#6c422e', '#b67c47', '#edb777'] :
        kind === 'pillar' ? ['#414a67', '#8494be', '#c4cdec'] : ['#324953', '#657e82', '#acc0bc'];
      polygon(front, [project(x, near, h), project(x + 1, near, h), project(x + 1, near), project(x, near)]);
      polygon(top, face(x, y, 1, 1, h));
      if (kind === 'pillar') {
        polygon(trim, face(x + 0.18, y + 0.18, 0.64, 0.64, h));
        polygon(top, face(x + 0.32, y + 0.32, 0.36, 0.36, h));
      } else {
        polygon(trim, face(x + 0.12, y + 0.14, 0.76, 0.15, h));
        if (kind === 'crate') polygon(trim, face(x + 0.12, y + 0.7, 0.76, 0.15, h));
      }
    } });
  }
  for (const { x, y, kind } of scene.pickups) {
    actors.push({ depth: y, draw: () => {
      const p = project(x, y);
      const color = ITEMS[kind].color;
      const r = Math.min(20, Math.max(11, scale * 0.55));
      const lift = 6 + Math.sin(time / 270 + x + y) * 2.5;
      ellipse(p.x, p.y, r * 1.35, r * 0.64, `${color}34`, `${color}91`);
      ellipse(p.x, p.y - lift, r, r, '#142431', color);
      text(GLYPHS[kind], p.x, p.y - lift, r * 1.32, color);
    } });
  }
  for (const player of scene.players) {
    const target = next.players.find(candidate => candidate.id === player.id) ?? player;
    const blend = player.portalTrips === target.portalTrips ? fraction : 0;
    const x = player.x + (target.x - player.x) * blend;
    const y = player.y + (target.y - player.y) * blend;
    actors.push({ depth: y, draw: () => {
      const p = project(x, y);
      const r = Math.min(16, Math.max(6, scale * 0.53)) * (player.king ? 1.2 : 1);
      const team = COLORS[player.team];
      ellipse(p.x, p.y + 2, r * 1.26, r * 0.63, '#07171c8f',
        player.id === id ? '#fff' : team);
      if (player.recoilUntil > scene.now) ellipse(p.x, p.y, r * 1.7, r * 0.88, '#ffffff20', '#ffffffaa');
      if (player.strengthUntil > scene.now || player.paceUntil > scene.now) {
        const color = player.strengthUntil > scene.now ? ITEMS.strength.color :
          player.pace === 'speed' ? ITEMS.speed.color : ITEMS.slow.color;
        ellipse(p.x, p.y, r * 1.58, r * 0.77, `${color}39`, color);
      }
      polygon(player.king ? team : '#253847', [
        { x: p.x, y: p.y - r * 2.02 }, { x: p.x + r * 0.89, y: p.y - r * 1.5 },
        { x: p.x + r, y: p.y - r * 0.44 }, { x: p.x, y: p.y + r * 0.15 },
        { x: p.x - r, y: p.y - r * 0.44 }, { x: p.x - r * 0.89, y: p.y - r * 1.5 },
      ]);
      if (player.king) {
        const cy = p.y - r * 2.02;
        polygon('#ffdc78', [
          { x: p.x - r, y: cy - r * 0.77 }, { x: p.x - r * 0.42, y: cy - r * 0.53 },
          { x: p.x, y: cy - r * 1.14 }, { x: p.x + r * 0.42, y: cy - r * 0.53 },
          { x: p.x + r, y: cy - r * 0.77 }, { x: p.x + r * 0.68, y: cy + r * 0.22 },
          { x: p.x - r * 0.68, y: cy + r * 0.22 },
        ]);
        ellipse(p.x, cy - r * 0.19, r * 0.15, r * 0.18, '#7d361c');
        text(player.id === id ? 'YOUR KING' : 'KING', p.x, cy - r * 1.63, 13, '#ffe097');
      } else {
        const shoulder = p.y - r * 1.05;
        ellipse(p.x - r * 0.73, shoulder, r * 0.34, r * 0.31, '#a2bbc7', '#263a48');
        ellipse(p.x + r * 0.73, shoulder, r * 0.34, r * 0.31, '#a2bbc7', '#263a48');
        polygon(team, [
          { x: p.x - r * 0.62, y: shoulder }, { x: p.x + r * 0.62, y: shoulder },
          { x: p.x + r * 0.47, y: p.y - r * 0.2 }, { x: p.x, y: p.y + r * 0.14 },
          { x: p.x - r * 0.47, y: p.y - r * 0.2 },
        ]);
        ellipse(p.x, p.y - r * 1.6, r * 0.62, r * 0.64, '#bacfd8', '#263a48');
        polygon('#172633', [
          { x: p.x - r * 0.54, y: p.y - r * 1.69 }, { x: p.x + r * 0.54, y: p.y - r * 1.69 },
          { x: p.x + r * 0.38, y: p.y - r * 1.4 }, { x: p.x - r * 0.38, y: p.y - r * 1.4 },
        ]);
        if (player.id === id) text('YOU', p.x, p.y - r * 2.55, 13, '#fff');
      }
      text(player.team === 'red' ? 'R' : 'B', p.x, p.y - r * 0.55, Math.max(9, r * 0.87), '#0b1321');
    } });
  }
  actors.sort((left, right) => left.depth - right.depth);
  for (const actor of actors) actor.draw();
  if (replay) {
    for (const [participant, label, color] of [
      [replay.hunterId, 'HUNTER', '#b9fff4'], [replay.kingId, 'CAPTURED KING', '#ffe097'],
    ] as const) {
      const start = scene.players.find(player => player.id === participant);
      if (!start) continue;
      const end = next.players.find(player => player.id === participant) ?? start;
      const blend = start.portalTrips === end.portalTrips ? fraction : 0;
      const p = project(start.x + (end.x - start.x) * blend, start.y + (end.y - start.y) * blend);
      ellipse(p.x, p.y + 2, Math.max(12, scale * 0.62), Math.max(7, scale * 0.34), `${color}40`, color);
      text(label, Math.max(60, Math.min(WIDTH - 60, p.x)), Math.min(HEIGHT - 14, p.y + (start.king ? 34 : 18)), 13, color);
    }
    if (impact) {
      const p = project(replay.contact.x, replay.contact.y);
      ellipse(p.x, p.y, 22, 12, '#ffc65e36', '#ffcf70');
      text('✦', p.x, p.y - 3, 24, '#ffe097');
    }
  }
}

export function Arena({ state, id, onReplayCue }: { state: State; id: string; onReplayCue: (cue: ReplayCue) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ state, previous: state, received: 0 });
  const replayCue = useRef(onReplayCue);
  useEffect(() => { replayCue.current = onReplayCue; }, [onReplayCue]);
  const [playingReplay, setPlayingReplay] = useState(() =>
    !!state.replay && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const previous = latest.current.state;
    latest.current = { state, previous: previous.round === state.round ? previous : state, received: performance.now() };
  }, [state]);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let started: number | undefined;
    let hit = false;
    let index = 0;
    function render(time: number) {
      if (!ctx) return;
      const { state, previous, received } = latest.current;
      const smooth = state.settings.movement === 'smooth';
      const replay = playingReplay ? state.replay : null;
      const first = replay?.frames[0];
      const last = replay?.frames.at(-1);
      if (replay && first && last) {
        if (started === undefined) {
          started = time;
          replayCue.current('replay-start');
        }
        const elapsed = time - started;
        const duration = (last.now - first.now) / REPLAY.speed;
        const at = first.now + elapsed * REPLAY.speed;
        while ((replay.frames[index + 1]?.now ?? Infinity) <= at) index++;
        const scene = replay.frames[index] ?? last;
        const next = replay.frames[index + 1] ?? scene;
        const fraction = smooth && next !== scene ? (at - scene.now) / (next.now - scene.now) : 0;
        if (elapsed >= duration && !hit) {
          hit = true;
          replayCue.current('replay-impact');
        }
        draw(ctx, state, scene, next, id, fraction, still ? 0 : at - first.now, replay, hit);
        if (elapsed >= duration + REPLAY.holdMs) {
          setPlayingReplay(false);
          return;
        }
      } else {
        const interval = Math.max(TUNING.tickMs, state.now - previous.now);
        const fraction = smooth ? Math.max(0, Math.min(1, (time - received) / interval)) : 1;
        draw(ctx, state, state, previous, id, 1 - fraction, still ? 0 : time);
      }
      frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [id, playingReplay]);
  const replay = state.replay;
  const hunter = replay && state.players.find(player => player.id === replay.hunterId);
  const king = replay && state.players.find(player => player.id === replay.kingId);
  return <>
    {replay && <section className="replay" aria-label="Capture replay">
      <strong>{playingReplay ? 'Instant replay' : 'Capture replay'}</strong>
      <span>{hunter?.name} captured {king?.name}</span>
      <button onClick={() => setPlayingReplay(!playingReplay)}>{playingReplay ? 'Skip replay' : 'Watch replay'}</button>
    </section>}
    <canvas ref={ref} width={WIDTH} height={HEIGHT} aria-label={playingReplay ? 'Capture replay board' : 'Full game board'} />
  </>;
}
