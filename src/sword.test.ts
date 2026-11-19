import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS, COMMON_ITEMS, SWORD, TUNING } from './rules.ts';
import type { Movement } from './rules.ts';
import { findChops } from './sword.ts';
import type { Swordsman } from './sword.ts';
import { startActiveRound } from './test-round.ts';

const unit = (id: string, x: number, team: 'red' | 'blue', extra: Partial<Swordsman> = {}): Swordsman =>
  ({ id, x, y: 10, team, king: false, swordUntil: 0, respawnAt: 0, ...extra });

test('findChops: a drawn sword chops enemy non-kings in reach, never kings, teammates or the dead', () => {
  const players = [
    unit('hero', 10, 'red', { swordUntil: 5000 }),
    unit('enemy', 11, 'blue'),
    unit('far', 13, 'blue'),
    unit('mate', 9, 'red'),
    unit('king', 10.5, 'blue', { king: true }),
    unit('ghost', 10.2, 'blue', { respawnAt: 9000 }),
  ];
  assert.deepEqual(findChops(players, 1000, SWORD.reachTiles), [{ chopperId: 'hero', victimId: 'enemy' }]);
  assert.deepEqual(findChops(players, 6000, SWORD.reachTiles), [], 'nothing once the sword is put away');
});

test('findChops: two swordsmen in reach do not both die', () => {
  const chops = findChops([unit('a', 10, 'red', { swordUntil: 5000 }), unit('b', 11, 'blue', { swordUntil: 5000 })], 1000, SWORD.reachTiles);
  assert.equal(chops.length, 1);
});

test('the sword is a common pickup', () => {
  assert.ok((COMMON_ITEMS as readonly string[]).includes('sword'));
});

function match(movement: Movement = 'classic') {
  const game = new Game(() => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, seconds: 60, pickupCount: 0, portalCount: 0, movement }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  game.state.terrain = [];
  game.state.holes = [];
  game.state.movementTerrain = [];
  const [redKing, blueKing, red, blue] = game.state.players;
  assert.ok(redKing && blueKing && red && blue);
  Object.assign(red, { x: 20, y: 30, inventory: ['sword'] });
  Object.assign(blue, { x: 24, y: 30 });
  Object.assign(redKing, { x: 10, y: 40 });
  Object.assign(blueKing, { x: 40, y: 40 });
  let now = 1000;
  const run = (id: string, direction: 'right' | 'left' | null, ms: number) => {
    game.input(id, direction);
    for (const end = now + ms; now < end;) game.tick(now += TUNING.tickMs);
  };
  return { game, redKing, blueKing, red, blue, run, time: () => now };
}

test('Space draws the sword for ten seconds and uses up the item', () => {
  const { game, red } = match();
  game.useItem(red.id, 1000);
  assert.equal(red.swordUntil, 1000 + SWORD.activeMs);
  assert.deepEqual(red.inventory, []);
});

for (const movement of ['classic', 'ice'] as const) {
  test(`${movement}: running into an enemy with the sword out chops them, and they respawn later`, () => {
    const { game, red, blue, run } = match(movement);
    game.useItem(red.id, 1000);
    run(red.id, 'right', 800);
    assert.equal(blue.outCause, 'chopped');
    assert.equal(red.kills, 1);
    assert.equal(red.respawnAt, 0);
    assert.ok(game.state.slashes.length > 0 || blue.respawnAt > 0);
    run(red.id, null, SWORD.respawnMs + 200);
    const size = game.state.settings.size;
    assert.equal(blue.respawnAt, 0);
    assert.ok(blue.x >= size - 7 && blue.y >= size - 5, 'chopped player is back in their box');
  });
}

test('an enemy who runs into a drawn sword is chopped too', () => {
  const { game, red, blue, run } = match();
  game.useItem(red.id, 1000);
  Object.assign(blue, { x: 23, y: 30 });
  run(blue.id, 'left', 400);
  assert.equal(blue.outCause, 'chopped');
});

test('unlimited chops while it is out, none after ten seconds', () => {
  const { game, red, blue, run, time } = match();
  const [, , , , extra] = game.state.players;
  assert.equal(extra, undefined);
  game.useItem(red.id, 1000);
  for (let round = 0; round < 3; round++) {
    Object.assign(blue, { x: red.x + 1, y: red.y, respawnAt: 0, outCause: null });
    run(red.id, null, 50);
    assert.equal(blue.outCause, 'chopped', `chop ${round + 1}`);
  }
  assert.equal(red.kills, 3);
  run(red.id, null, 1000 + SWORD.activeMs - time() + 50);
  Object.assign(blue, { x: red.x + 1, y: red.y, respawnAt: 0, outCause: null });
  run(red.id, null, 100);
  assert.equal(blue.respawnAt, 0, 'sword is put away after ten seconds');
});

test('the sword does nothing to kings: touching the enemy king is still a normal capture', () => {
  const { game, red, blueKing, run } = match();
  game.useItem(red.id, 1000);
  Object.assign(blueKing, { x: red.x + 1, y: red.y });
  run(red.id, null, 50);
  assert.equal(blueKing.respawnAt, 0, 'the king is not chopped by reach');
  run(red.id, 'right', 200);
  assert.equal(blueKing.respawnAt, 0);
  assert.deepEqual(game.state.result, { winner: 'red', reason: 'capture' }, 'normal capture rules apply');
});

test('teammates are safe from your sword', () => {
  const { game, red, redKing, run } = match();
  const mate = game.state.players.find(player => player.team === 'red' && player !== red && player !== redKing);
  assert.equal(mate, undefined, 'only one red non-king in a 2v2');
  game.useItem(red.id, 1000);
  Object.assign(redKing, { x: red.x + 1, y: red.y });
  run(red.id, null, 50);
  assert.equal(redKing.respawnAt, 0);
});
