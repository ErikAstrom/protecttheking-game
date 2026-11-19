import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardOutline, onBoard } from './board-shape.ts';
import { Game } from './game.ts';
import { generateMovementTerrain, movementTerrainAt, terrainSpeed, TRAVERSAL } from './movement-terrain.ts';
import type { MovementTerrain } from './movement-terrain.ts';
import { DEFAULT_SETTINGS, TUNING, WORLDS } from './rules.ts';
import type { Movement, Point, World } from './rules.ts';
import { startActiveRound } from './test-round.ts';
import { levelAt } from './walkway.ts';

const hillside = { x: 16, y: 16, rx: 3, ry: 2, kind: 'iceberg' } as const;
const east = { x: 1, y: 0 };
const west = { x: -1, y: 0 };

function setup(world: World, movement: Movement, generated = false, size = 48) {
  const game = generated ? new Game() : new Game(() => [], () => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, size, world, movement, teamSize: 2, pickupCount: 0, portalCount: 0, tiltChance: 0 }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  return game;
}

test('all worlds publish a clear, mirrored pair of movement features', () => {
  const kinds = { penguin: 'iceberg', arena: 'rubble', rooms: 'conveyor', space: 'boost' };
  for (const world of WORLDS) for (const size of [32, 48, 96]) {
    const game = setup(world, 'ice', true, size);
    startActiveRound(game, 1000);
    const { movementTerrain, outline, obstacles, holes, walkway } = game.state;
    const [a, b] = movementTerrain;
    assert.ok(outline && a && b, `${world} at ${size} tiles`);
    assert.equal(a.kind, kinds[world]);
    assert.equal(b.kind, kinds[world]);
    assert.equal(a.x + b.x, size - 1);
    assert.equal(a.y + b.y, size - 1);
    if ('direction' in a && 'direction' in b) {
      assert.equal(a.direction.x + b.direction.x, 0);
      assert.equal(a.direction.y + b.direction.y, 0);
    }
    for (const patch of [a, b]) {
      for (const dx of [-patch.rx, patch.rx]) for (const dy of [-patch.ry, patch.ry]) {
        assert.ok(onBoard(outline, { x: patch.x + dx, y: patch.y + dy }, 0.5));
      }
      assert.ok(obstacles.every(tile => !movementTerrainAt([patch], tile)));
      assert.ok(holes.every(hole => !movementTerrainAt([patch], hole)));
      assert.equal(levelAt(walkway, patch), 0);
    }
    game.reset();
    assert.deepEqual(game.state.movementTerrain, []);
  }
});

test('mounds and conveyors affect direction, not idle or crosswise movement', () => {
  const flank = { x: 14.5, y: 16 };
  for (const kind of ['iceberg', 'rubble'] as const) {
    const mound = { ...hillside, kind };
    assert.ok(terrainSpeed(mound, flank, east) < 0.85);
    assert.ok(terrainSpeed(mound, flank, west) > 1.15);
    assert.equal(terrainSpeed(mound, flank, { x: 0, y: 1 }), 1);
    assert.equal(terrainSpeed(mound, flank, null), 1);
    assert.ok(terrainSpeed(mound, { x: 17.5, y: 16 }, east) > 1.15);
  }
  const belt = { ...hillside, kind: 'conveyor', direction: east } as const;
  assert.ok(terrainSpeed(belt, flank, east) > 1.2);
  assert.ok(terrainSpeed(belt, flank, west) < 0.8);
  assert.equal(terrainSpeed(belt, flank, { x: 0, y: 1 }), 1);
});

