import { boardOutline, onBoard } from './board-shape.ts';
import type { Obstacle } from './rules.ts';
import { roomWalkway } from './walkway.ts';

const MIN_WALL = 5;
const DOOR_WIDTH = 3;
const MIN_ROOM_WIDTH = 2 * MIN_WALL + DOOR_WIDTH;
const CORRIDOR_WIDTH = 3;
type Slot = { start: number; length: number };

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
  function addRoom(column: Slot, row: Slot, turned: boolean) {
    const across = turned ? row : column;
    const down = turned ? column : row;
    const width = pick(MIN_ROOM_WIDTH, across.length);
    const depth = pick(MIN_WALL, down.length);
    const u = across.start + pick(0, across.length - width);
    const v = down.start + pick(0, down.length - depth);
    const point = (a: number, b: number) => turned ? { x: v + b, y: u + a } : { x: u + a, y: v + b };
    const corners = [point(0, 0), point(width - 1, 0), point(0, depth - 1), point(width - 1, depth - 1)];
    if (!corners.every(corner => onBoard(tightestOutline, corner, Math.SQRT1_2))) return;
    const entry = pick(MIN_WALL, width - MIN_WALL - DOOR_WIDTH);
    const exit = pick(MIN_WALL, width - MIN_WALL - DOOR_WIDTH);
    const wall = (a: number, b: number) => walls.push({ ...point(a, b), kind: 'wall' });
    for (let a = 0; a < width; a++) {
      if (a < entry || a >= entry + DOOR_WIDTH) wall(a, 0);
      if (a < exit || a >= exit + DOOR_WIDTH) wall(a, depth - 1);
    }
    for (let b = 1; b < depth - 1; b++) {
      wall(0, b);
      wall(width - 1, b);
    }
  }

  const rows = slots(top, size - inset, MIN_WALL);
  for (let i = 0; i < rows.length; i += 2) {
    const first = rows[i]!;
    const second = rows[i + 1];
    let turned = random() < 0.5;
    for (const column of columns) {
      // Neighboring bays alternate between stacked rooms and side-by-side rooms.
      if (second && turned) {
        const row = { start: first.start, length: second.start + second.length - first.start };
        const leftLength = pick(MIN_WALL, column.length - CORRIDOR_WIDTH - MIN_WALL);
        const rightStart = leftLength + CORRIDOR_WIDTH;
        addRoom({ start: column.start, length: leftLength }, row, true);
        addRoom({ start: column.start + rightStart, length: column.length - rightStart }, row, true);
      } else {
        addRoom(column, first, false);
        if (second) addRoom(column, second, false);
      }
      turned = !turned;
    }
  }
  return walls;
}
