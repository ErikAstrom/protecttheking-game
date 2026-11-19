import type { Obstacle } from './rules.ts';

const DOOR_HALF_WIDTH = 1.5;

export function generateRooms(size: number): Obstacle[] {
  const outer = Math.floor(size / 4);
  const middle = Math.floor((size - 1) / 2);
  const dividers = new Set([outer, middle, size - 1 - middle, size - 1 - outer]);
  const doors = new Set<number>();
  const boundaries = [-1, ...dividers, size];
  for (let index = 1; index < boundaries.length; index++) {
    const first = boundaries[index - 1]! + 1;
    const last = boundaries[index]! - 1;
    const center = (first + last) / 2;
    for (let tile = first; tile <= last; tile++) {
      if (Math.abs(tile - center) <= DOOR_HALF_WIDTH) doors.add(tile);
    }
  }

  const walls: Obstacle[] = [];
  for (const divider of dividers) {
    for (let tile = 0; tile < size; tile++) {
      if (doors.has(tile)) continue;
      walls.push({ x: divider, y: tile, kind: 'wall' });
      if (!dividers.has(tile)) walls.push({ x: tile, y: divider, kind: 'wall' });
    }
  }
  return walls;
}
