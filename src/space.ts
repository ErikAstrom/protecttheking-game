import { SPACE } from './rules.ts';
import type { Point } from './rules.ts';

export function gravityStep(center: Point, player: Point, elapsed: number): Point {
  const x = center.x - player.x, y = center.y - player.y;
  const distance = Math.hypot(x, y);
  if (!distance || distance >= SPACE.radius) return { x: 0, y: 0 };
  const strength = (1 - distance / SPACE.radius) * Math.min(1, distance / SPACE.coreRadius);
  const step = Math.min(distance, SPACE.maxPullPerMs * elapsed * strength) / distance;
  return { x: x * step, y: y * step };
}
