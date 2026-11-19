import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { generateRooms } from './rooms.ts';
import { DEFAULT_SETTINGS, readSettings } from './rules.ts';
import { boardOutline, onBoard } from './board-shape.ts';

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
      for (let x = 0; x < 7; x++) assert.ok(!blocked.has(y * size + x));
    }

    const open = [0];
    const visited = new Set(open);
    for (const tile of open) {
      const x = tile % size;
      const y = Math.floor(tile / size);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        const next = ny * size + nx;
        if (!onBoard(outline, { x: nx, y: ny }) || blocked.has(next) || visited.has(next)) continue;
        visited.add(next);
        open.push(next);
      }
    }
    let floorTiles = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) if (onBoard(outline, { x, y }) && !contains(x, y)) floorTiles++;
    }
    assert.equal(visited.size, floorTiles);
  });
}

test('room partitions vary with the random draw', () => {
  assert.notDeepEqual(generateRooms(48, () => 0.1), generateRooms(48, () => 0.9));
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
