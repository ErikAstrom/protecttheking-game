import { SPACE } from './rules.ts';
import type { BlackHole, Point } from './rules.ts';

type Project = (x: number, y: number) => Point;

export function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#09091a';
  ctx.fillRect(0, 0, width, height);
  for (let index = 0; index < 150; index++) {
    ctx.fillStyle = index % 9 === 0 ? '#99b9ff' : '#69739b';
    const size = index % 9 === 0 ? 2 : 1;
    ctx.fillRect((index * 193 + index ** 2 * 17) % width, (index * 113 + index ** 2 * 7) % height, size, size);
  }
}

export function drawBlackHole(ctx: CanvasRenderingContext2D, project: Project, hole: BlackHole, time: number) {
  function ring(radius: number) {
    ctx.beginPath();
    for (let i = 0; i < 48; i++) {
      const angle = i * Math.PI / 24;
      const p = project(hole.x + radius * Math.cos(angle), hole.y + radius * Math.sin(angle));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }
  ctx.save();
  ring(SPACE.radius);
  ctx.fillStyle = '#9251d529';
  ctx.fill();
  ctx.strokeStyle = '#c69aff';
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ring(SPACE.coreRadius * 1.65);
  ctx.strokeStyle = '#ffb990';
  ctx.lineWidth = 3;
  ctx.stroke();
  ring(SPACE.coreRadius);
  ctx.fillStyle = '#04020a';
  ctx.fill();

  for (let index = 0; index < 18; index++) {
    const phase = ((index / 18 + time / 3200) % 1);
    const radius = SPACE.radius - (SPACE.radius - SPACE.coreRadius) * phase;
    const angle = index * 2.4 + phase * Math.PI * 2;
    const point = project(hole.x + Math.cos(angle) * radius, hole.y + Math.sin(angle) * radius);
    ctx.fillStyle = index % 3 ? '#c69aff' : '#ffcc9f';
    ctx.fillRect(point.x, point.y, 3, 2);
  }
  ctx.restore();
}
