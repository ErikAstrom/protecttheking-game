import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { generateRooms } from './rooms.ts';
import { DEFAULT_SETTINGS, readSettings } from './rules.ts';
import { boardOutline, onBoard } from './board-shape.ts';
import { levelAt, roomWalkway } from './walkway.ts';

for (const size of [32, 48, 63, 256]) {
  test(`rooms keep wall runs at least five tiles long and the floor connected (${size})`, () => {
    let seed = size;
    const walls = generateRooms(size, () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const outline = boardOutline(size, 'rooms', 1, 0.98);
    const blocked = new Set(walls.map(({ x, y }) => y * size + x));
    assert.equal(blocked.size, walls.length);
    assert.ok(walls.length && walls.every(wall => wall.kind === 'wall' && onBoard(outline, wall, Math.SQRT1_2)));
    const contains = (x: number, y: number) => x >= 0 && x < size && blocked.has(y * size + x);
    for (const { x, y } of walls) {
      assert.ok([true, false].some(vertical => [-4, -3, -2, -1, 0].some(offset =>
        [0, 1, 2, 3, 4].every(step => contains(x + (vertical ? 0 : offset + step), y + (vertical ? offset + step : 0))))),
      `wall tile ${x},${y} must be part of a run of at least five`);
    }
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 7; x++) {
        assert.ok(!contains(x, y));
        assert.ok(!contains(size - 1 - x, size - 1 - y));
      }
    }

    const walkway = roomWalkway(size);
    for (let y = walkway.y - 1; y <= walkway.y + walkway.depth; y++) {
      for (let x = walkway.x - 1; x <= walkway.x + walkway.width; x++) assert.ok(!contains(x, y));
    }
    if (walkway.branch) {
      const { x, y, width, depth } = walkway.branch;
      for (let row = y; row <= y + depth; row++) {
        for (let column = x - 1; column <= x + width; column++) assert.ok(!contains(column, row));
      }
    }
    const isFloor = (x: number, y: number) =>
      onBoard(outline, { x, y }) && !contains(x, y) && !levelAt(walkway, { x, y });

    const open = [0];
    const visited = new Set(open);
    for (const tile of open) {
      const x = tile % size;
      const y = Math.floor(tile / size);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        const next = ny * size + nx;
        if (!isFloor(nx, ny) || visited.has(next)) continue;
        visited.add(next);
        open.push(next);
      }
    }
    let floorTiles = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) if (isFloor(x, y)) floorTiles++;
    }
    assert.equal(visited.size, floorTiles);
  });
}

test('the default layout varies room formations while preserving eight two-exit rooms', () => {
  const size = DEFAULT_SETTINGS.size;
  const formations = new Set<string>();
  for (const initialSeed of [1, 23, 48, 2026]) {
    let seed = initialSeed;
    const walls = generateRooms(size, () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const blocked = new Set(walls.map(({ x, y }) => `${x},${y}`));
    const rooms: { left: number; right: number; top: number; bottom: number; turned: boolean }[] = [];
    const has = (x: number, y: number) => blocked.has(`${x},${y}`);
    for (const { x: left, y: top } of walls) {
      if (has(left - 1, top) || has(left, top - 1) || !has(left, top + 1) || !has(left + 1, top)) continue;
      let endOfTop = left;
      while (has(endOfTop + 1, top)) endOfTop++;
      const turned = has(endOfTop, top + 1);
      const at = (u: number, v: number) => turned ? has(left + v, top + u) : has(left + u, top + v);
      let depth = 1;
      while (at(0, depth)) depth++;
      let door = 0;
      while (at(door, 0)) door++;
      let width = door + 3;
      while (at(width, 0)) width++;
      for (const edge of [0, depth - 1]) {
        const opening = Array.from({ length: width }, (_, u) => u).filter(u => !at(u, edge));
        assert.equal(opening.length, 3);
        assert.equal(opening[2]! - opening[0]!, 2);
      }
      for (let v = 1; v < depth - 1; v++) {
        assert.ok(at(0, v) && at(width - 1, v));
        for (let u = 1; u < width - 1; u++) assert.ok(!at(u, v));
      }
      const right = left + (turned ? depth : width) - 1;
      const bottom = top + (turned ? width : depth) - 1;
      for (const other of rooms) {
        assert.ok(Math.max(other.left - right, left - other.right, other.top - bottom, top - other.bottom) >= 4);
      }
      rooms.push({ left, right, top, bottom, turned });
    }
    assert.equal(rooms.length, 8);
    assert.ok(rooms.some(room => room.turned) && rooms.some(room => !room.turned));
    formations.add(rooms.map(({ left, right, top, bottom }) => `${left},${right},${top},${bottom}`).sort().join(';'));
  }
  assert.ok(formations.size > 1, 'random draws change the room footprints, not just the doorways');
});

test('the lobby can select a round with Rooms & Corridors walls and no terrain patches', () => {
  const game = new Game();
  const settings = { ...DEFAULT_SETTINGS, world: 'rooms', teamSize: 2, pickupCount: 0, portalCount: 0 } as const;
  assert.deepEqual(readSettings(settings), settings);
  assert.equal(game.configure(settings), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  assert.equal(game.start(1000), undefined);
  assert.ok(game.state.obstacles.some(wall => wall.kind === 'wall'));
  assert.deepEqual(game.state.terrain, []);
});
