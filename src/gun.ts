// Golden gun shot resolution. Pure function: no game state, so it's easy to test.
import type { Point, Team } from './rules.ts';

export type ShotTarget = Point & { id: string; team: Team; king: boolean };
export type ShotResult = {
  /** Where the shot ended: at a wall, a king, a hit player, or maximum range. */
  to: Point;
  /** The enemy non-king that was hit, if any. */
  hit: ShotTarget | null;
  /** What stopped the shot. */
  stoppedBy: 'wall' | 'king' | 'player' | 'range';
};

/**
 * Walks a shot along `facing` from `from` in small steps.
 * - Obstacles and the board edge stop it.
 * - It passes through the shooter's teammates.
 * - Any king (either team) absorbs it harmlessly: kings can't be shot.
 * - The first enemy non-king it touches is hit.
 */
export function castShot(
  from: Point, facing: Point, team: Team, targets: readonly ShotTarget[],
  blocked: (point: Point) => boolean, range: number, step: number, hitRadius: number,
): ShotResult {
  const length = Math.hypot(facing.x, facing.y) || 1;
  const unit = { x: facing.x / length, y: facing.y / length };
  let last = from;
  for (let travelled = step; travelled <= range + 1e-9; travelled += step) {
    const point = { x: from.x + unit.x * travelled, y: from.y + unit.y * travelled };
    if (blocked(point)) return { to: last, hit: null, stoppedBy: 'wall' };
    const touched = targets
      .filter(target => (target.king || target.team !== team) && Math.hypot(target.x - point.x, target.y - point.y) <= hitRadius)
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
    if (touched) return { to: point, hit: touched.king ? null : touched, stoppedBy: touched.king ? 'king' : 'player' };
    last = point;
  }
  return { to: last, hit: null, stoppedBy: 'range' };
}
