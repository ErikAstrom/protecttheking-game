import { boardOutline, onBoard } from './board-shape.ts';
import type { Obstacle } from './rules.ts';
import { roomWalkway } from './walkway.ts';

const MIN_WALL = 5;
const DOOR_WIDTH = 3;
const MIN_ROOM_WIDTH = 2 * MIN_WALL + DOOR_WIDTH;
const CORRIDOR_WIDTH = 3;

export function generateRooms(size: number, random = Math.random): Obstacle[] {
  const walls: Obstacle[] = [];
  const inset = Math.ceil(size * 0.16);
  const walkway = roomWalkway(size);
  const top = walkway.y + walkway.depth + CORRIDOR_WIDTH;
  const tightestOutline = boardOutline(size, 'rooms', 1);
  const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  function slots(start: number, end: number, minimum: number) {
    const count = Math.floor((end - start + CORRIDOR_WIDTH) / (minimum + CORRIDOR_WIDTH));
    const usable = end - start - (count - 1) * CORRIDOR_WIDTH;
    return Array.from({ length: count }, (_, i) => {
      const offset = Math.floor(i * usable / count);
      return { start: start + offset + i * CORRIDOR_WIDTH,
        length: Math.floor((i + 1) * usable / count) - offset };
    });
  }

  const { branch } = walkway;
  // Keep a floor lane on either side of the solid elevated route.
  const columns = branch
    ? [...slots(inset, branch.x - 1, MIN_ROOM_WIDTH), ...slots(branch.x + branch.width + 1, size - inset, MIN_ROOM_WIDTH)]
    : slots(inset, size - inset, MIN_ROOM_WIDTH);
  for (const row of slots(top, size - inset, MIN_WALL)) {
    for (const column of columns) {
      const width = pick(MIN_ROOM_WIDTH, column.length);
      const height = pick(MIN_WALL, row.length);
      const left = column.start + pick(0, column.length - width);
      const upper = row.start + pick(0, row.length - height);
      // Omit whole rooms near a corner cut rather than letting it clip a wall or doorway.
      if (!onBoard(tightestOutline, { x: left + width - 1, y: upper }, Math.SQRT1_2) ||
        !onBoard(tightestOutline, { x: left, y: upper + height - 1 }, Math.SQRT1_2)) continue;
      const northDoor = pick(MIN_WALL, width - MIN_WALL - DOOR_WIDTH);
      const southDoor = pick(MIN_WALL, width - MIN_WALL - DOOR_WIDTH);
      for (let x = 0; x < width; x++) {
        if (x < northDoor || x >= northDoor + DOOR_WIDTH) walls.push({ x: left + x, y: upper, kind: 'wall' });
        if (x < southDoor || x >= southDoor + DOOR_WIDTH) walls.push({ x: left + x, y: upper + height - 1, kind: 'wall' });
      }
      for (let y = 1; y < height - 1; y++) {
        walls.push({ x: left, y: upper + y, kind: 'wall' }, { x: left + width - 1, y: upper + y, kind: 'wall' });
      }
    }
  }
  return walls;
}
