// Class costumes and status effects (frozen, cloaked), drawn on top of penguins and orcas. Drawing only.
import type { ClassKind, Point } from './rules.ts';

export type CostumeLook = { at: Point; r: number; motion: Point; time: number; orca: boolean };

/** Where the head is, relative to the feet, for each animal. Penguins lean into motion like drawPenguin does. */
function anchor(look: CostumeLook) {
  const { r, motion, orca } = look;
  const facing = motion.x > 0.02 ? 1 : motion.x < -0.02 ? -1 : orca ? -1 : 0;
  if (orca) {
    const side = facing || 1;
    return { top: { x: 0.68 * r * side, y: -1.32 * r }, eyes: { x: 0.7 * r * side, y: -1.02 * r }, facing: side, lean: 0, head: 0.42 * r };
  }
  return { top: { x: 0, y: -2.7 * r }, eyes: { x: facing * r * 0.16, y: -2.17 * r }, facing, lean: Math.max(-0.5, Math.min(0.5, motion.x * 1.6)), head: 0.62 * r };
}

function path(ctx: CanvasRenderingContext2D, points: Point[], fill: string, stroke?: string) {
  ctx.beginPath();
  points.forEach(({ x, y }, index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, w), Math.max(0.1, h), rotation, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Wizard: starry pointed hat. Spy: fedora and eye mask. Bodyguard: shades and earpiece. Hunter: feathered cap. Strategist: mortarboard. */
export function drawCostume(ctx: CanvasRenderingContext2D, role: ClassKind, look: CostumeLook) {
  const { at, r, time } = look;
  const { top, eyes, facing, lean, head } = anchor(look);
  const h = head;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(lean);
  if (role === 'wizard') {
    const sway = Math.sin(time / 260) * h * 0.25;
    oval(ctx, top.x, top.y + h * 0.15, h * 1.25, h * 0.32, '#3d2a7a');
    path(ctx, [
      { x: top.x - h * 0.8, y: top.y + h * 0.1 }, { x: top.x + sway + h * 0.15, y: top.y - h * 2.3 },
      { x: top.x + h * 0.8, y: top.y + h * 0.1 },
    ], '#5b3fb5', '#2c1d5c');
    ctx.fillStyle = '#ffe58a';
    ctx.font = `${Math.max(7, h * 0.7)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', top.x + sway * 0.4, top.y - h * 0.75);
  } else if (role === 'spy') {
    oval(ctx, eyes.x, eyes.y, h * 0.85, h * 0.2, '#111');
    oval(ctx, top.x, top.y + h * 0.1, h * 1.2, h * 0.3, '#262a31');
    path(ctx, [
      { x: top.x - h * 0.72, y: top.y + h * 0.05 }, { x: top.x - h * 0.6, y: top.y - h * 0.85 },
      { x: top.x, y: top.y - h * 0.65 }, { x: top.x + h * 0.6, y: top.y - h * 0.85 }, { x: top.x + h * 0.72, y: top.y + h * 0.05 },
    ], '#353a43');
    ctx.fillStyle = '#b3262e';
    ctx.fillRect(top.x - h * 0.7, top.y - h * 0.18, h * 1.4, h * 0.2);
  } else if (role === 'bodyguard') {
    oval(ctx, eyes.x - h * 0.3, eyes.y, h * 0.32, h * 0.2, '#0b0f14');
    oval(ctx, eyes.x + h * 0.3, eyes.y, h * 0.32, h * 0.2, '#0b0f14');
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(eyes.x - h * 0.3, eyes.y - h * 0.05, h * 0.6, h * 0.08);
    ctx.strokeStyle = '#e9eef3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ear = { x: eyes.x - (facing || 1) * h * 0.75, y: eyes.y + h * 0.1 };
    ctx.moveTo(ear.x, ear.y);
    ctx.quadraticCurveTo(ear.x - (facing || 1) * h * 0.3, ear.y + h * 0.8, ear.x, ear.y + h * 1.4);
    ctx.stroke();
    oval(ctx, ear.x, ear.y, h * 0.12, h * 0.12, '#e9eef3');
  } else if (role === 'hunter') {
    path(ctx, [
      { x: top.x - h * 0.85, y: top.y + h * 0.2 }, { x: top.x + h * 0.95, y: top.y + h * 0.2 },
      { x: top.x + h * 0.2, y: top.y - h * 0.75 },
    ], '#2f7d3a', '#1b4a22');
    ctx.strokeStyle = '#e8483f';
    ctx.lineWidth = Math.max(1.5, h * 0.18);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(top.x + h * 0.25, top.y - h * 0.3);
    ctx.quadraticCurveTo(top.x + h * 1.2, top.y - h * 1.1, top.x + h * 1.5, top.y - h * 0.6);
    ctx.stroke();
  } else if (role === 'strategist') {
    path(ctx, [
      { x: top.x - h * 1.05, y: top.y - h * 0.15 }, { x: top.x, y: top.y - h * 0.55 },
      { x: top.x + h * 1.05, y: top.y - h * 0.15 }, { x: top.x, y: top.y + h * 0.25 },
    ], '#1d2533', '#0b0f14');
    ctx.fillStyle = '#1d2533';
    ctx.fillRect(top.x - h * 0.45, top.y - h * 0.05, h * 0.9, h * 0.35);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = Math.max(1, h * 0.1);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - h * 0.15);
    ctx.lineTo(top.x + h * 0.85, top.y + h * 0.05 + Math.sin(time / 200) * h * 0.1);
    ctx.lineTo(top.x + h * 0.85, top.y + h * 0.6);
    ctx.stroke();
    ctx.strokeStyle = '#d9b44a';
    ctx.beginPath();
    ctx.arc(eyes.x + (facing || 1) * h * 0.25, eyes.y, h * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** A translucent ice block around a frozen unit. */
export function drawFrozen(ctx: CanvasRenderingContext2D, at: Point, r: number, remaining: number) {
  const w = r * 1.35, h = r * 3.1;
  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.35 + remaining / 1500);
  ctx.fillStyle = '#bfe9ffaa';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(at.x - w, at.y - h, w * 2, h + r * 0.35, r * 0.25);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffffcc';
  ctx.fillRect(at.x - w * 0.7, at.y - h * 0.9, w * 0.25, h * 0.55);
  ctx.font = `${Math.max(10, r)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e6f7ff';
  ctx.fillText('❄', at.x, at.y - h - r * 0.4);
  ctx.restore();
}
