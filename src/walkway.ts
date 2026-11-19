import type { Point } from './rules.ts';

type WalkwaySection = Point & { width: number; depth: number };
export type Walkway = WalkwaySection & { branch?: WalkwaySection };
export const WALKWAY = { width: 12, depth: 3, stairs: 2, dropMs: 200, branchMinSize: 48, branchReach: 0.52 } as const;

export function roomWalkway(size: number): Walkway {
  const walkway: Walkway = { x: Math.floor((size - WALKWAY.width) / 2), y: Math.floor(size / 8) - 1,
    width: WALKWAY.width, depth: WALKWAY.depth };
  if (size >= WALKWAY.branchMinSize) {
    const y = walkway.y + walkway.depth;
    walkway.branch = { x: Math.floor((size - WALKWAY.depth) / 2), y,
      width: WALKWAY.depth, depth: Math.floor(size * WALKWAY.branchReach) - y + 1 };
  }
  return walkway;
}

function contains(section: WalkwaySection, x: number, y: number): boolean {
  return x >= section.x && x < section.x + section.width && y >= section.y && y < section.y + section.depth;
}

export function levelAt(walkway: Walkway | undefined, point: Point): number {
  if (!walkway) return 0;
  const x = Math.round(point.x), y = Math.round(point.y);
  const deck = WALKWAY.stairs + 1;
  if (contains(walkway, x, y)) return Math.min(x - walkway.x + 1, walkway.x + walkway.width - x, deck);
  const branch = walkway.branch;
  return branch && contains(branch, x, y) ? Math.min(branch.y + branch.depth - y, deck) : 0;
}

export function stairAxisAt(walkway: Walkway | undefined, point: Point): 'x' | 'y' | undefined {
  const level = levelAt(walkway, point);
  if (!walkway || !level || level > WALKWAY.stairs) return undefined;
  return Math.round(point.y) < walkway.y + walkway.depth ? 'x' : 'y';
}

export function canTraverse(walkway: Walkway | undefined, from: Point, to: Point): boolean {
  const rise = levelAt(walkway, to) - levelAt(walkway, from);
  if (rise <= 0) return true;
  if (rise !== 1) return false;
  const axis = stairAxisAt(walkway, to) ?? stairAxisAt(walkway, from);
  if (axis === 'x') return Math.round(from.y) === Math.round(to.y);
  if (axis === 'y') return Math.round(from.x) === Math.round(to.x);
  return false;
}
