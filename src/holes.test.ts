import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { startActiveRound } from './test-round.ts';
import { generateHoles, inHole } from './holes.ts';
import { mirror } from './layout.ts';
import { DEFAULT_SETTINGS, HOLES, TUNING } from './rules.ts';
import type { Hole, Movement, Obstacle, World } from './rules.ts';

function seeded(seed: number) {
  let value = seed;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

test('holes come in mirrored pairs in open ice, clear of starting boxes, obstacles and the edge', () => {
  const obstacles: Obstacle[] = [{ x: 20, y: 20, kind: 'wall' }, { x: 43, y: 43, kind: 'wall' }];
  for (let seed = 1; seed <= 25; seed++) {
    const size = 64;
    const holes = generateHoles(size, obstacles, seeded(seed));
    assert.ok(holes.length >= 2 && holes.length % 2 === 0, `seed ${seed}: pairs of holes (${holes.length})`);
    for (let index = 0; index < holes.length; index += 2) {
      const [a, b] = [holes[index], holes[index + 1]];
      assert.ok(a && b);
      assert.deepEqual({ x: b.x, y: b.y }, mirror(a, size));
      assert.equal(a.radius, b.radius);
    }
    for (const hole of holes) {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
        assert.ok(!inHole([hole], { x, y }, -1), `seed ${seed}: red box clear`);
        assert.ok(!inHole([hole], mirror({ x, y }, size), -1), `seed ${seed}: blue box clear`);
      }
      for (const obstacle of obstacles) assert.ok(Math.hypot(obstacle.x - hole.x, obstacle.y - hole.y) >= hole.radius + 1);
      assert.ok(hole.x - hole.radius > 0 && hole.y - hole.radius > 0 && hole.x + hole.radius < size - 1 && hole.y + hole.radius < size - 1);
    }
  }
});

function match(options: { movement?: Movement; world?: World; holes?: Hole[] } = {}) {
  const holes = options.holes ?? [{ x: 30, y: 30, radius: 2 }];
  const game = new Game(() => [], () => holes.map(hole => ({ ...hole })));
  assert.equal(game.configure({
    ...DEFAULT_SETTINGS, teamSize: 2, seconds: 60, pickupCount: 0, portalCount: 0,
    movement: options.movement ?? 'ice', world: options.world ?? 'penguin',
  }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  game.state.terrain = [];
  const [redKing, blueKing, red, blue] = game.state.players;
  assert.ok(redKing && blueKing && red && blue);
  let now = 1000;
  const run = (id: string, direction: 'right' | 'left' | 'up' | 'down' | null, ms: number) => {
    game.input(id, direction);
    for (const end = now + ms; now < end;) game.tick(now += TUNING.tickMs);
  };
  return { game, redKing, blueKing, red, blue, run, time: () => now };
}

test('sliding into a hole drops you in: you splash, are out of play, then respawn in your box', () => {
  const { game, red, run, time } = match();
  Object.assign(red, { x: 20, y: 30 });
  run(red.id, 'right', 1500);
  assert.ok(red.respawnAt > 0, 'fell in');
  assert.equal(red.outCause, 'drowned');
  assert.equal(red.deaths, 1);
  assert.ok(game.state.splashes.length === 1 || time() - (red.respawnAt - HOLES.respawnMs) >= HOLES.splashMs);
  const fellAt = { x: red.x, y: red.y };
  run(red.id, 'right', 500);
  assert.deepEqual({ x: red.x, y: red.y }, fellAt, 'no moving while in the water');
  run(red.id, null, HOLES.respawnMs);
  assert.equal(red.respawnAt, 0);
  assert.equal(red.outCause, null);
  assert.ok(red.x <= 6 && red.y <= 4, `back in red's box (${red.x}, ${red.y})`);
});

test('in Classic, stepping onto a hole tile drops you in', () => {
  const { red, run } = match({ movement: 'classic' });
  Object.assign(red, { x: 26, y: 30 });
  run(red.id, 'right', 500);
  assert.equal(red.outCause, 'drowned');
  assert.ok(red.x <= 29, 'stopped at the water');
});

test('the rim is forgiving: brushing the edge is safe', () => {
  const { red, run } = match({ movement: 'classic' });
  Object.assign(red, { x: 25, y: 28 });
  run(red.id, 'right', 1000);
  assert.equal(red.respawnAt, 0, 'passing two tiles from the centre of a radius-2 hole is safe');
});

test('kings fall in too and respawn in their box; nobody scores', () => {
  const { game, blueKing, run } = match();
  Object.assign(blueKing, { x: 36, y: 30 });
  run(blueKing.id, 'left', 1500);
  assert.equal(blueKing.outCause, 'drowned');
  assert.deepEqual(game.state.score, { red: 0, blue: 0 });
  assert.equal(game.state.phase, 'playing');
  run(blueKing.id, null, HOLES.respawnMs);
  const size = game.state.settings.size;
  assert.ok(blueKing.x >= size - 7 && blueKing.y >= size - 5, 'king back in blue box');
});

test('a strength push can shove an enemy into the water', () => {
  const { red, blue, run } = match({ movement: 'classic' });
  Object.assign(red, { x: 26, y: 30, strengthUntil: 60_000 });
  Object.assign(blue, { x: 27, y: 30 });
  run(red.id, 'right', 100);
  assert.equal(blue.outCause, 'drowned');
  assert.equal(red.respawnAt, 0, 'the pusher stays on the ice');
});

test('Castle arena has no holes, and pickups never spawn in the water', () => {
  assert.deepEqual(match({ world: 'arena' }).game.state.holes, []);
  const { game } = match({ holes: [{ x: 30, y: 30, radius: 20 }] });
  for (let index = 0; index < 30; index++) game['spawnPickup']();
  assert.ok(game.state.pickups.length > 0);
  assert.ok(game.state.pickups.every(pickup => !inHole(game.state.holes, pickup, -1)));
});
