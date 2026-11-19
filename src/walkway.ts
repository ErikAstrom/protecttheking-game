import type { Point } from './rules.ts';

export type Walkway = Point & { width: number; depth: number };
export const WALKWAY = { width: 12, depth: 3, stairs: 2, dropMs: 200 } as const;

export function roomWalkway(size: number): Walkway {
  return { x: Math.floor((size - WALKWAY.width) / 2), y: Math.floor(size / 8) - 1,
    width: WALKWAY.width, depth: WALKWAY.depth };
}

export function levelAt(walkway: Walkway | undefined, point: Point): number {
  if (!walkway) return 0;
  const x = Math.round(point.x) - walkway.x;
  const y = Math.round(point.y) - walkway.y;
  if (y < 0 || y >= walkway.depth || x < 0 || x >= walkway.width) return 0;
  return Math.min(x + 1, walkway.width - x, WALKWAY.stairs + 1);
}

export function canTraverse(walkway: Walkway | undefined, from: Point, to: Point): boolean {
  const rise = levelAt(walkway, to) - levelAt(walkway, from);
  return rise <= 0 || (rise === 1 && Math.round(from.y) === Math.round(to.y));
}
