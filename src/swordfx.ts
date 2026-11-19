// Sword visuals: the drawn blade with a time-left ring, and slash arcs on chops. Drawing only.
import { SWORD } from './rules.ts';
import type { Point, Slash } from './rules.ts';

type Project = (x: number, y: number, z?: number) => Point;

/** A steel sword held out the way the player faces, swinging gently, with a ring showing time left. */
export function drawHeldSword(
  ctx: CanvasRenderingContext2D, project: Project, at: Point, facing: Point, remaining: number, size: number, time: number,
) {
  const feet = project(at.x, at.y);
  const ring = Math.max(0, Math.min(1, remaining / SWORD.activeMs));
  ctx.save();
  ctx.strokeStyle = remaining < 2000 && Math.floor(time / 150) % 2 ? '#ff9a8a' : '#d9e4ee';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(feet.x, feet.y + 2, size * 1.45, size * 0.72, 0, -Math.PI / 2, -Math.PI / 2 + ring * Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const hand = project(at.x, at.y, size * 1.1);
  const ahead = project(at.x + facing.x, at.y + facing.y, size * 1.1);
  const swing = Math.sin(time / 120) * 0.35;
  const angle = Math.atan2(ahead.y - hand.y, ahead.x - hand.x) - 0.6 + swing;
  const blade = Math.max(10, size * 1.7);
  ctx.save();
  ctx.translate(hand.x + Math.cos(angle) * size * 0.7, hand.y + Math.sin(angle) * size * 0.7);
  ctx.rotate(angle);
  ctx.fillStyle = '#eef4fa';
  ctx.strokeStyle = '#6d7f91';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.11);
  ctx.lineTo(blade, -size * 0.06);
  ctx.lineTo(blade + size * 0.28, 0);
  ctx.lineTo(blade, size * 0.06);
  ctx.lineTo(0, size * 0.11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c8a24a';
  ctx.fillRect(-size * 0.08, -size * 0.32, size * 0.16, size * 0.64);
  ctx.fillStyle = '#5b3b24';
  ctx.fillRect(-size * 0.42, -size * 0.07, size * 0.34, size * 0.14);
  ctx.restore();
}

/** A white crescent where someone was chopped, with a "CHOP!" label; fades over SWORD.slashMs. */
export function drawSlashes(ctx: CanvasRenderingContext2D, project: Project, slashes: readonly Slash[], now: number) {
  for (const slash of slashes) {
    const age = Math.max(0, now - slash.at) / SWORD.slashMs;
    if (age >= 1) continue;
    const p = project(slash.to.x, slash.to.y, 12);
    const from = project(slash.from.x, slash.from.y, 12);
    const direction = Math.atan2(p.y - from.y, p.x - from.x);
    ctx.save();
    ctx.globalAlpha = 1 - age;
    ctx.lineCap = 'round';
    for (const [width, color] of [[9, '#ffffff66'], [4, '#ffffff']] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16 + age * 8, direction - 1.2 + age * 0.8, direction + 1.2 + age * 0.8);
      ctx.stroke();
    }
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0b1321';
    ctx.strokeText('CHOP!', p.x, p.y - 26 - age * 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CHOP!', p.x, p.y - 26 - age * 8);
    ctx.restore();
  }
}
