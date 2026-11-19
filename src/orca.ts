import type { PenguinLook } from './penguin.ts';

export function drawOrca(ctx: CanvasRenderingContext2D, { at, r, team, king, you, motion, time }: PenguinLook) {
  const speed = Math.hypot(motion.x, motion.y);
  const facing = motion.x > 0.02 ? 1 : -1;
  const black = '#102133', white = '#f6fcff';
  const oval = (x: number, y: number, w: number, h: number, color: string, rotation = 0) => {
    ctx.beginPath();
    ctx.ellipse(x * r, y * r, w * r, h * r, rotation, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  ctx.save();
  ctx.translate(at.x, at.y);
  if (speed > 0.12) {
    for (let i = 0; i < 3; i++) {
      const trail = 1 + i * 0.52;
      oval(-motion.x / speed * trail, -motion.y / speed * trail * 0.5 + Math.sin(time / 60 + i) * 0.15,
        0.2 - i * 0.04, 0.1, '#ffffffcc');
    }
  }
  ctx.scale(facing, 1);
  const flick = speed > 0.02 ? Math.sin(time / 85) * 0.16 : 0;
  oval(-1.22, -0.51, 0.52, 0.18, black, -0.4 + flick);
  oval(-1.22, -0.72, 0.52, 0.17, black, 0.42 + flick);
  ctx.beginPath();
  ctx.moveTo(-0.49 * r, -1.05 * r);
  ctx.quadraticCurveTo(-0.55 * r, -1.72 * r, -0.15 * r, -2.02 * r);
  ctx.quadraticCurveTo(-0.15 * r, -1.49 * r, 0.32 * r, -1.08 * r);
  ctx.fillStyle = black;
  ctx.fill();
  oval(0, -0.77, 1.23, 0.64, black, -0.08);
  oval(0.39, -0.51, 0.77, 0.23, white, -0.12);
  oval(0.69, -1.02, 0.32, 0.13, white, -0.09);
  oval(1.02, -0.84, 0.06, 0.055, '#a7c7d8');
  oval(-0.37, -0.49, 0.47, 0.15, '#1e3549', -0.32);
  oval(-0.6, -0.58, 0.26, 0.095, team, -0.32);
  if (king) {
    ctx.beginPath();
    ctx.moveTo(0.37 * r, -1.3 * r);
    ctx.lineTo(0.24 * r, -1.89 * r);
    ctx.lineTo(0.54 * r, -1.67 * r);
    ctx.lineTo(0.72 * r, -2.01 * r);
    ctx.lineTo(0.88 * r, -1.67 * r);
    ctx.lineTo(1.16 * r, -1.89 * r);
    ctx.lineTo(1.04 * r, -1.3 * r);
    ctx.closePath();
    ctx.fillStyle = '#ffdc78';
    ctx.fill();
    ctx.strokeStyle = '#a8742a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  if (king || you) {
    const label = king ? (you ? 'YOUR KING' : 'KING') : 'YOU';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0b1321cc';
    ctx.strokeText(label, at.x, at.y - r * 2.45);
    ctx.fillStyle = king ? '#ffe097' : '#ffffff';
    ctx.fillText(label, at.x, at.y - r * 2.45);
  }
}
