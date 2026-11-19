// Sword: who gets chopped. Pure function over a minimal player shape, so it's easy to test.
import type { Point, Team } from './rules.ts';

export type Swordsman = Point & { id: string; team: Team; king: boolean; swordUntil: number; respawnAt: number };
export type Chop = { chopperId: string; victimId: string };

/**
 * Every enemy non-king within `reach` of a player whose sword is out gets chopped (once, by the nearest swordsman).
 * Kings are never chopped and never hold swords; dead players are ignored.
 */
export function findChops(players: readonly Swordsman[], now: number, reach: number): Chop[] {
  const alive = players.filter(player => !player.respawnAt);
  const holders = alive.filter(player => !player.king && player.swordUntil > now);
  const chops: Chop[] = [];
  for (const victim of alive) {
    if (victim.king) continue;
    const chopper = holders
      .filter(holder => holder.team !== victim.team && Math.hypot(holder.x - victim.x, holder.y - victim.y) <= reach)
      .sort((a, b) => Math.hypot(a.x - victim.x, a.y - victim.y) - Math.hypot(b.x - victim.x, b.y - victim.y))[0];
    if (chopper) chops.push({ chopperId: chopper.id, victimId: victim.id });
  }
  // Two swordsmen in reach of each other would chop each other; the first in the list (turn order) wins.
  const gone = new Set<string>();
  return chops.filter(chop => {
    if (gone.has(chop.chopperId)) return false;
    gone.add(chop.victimId);
    return true;
  });
}
