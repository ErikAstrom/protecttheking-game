// Golden gun visuals: tracers and the gun held by its owner. Drawing only — rules live in game.ts / gun.ts.
import { GUN } from './rules.ts';
import type { Point, Shot } from './rules.ts';

type Project = (x: number, y: number, z?: number) => Point;
const GOLD = '#ffd23f';

/** Bright tracer lines with a flash where the shot stopped; they fade out over GUN.tracerMs. */
export function drawShots(ctx: CanvasRenderingContext2D, project: Project, shots: readonly Shot[], now: number) {
  for (const shot of shots) {
    const age = Math.max(0, now - shot.at) / GUN.tracerMs;
    if (age >= 1) continue;
    const alpha = 1 - age;
    const from = project(shot.from.x, shot.from.y, 14);
    const to = project(shot.to.x, shot.to.y, 14);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff6c2';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const flash = shot.stoppedBy === 'player' ? '#ff5a4e' : shot.stoppedBy === 'king' ? '#ffe097' : '#ffffff';
    ctx.fillStyle = flash;
    ctx.beginPath();
    for (let spike = 0; spike < 8; spike++) {
      const angle = (spike / 8) * Math.PI * 2;
      const radius = spike % 2 ? 5 : 13 * (1 - age * 0.5);
      const point = { x: to.x + Math.cos(angle) * radius, y: to.y + Math.sin(angle) * radius * 0.7 };
      if (spike) ctx.lineTo(point.x, point.y);
      else ctx.moveTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
    if (shot.stoppedBy === 'player') {
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0b1321';
      ctx.strokeText('SHOT!', to.x, to.y - 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('SHOT!', to.x, to.y - 22);
    }
    ctx.restore();
  }
}

/** A small golden gun pointing the way the holder faces; your own gun also shows a dotted aim line. */
export function drawHeldGun(
  ctx: CanvasRenderingContext2D, project: Project, at: Point, facing: Point, own: boolean, size: number,
) {
  const base = project(at.x, at.y, size * 1.1);
  const ahead = project(at.x + facing.x, at.y + facing.y, size * 1.1);
  const angle = Math.atan2(ahead.y - base.y, ahead.x - base.x);
  if (own) {
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = '#ffd23f99';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    const reach = project(at.x + facing.x * 5, at.y + facing.y * 5, size * 1.1);
    ctx.lineTo(reach.x, reach.y);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(base.x + Math.cos(angle) * size * 0.9, base.y + Math.sin(angle) * size * 0.9);
  ctx.rotate(angle);
  const flip = Math.abs(angle) > Math.PI / 2 ? -1 : 1;
  ctx.scale(1, flip);
  const s = Math.max(5, size * 0.8);
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = '#8a6412';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-s * 0.2, -s * 0.18, s * 1.1, s * 0.32);
  ctx.moveTo(-s * 0.2, -s * 0.05);
  ctx.lineTo(-s * 0.05, s * 0.55);
  ctx.lineTo(s * 0.18, s * 0.55);
  ctx.lineTo(s * 0.18, s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff6c2';
  ctx.fillRect(-s * 0.1, -s * 0.13, s * 0.85, s * 0.08);
  ctx.restore();
}
