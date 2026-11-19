import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS, TUNING } from './rules.ts';
import { startActiveRound } from './test-round.ts';
import type { Movement, Obstacle } from './rules.ts';

function setup(movement: Movement, obstacles: Obstacle[] = []) {
  const game = new Game(() => obstacles, () => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, movement, pickupCount: 0, portalCount: 0 }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  const [redKing, blueKing, red, blue] = game.state.players;
  assert.ok(redKing && blueKing && red && blue);
  Object.assign(red, { x: 10, y: 10, inventory: ['vault'] });
  game.useItem(red.id, 1000);
  assert.deepEqual(red.inventory, []);
  game.input(red.id, 'right');
  return { game, red, blue, blueKing };
}

for (const movement of ['classic', 'smooth', 'ice'] as const) {
  test(`Vault crosses a wall once without changing movement speed (${movement})`, () => {
    const { game, red } = setup(movement, [
      { x: 11, y: 10, kind: 'wall' }, { x: 13, y: 10, kind: 'wall' },
    ]);
    let now = 1000;
    while (red.vaultUntil && now < 1500) game.tick(now += 25);
    assert.ok(red.x >= 11.94 && red.x <= 12.15, 'lands in the gap after the first wall');
    assert.equal(red.vaultUntil, 0);
    for (let tick = now + 25; tick <= 1500; tick += 25) game.tick(tick);
    assert.ok(red.x < 13, 'the second wall still blocks movement');
  });
}

test('Vault clears one player, but an enemy king still triggers capture', () => {
  const { game, red, blue, blueKing } = setup('classic');
  Object.assign(blue, { x: 11, y: 10 });
  Object.assign(blueKing, { x: 13, y: 10 });
  game.tick(1100);
  assert.deepEqual([red.x, blue.x, red.vaultUntil], [12, 11, 0]);
  game.tick(1200);
  assert.deepEqual(game.state.result, { reason: 'capture', winner: 'red' });

  const direct = setup('classic');
  Object.assign(direct.blueKing, { x: 11, y: 10 });
  direct.game.tick(1100);
  assert.deepEqual(direct.game.state.result, { reason: 'capture', winner: 'red' });
});

test('unsafe landings preserve the charge, which expires after five seconds', () => {
  const { game, red, blue } = setup('classic', [{ x: 11, y: 10, kind: 'wall' }]);
  Object.assign(blue, { x: 12, y: 10 });
  game.tick(1100);
  assert.equal(red.x, 10, 'cannot land on a player or skip both the wall and player');
  Object.assign(blue, { x: 15, y: 10 });
  game.state.holes = [{ x: 12, y: 10, radius: 1 }];
  game.tick(1200);
  assert.equal(red.x, 10, 'cannot land in a water hole');
  assert.equal(red.vaultUntil, 1000 + TUNING.vaultMs);
  game.state.holes = [];
  game.tick(red.vaultUntil);
  assert.equal(red.x, 10, 'the deadline itself is already expired');
});
