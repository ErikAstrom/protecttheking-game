import type { MovementTerrain } from './movement-terrain.ts';
import type { Point } from './rules.ts';

type Project = (x: number, y: number) => Point;

export function drawMovementTerrain(ctx: CanvasRenderingContext2D, project: Project, patch: MovementTerrain) {
  const { x, y, rx, ry } = patch;
  const polygon = (points: Point[], fill: string, stroke?: string) => {
    ctx.beginPath();
    points.forEach(({ x, y }, i) => {
      const p = project(x, y);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };

  if ('direction' in patch) {
    const boost = patch.kind === 'boost';
    const edge = boost ? '#59f0ec' : '#f1bb5c';
    polygon([{ x: x - rx, y: y - ry }, { x: x + rx, y: y - ry },
      { x: x + rx, y: y + ry }, { x: x - rx, y: y + ry }], boost ? '#15465c' : '#4b4039', edge);
    const { x: dx, y: dy } = patch.direction;
    const span = dx ? rx : ry;
    const width = dx ? ry : rx;
    const at = (u: number, v: number) => ({ x: x + dx * u * span - dy * v * width, y: y + dy * u * span + dx * v * width });
    for (const center of [-0.62, 0, 0.62]) {
      polygon([at(center - 0.2, -0.65), at(center, -0.65), at(center + 0.24, 0),
        at(center, 0.65), at(center - 0.2, 0.65), at(center + 0.04, 0)], edge);
    }
    return;
  }

  const colors = patch.kind === 'iceberg'
    ? ['#4fa5bc', '#82cddd', '#b5e7ee', '#dcf8ff']
    : ['#765747', '#9d755b', '#bd9470', '#ddba92'];
  for (const [layer, fill] of colors.entries()) {
    const radius = 1 - layer * 0.22;
    polygon(Array.from({ length: 20 }, (_, i) => {
      const angle = i * Math.PI / 10;
      return { x: x + rx * radius * Math.cos(angle), y: y + ry * radius * Math.sin(angle) };
    }), fill, layer === 0 ? colors[2] : undefined);
  }
}
