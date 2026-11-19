// Water holes in the ice sheet (Penguin world). Pure functions only: generation and the "did you fall in" test.
import { mirror } from './layout.ts';
import { HOLES } from './rules.ts';
import type { Hole, Obstacle, Point } from './rules.ts';

/** True when `point` is inside a hole, at least `margin` tiles past its rim (negative margin = keep that far away). */
export function inHole(holes: readonly Hole[], point: Point, margin: number = HOLES.edgeMargin): boolean {
  return holes.some(hole => Math.hypot(point.x - hole.x, point.y - hole.y) < hole.radius - margin);
}

/**
 * Mirrored pairs of round holes placed in open ice: inside the board, clear of both starting boxes,
 * not touching obstacles, and not crowding each other.
 */
export function generateHoles(size: number, obstacles: readonly Obstacle[], random = Math.random): Hole[] {
  const holes: Hole[] = [];
  const pairs = Math.max(1, Math.round(size / HOLES.tilesPerPair));
  const clearOfBox = (x: number, y: number, radius: number) =>
    !(x < 7 + radius + HOLES.boxClearance && y < 5 + radius + HOLES.boxClearance);
  const fits = (hole: Hole) => {
    const { x, y, radius } = hole;
    const edge = radius + HOLES.edgeClearance;
    if (x < edge || y < edge || x > size - 1 - edge || y > size - 1 - edge) return false;
    const partner = mirror(hole, size);
    if (!clearOfBox(x, y, radius) || !clearOfBox(partner.x, partner.y, radius)) return false;
    if (Math.hypot(x - partner.x, y - partner.y) < 2 * radius + HOLES.spacing) return false;
    if (obstacles.some(obstacle => Math.hypot(obstacle.x - x, obstacle.y - y) < radius + HOLES.obstacleClearance)) return false;
    return holes.every(other => Math.hypot(other.x - x, other.y - y) >= other.radius + radius + HOLES.spacing);
  };
  for (let pair = 0; pair < pairs; pair++) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const radius = HOLES.minRadius + random() * (HOLES.maxRadius - HOLES.minRadius);
      const hole = { x: random() * (size - 1), y: random() * (size - 1), radius };
      if (!fits(hole)) continue;
      holes.push(hole, { ...mirror(hole, size), radius });
      break;
    }
  }
  return holes;
}
