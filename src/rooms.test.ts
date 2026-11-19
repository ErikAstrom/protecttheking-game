import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { generateRooms } from './rooms.ts';
import { DEFAULT_SETTINGS, readSettings } from './rules.ts';

test('room partitions separate spaces without isolating any floor or blocking spawns', () => {
  for (const size of [32, 48, 63, 256]) {
    const walls = generateRooms(size);
    const blocked = new Set(walls.map(({ x, y }) => y * size + x));
    assert.equal(blocked.size, walls.length);
    assert.ok(walls.every(({ x, y, kind }) => kind === 'wall' &&
      blocked.has((size - 1 - y) * size + size - 1 - x)));
    assert.ok(walls.some(({ x }) => walls.filter(wall => wall.x === x).length >= size / 2));
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
        if (nx < 0 || nx >= size || ny < 0 || ny >= size || blocked.has(next) || visited.has(next)) continue;
        visited.add(next);
        open.push(next);
      }
    }
    assert.equal(visited.size + blocked.size, size * size);
  }
});

test('the lobby can select a round with Rooms & Corridors walls and no terrain patches', () => {
  const game = new Game();
  const settings = { ...DEFAULT_SETTINGS, world: 'rooms', teamSize: 2, pickupCount: 0, portalCount: 0 } as const;
  assert.deepEqual(readSettings(settings), settings);
  assert.equal(game.configure(settings), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  assert.equal(game.start(1000), undefined);
  assert.deepEqual(game.state.obstacles, generateRooms(settings.size));
  assert.deepEqual(game.state.terrain, []);
});
