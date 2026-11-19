import type { Obstacle } from './rules.ts';

const MIN_WALL = 5;
const DOOR_WIDTH = 3;
const MIN_ROOM_WIDTH = 4;

export function generateRooms(size: number, random = Math.random): Obstacle[] {
  const walls: Obstacle[] = [];
  const inset = Math.ceil(size * 0.18) + 1;
  const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  function partition(left: number, top: number, width: number, height: number, depth: number) {
    const minSpan = 2 * MIN_WALL + DOOR_WIDTH;
    const minSplit = 2 * MIN_ROOM_WIDTH + 1;
    const canSplitX = height >= minSpan && width >= minSplit;
    const canSplitY = width >= minSpan && height >= minSplit;
    if (!depth || (!canSplitX && !canSplitY)) return;
    const vertical = canSplitX && (!canSplitY || random() < 0.5);
    const span = vertical ? height : width;
    const across = vertical ? width : height;
    const at = pick(MIN_ROOM_WIDTH, across - MIN_ROOM_WIDTH - 1);
    const door = pick(MIN_WALL, span - MIN_WALL - DOOR_WIDTH);
    for (let along = 0; along < span; along++) {
      if (along >= door && along < door + DOOR_WIDTH) continue;
      walls.push({ x: left + (vertical ? at : along), y: top + (vertical ? along : at), kind: 'wall' });
    }

    if (vertical) {
      partition(left, top, at, height, depth - 1);
      partition(left + at + 1, top, width - at - 1, height, depth - 1);
    } else {
      partition(left, top, width, at, depth - 1);
      partition(left, top + at + 1, width, height - at - 1, depth - 1);
    }
  }
  partition(inset, inset, size - 2 * inset, size - 2 * inset, size >= 48 ? 3 : 2);
  return walls;
}
