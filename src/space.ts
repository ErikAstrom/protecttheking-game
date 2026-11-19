import { SPACE } from './rules.ts';
import type { Obstacle, Point } from './rules.ts';

export function generateSpaceWalls(size: number, random = Math.random): Obstacle[] {
  const length = Math.max(5, Math.floor(size * 0.22));
  const walls: Obstacle[] = [];
  for (const [index, band] of [0.29, 0.5, 0.71].entries()) {
    const y = Math.floor(size * (band + (random() - 0.5) * 0.08));
    const center = Math.floor(size * ((index === 1 ? 0.64 : 0.36) + (random() - 0.5) * 0.12));
    for (let x = center - Math.floor(length / 2), end = x + length; x < end; x++) walls.push({ x, y, kind: 'wall' });
  }
  return walls;
}

export function gravityStep(center: Point, player: Point, elapsed: number): Point {
  const x = center.x - player.x, y = center.y - player.y;
  const distance = Math.hypot(x, y);
  if (!distance || distance >= SPACE.radius) return { x: 0, y: 0 };
  const strength = (1 - distance / SPACE.radius) * Math.min(1, distance / SPACE.coreRadius);
  const step = Math.min(distance, SPACE.maxPullPerMs * elapsed * strength) / distance;
  return { x: x * step, y: y * step };
}
