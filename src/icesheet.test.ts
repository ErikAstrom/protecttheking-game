import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { ICE_SHEET, generateIceSheet, nearSpawn, openTiles } from './icesheet.ts';
import { generateArena, mirror } from './layout.ts';
import { DEFAULT_SETTINGS } from './rules.ts';
import type { Settings } from './rules.ts';

const SIZES = [32, 48, 63, 64, 256];

function seeded(seed: number) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

test('ice sheets are mirrored, in bounds, and keep spawns and the edge lane clear', () => {
  for (const size of SIZES) {
    const random = seeded(size);
    for (let round = 0; round < 10; round++) {
      const sheet = generateIceSheet(size, random);
      const kinds = new Map(sheet.map(tile => [`${tile.x},${tile.y}`, tile.kind]));
      assert.equal(kinds.size, sheet.length, 'no duplicate tiles');
      for (const tile of sheet) {
        const lane = ICE_SHEET.edgeLane;
        assert.ok(tile.x >= lane && tile.y >= lane && tile.x < size - lane && tile.y < size - lane);
        assert.ok(!nearSpawn(tile, size, ICE_SHEET.spawnClearance));
        const partner = mirror(tile, size);
        assert.equal(kinds.get(`${partner.x},${partner.y}`), tile.kind);
      }
    }
  }
});

test('ice sheets have far fewer obstacles than the castle walls but chunky icebergs', () => {
  for (const size of SIZES) {
    const random = seeded(size + 1);
    let sheetTiles = 0, arenaTiles = 0;
    for (let round = 0; round < 10; round++) {
      const sheet = generateIceSheet(size, random);
      sheetTiles += sheet.length;
      arenaTiles += generateArena(size, random).length;
      const blocked = new Set(sheet.map(tile => `${tile.x},${tile.y}`));
      // Chunky: every ice tile has at least two ice neighbours (no thin, one-tile-wide walls).
      for (const { x, y } of sheet) {
        const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx = 0, dy = 0]) => blocked.has(`${x + dx},${y + dy}`));
        assert.ok(neighbours.length >= 2, `tile ${x},${y} on a ${size} board is too thin`);
      }
      assert.ok(sheet.length >= 2 * ICE_SHEET.minSide ** 2, 'some icebergs are always present');
    }
    assert.ok(sheetTiles < arenaTiles * 0.8, `${size}: ${sheetTiles} ice tiles vs ${arenaTiles} castle tiles`);
  }
});

test('ice sheets are mostly open ice and every open tile is reachable', () => {
  for (const size of SIZES) {
    const sheet = generateIceSheet(size, seeded(size + 2));
    // Most of the board is at least two tiles away from any iceberg: room to build up speed and slide.
    assert.ok(openTiles(size, sheet, 2).length > 0.65 * size * size);
    const blocked = new Set(sheet.map(tile => tile.y * size + tile.x));
    const visited = new Set([0]);
    const queue = [0];
    for (const index of queue) {
      const x = index % size, y = Math.floor(index / size);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        const next = ny * size + nx;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size || blocked.has(next) || visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    assert.equal(visited.size + blocked.size, size * size);
  }
});

test('Penguin world rounds use the ice sheet and Castle arena keeps the dense walls', () => {
  const obstacles = (world: Settings['world']) => {
    const game = new Game();
    assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, pickupCount: 0, portalCount: 0, world }), undefined);
    for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
    assert.equal(game.start(1000), undefined);
    return game.state.obstacles;
  };
  const size = DEFAULT_SETTINGS.size;
  const ice = obstacles('penguin');
  assert.ok(ice.every(tile => !nearSpawn(tile, size, ICE_SHEET.spawnClearance)));
  // Icebergs are plain ice blocks; the castle layout always has crates and pillars.
  assert.ok(ice.length > 0 && ice.every(tile => tile.kind === 'wall'));
  assert.ok(obstacles('arena').some(tile => tile.kind !== 'wall'));
});