for (const movement of ['classic', 'smooth', 'ice'] as const) {
  test(`server applies uphill and downhill speeds in ${movement} without blocking or moving idle players`, () => {
    function run(direction: 'left' | 'right' | null, patch?: MovementTerrain) {
      const game = setup('penguin', movement);
      startActiveRound(game, 1000);
      game.state.terrain = [];
      game.state.movementTerrain = patch ? [patch] : [];
      const p = game.state.players[0]!;
      Object.assign(p, { x: 15, y: 16 });
      game.input(p.id, direction);
      if (movement === 'classic' && direction) {
        for (let now = 1000 + TUNING.tickMs; now < 1500; now += TUNING.tickMs) {
          game.tick(now);
          if (Math.abs(p.x - 15) === 2) return 1500 - now;
        }
        return 0;
      }
      for (let now = 1000 + TUNING.tickMs; now <= 1000 + TUNING.moveMs * 1.27; now += TUNING.tickMs) game.tick(now);
      return Math.abs(p.x - 15);
    }
    assert.ok(run('right', hillside) < run('right'));
    assert.ok(run('left', hillside) > run('left'));
    assert.equal(run(null, hillside), 0);
  });
}

test('a Space lane grants a brief carry-out boost only in the marked direction', () => {
  function run(lane: boolean, direction: 'right' | 'left' | null) {
    const game = setup('space', 'smooth');
    startActiveRound(game, 1000);
    game.state.movementTerrain = lane ? [{ x: 16, y: 16, rx: 2.5, ry: 0.85, kind: 'boost', direction: east }] : [];
    const p = game.state.players[0]!;
    const x = direction === 'left' ? 13.75 : 18.25;
    Object.assign(p, { x, y: 16 });
    game.input(p.id, direction);
    for (let now = 1000 + TUNING.tickMs; now <= 1000 + 300; now += TUNING.tickMs) game.tick(now);
    const early = Math.abs(p.x - x);
    for (let now = 1300 + TUNING.tickMs; now <= 1300 + TRAVERSAL.boostMs + 550; now += TUNING.tickMs) game.tick(now);
    const before = p.x;
    game.tick(game.state.now + TUNING.tickMs);
    return { early, last: Math.abs(p.x - before) };
  }
  const boosted = run(true, 'right');
  const neutral = run(false, 'right');
  assert.ok(boosted.early > neutral.early * 1.2 && boosted.early > 0.25);
  assert.ok(Math.abs(boosted.last - neutral.last) < 0.001);
  assert.deepEqual(run(true, 'left'), run(false, 'left'));
  assert.equal(run(true, null).early, 0);
});

test('placement never forces a feature through occupied ground', () => {
  assert.deepEqual(generateMovementTerrain(32, 'rooms', [], () => true), []);
});

test('Space lanes point inward and reserve room to run out past the arrows', () => {
  const size = 32;
  const outline = boardOutline(size, 'space', 0.1, 0.9);
  const blocked = ({ x, y }: { x: number; y: number }) => x === 14 && y >= 7 && y <= 13;
  for (const [x, y, orientation, sign] of [[5, 10, 0, 0.9], [26, 10, 0, 0], [10, 5, 0.9, 0.9], [10, 26, 0.9, 0]] as const) {
    const draws = [(y * size + x + 0.5) / size ** 2, orientation, sign];
    const lanes = generateMovementTerrain(size, 'space', outline, blocked, () => draws.shift() ?? 0);
    assert.equal(lanes.length, 2);
    for (const lane of lanes) {
      assert.ok(lane.kind === 'boost' && 'direction' in lane);
      const { x: dx, y: dy } = lane.direction;
      assert.ok(dx * ((size - 1) / 2 - lane.x) + dy * ((size - 1) / 2 - lane.y) > 0);
      const length = dx ? lane.rx : lane.ry;
      const width = dx ? lane.ry : lane.rx;
      for (let distance = length; distance <= length + 6; distance += 0.25) {
        for (const side of [-width, 0, width]) {
          const point: Point = { x: lane.x + dx * distance - dy * side, y: lane.y + dy * distance + dx * side };
          assert.ok(onBoard(outline, point, 0.5));
          assert.ok(!blocked({ x: Math.round(point.x), y: Math.round(point.y) }));
        }
      }
    }
  }
});
