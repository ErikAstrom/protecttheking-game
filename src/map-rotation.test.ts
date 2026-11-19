import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS, SPACE, TUNING, readSettings } from './rules.ts';

function setup(randomWorld: boolean) {
  const game = new Game(undefined, () => [{ x: 24, y: 24, radius: 2 }]);
  assert.equal(game.configure({
    ...DEFAULT_SETTINGS, world: 'rooms', randomWorld, teamSize: 2, seconds: 30,
    pickupCount: 0, portalCount: 0, tiltChance: 100,
  }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  return game;
}

test('random rounds never immediately repeat and load the selected map mechanics', t => {
  const random = t.mock.method(Math, 'random', () => 0.99);
  const game = setup(true);
  assert.equal(game.start(1000), undefined);
  assert.equal(game.state.roundWorld, 'space');
  const activeAt = 1000 + TUNING.roundCountdownMs;
  game.tick(activeAt);
  game.tick(activeAt + SPACE.maxDelayMs);
  assert.ok(game.state.blackHole, 'selected Space enables gravity even though the configured fallback is Rooms');
  game.tick(activeAt + 10000);
  assert.equal(game.state.tilt?.strength, SPACE.tiltStrength);
  game.tick(game.state.deadline);
  assert.equal(game.next(game.state.now + 1000), undefined);
  assert.equal(game.state.roundWorld, 'rooms');
  assert.equal(game.state.blackHole, null);
  assert.ok(game.state.walkway);
  game.tick(game.state.now + TUNING.roundCountdownMs);
  game.tick(game.state.deadline);
  random.mock.mockImplementation(() => 0.01);
  assert.equal(game.next(game.state.now + 1000), undefined);
  assert.equal(game.state.roundWorld, 'penguin');
  assert.equal(game.state.walkway, undefined);
  assert.equal(game.state.holes.length, 1);
  game.reset();
  assert.equal(game.state.roundWorld, undefined);
  assert.equal(game.state.settings.randomWorld, true);
});

test('a fixed map stays selected on Next round', () => {
  const game = setup(false);
  assert.equal(game.start(1000), undefined);
  game.tick(1000 + TUNING.roundCountdownMs);
  game.tick(game.state.deadline);
  assert.equal(game.next(game.state.now + 1000), undefined);
  assert.equal(game.state.roundWorld, 'rooms');
  assert.ok(game.state.walkway);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, randomWorld: 'yes' }), null);
});
