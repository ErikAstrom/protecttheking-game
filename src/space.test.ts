import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS, SPACE, TUNING } from './rules.ts';
import type { Movement } from './rules.ts';
import { startActiveRound } from './test-round.ts';
import { gravityStep } from './space.ts';

function setup(movement: Movement, world: 'space' | 'rooms' = 'space') {
  const game = new Game(() => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, world, movement, teamSize: 2, pickupCount: 0, portalCount: 0 }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  return game;
}

for (const movement of ['classic', 'smooth', 'ice'] as const) {
  test(`Space gravity pulls idle players, then releases them without eliminating the king (${movement})`, () => {
    const game = setup(movement);
    game.tick(1000 + SPACE.minDelayMs - 1);
    assert.equal(Boolean(game.state.blackHole), false, 'no field before the spawn window');
    const spawnedAt = 1000 + SPACE.maxDelayMs;
    game.tick(spawnedAt);
    const { blackHole: hole } = game.state;
    const [king, , guard] = game.state.players;
    assert.ok(hole && king && guard);
    Object.assign(king, { x: hole.x - 3, y: hole.y });
    Object.assign(guard, { x: hole.x + SPACE.radius, y: hole.y });
    for (let now = spawnedAt + TUNING.tickMs; now < hole.expires; now += TUNING.tickMs) game.tick(now);
    assert.ok(king.x >= hole.x - 1 && king.x <= hole.x);
    assert.equal(king.respawnAt, 0);
    assert.equal(guard.x, hole.x + SPACE.radius, 'the pull does not reach past the visible field');
    assert.equal(game.state.result, null);
    const position = king.x;
    game.tick(hole.expires);
    game.tick(hole.expires + TUNING.tickMs);
    assert.equal(game.state.blackHole, null);
    assert.equal(king.x, position, 'the field no longer pulls after expiry');
  });
}

test('a player can steer against the pull and leave the field', () => {
  const game = setup('ice');
  const now = 1000 + SPACE.maxDelayMs;
  game.tick(now);
  const hole = game.state.blackHole;
  const [king] = game.state.players;
  assert.ok(hole && king);
  Object.assign(king, { x: hole.x - 2, y: hole.y });
  game.input(king.id, 'left');
  for (let time = now + TUNING.tickMs; time <= now + 2500; time += TUNING.tickMs) game.tick(time);
  assert.equal(game.state.blackHole, hole);
  assert.ok(king.x < hole.x - SPACE.radius);
});

test('Space adds solid bulkheads and gravity moves a nearby idle player more than three tiles per second', () => {
  const game = new Game();
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, world: 'space', movement: 'classic', teamSize: 2, portalCount: 0 }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  const [player] = game.state.players;
  const [wall] = game.state.obstacles;
  assert.ok(player && wall && game.state.obstacles.length >= 15);
  Object.assign(player, { x: wall.x, y: wall.y - 1 });
  game.input(player.id, 'down');
  game.tick(1025);
  assert.equal(player.y, wall.y - 1);
  let position = { x: 4, y: 0 };
  for (let now = 0; now < 1000; now += TUNING.tickMs) {
    const delta = gravityStep({ x: 0, y: 0 }, position, TUNING.tickMs);
    position = { x: position.x + delta.x, y: 0 };
  }
  assert.ok(position.x < 1);
});

test('the gravity hazard stays off other maps', () => {
  const game = setup('smooth', 'rooms');
  game.tick(1000 + SPACE.maxDelayMs * 2);
  assert.equal(game.state.blackHole, null);
});
