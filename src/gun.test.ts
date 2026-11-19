import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { castShot } from './gun.ts';
import type { ShotTarget } from './gun.ts';
import { DEFAULT_SETTINGS, GUN, TUNING } from './rules.ts';
import type { Movement } from './rules.ts';

const open = () => false;
const target = (id: string, x: number, team: 'red' | 'blue', king = false): ShotTarget => ({ id, x, y: 10, team, king });
const shoot = (targets: ShotTarget[], blocked: (p: { x: number; y: number }) => boolean = open) =>
  castShot({ x: 0, y: 10 }, { x: 1, y: 0 }, 'red', targets, blocked, GUN.rangeTiles, GUN.stepTiles, GUN.hitRadius);

test('a shot hits the first enemy non-king in line', () => {
  const result = shoot([target('far', 8, 'blue'), target('near', 4, 'blue')]);
  assert.equal(result.hit?.id, 'near');
  assert.equal(result.stoppedBy, 'player');
});

test('a shot passes through teammates', () => {
  assert.equal(shoot([target('mate', 3, 'red'), target('enemy', 6, 'blue')]).hit?.id, 'enemy');
});

test('kings of either team absorb shots without being hit', () => {
  for (const team of ['red', 'blue'] as const) {
    const result = shoot([target('king', 3, team, true), target('enemy', 6, 'blue')]);
    assert.equal(result.hit, null);
    assert.equal(result.stoppedBy, 'king');
  }
});

test('walls stop shots, and shots have a maximum range', () => {
  const wall = shoot([target('enemy', 8, 'blue')], point => Math.round(point.x) === 5);
  assert.deepEqual([wall.hit, wall.stoppedBy], [null, 'wall']);
  assert.ok(wall.to.x < 5);
  const far = shoot([target('enemy', GUN.rangeTiles + 3, 'blue')]);
  assert.deepEqual([far.hit, far.stoppedBy], [null, 'range']);
});

function match(movement: Movement = 'classic') {
  const game = new Game(() => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, seconds: 60, pickupCount: 0, portalCount: 0, movement }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  assert.equal(game.start(1000), undefined);
  game.state.terrain = [];
  const [redKing, blueKing, red, blue] = game.state.players;
  assert.ok(redKing && blueKing && red && blue);
  Object.assign(red, { x: 20, y: 30, facing: { x: 1, y: 0 }, inventory: ['gun'] });
  Object.assign(blue, { x: 25, y: 30 });
  Object.assign(redKing, { x: 10, y: 40 });
  Object.assign(blueKing, { x: 50, y: 50 });
  return { game, redKing, blueKing, red, blue };
}

test('the golden gun fires three shots, then leaves the item queue', () => {
  const { game, red, blue } = match();
  red.inventory.push('speed');
  game.useItem(red.id, 1100);
  assert.equal(blue.respawnAt, 1100 + GUN.respawnMs, 'the enemy is shot');
  assert.deepEqual([red.kills, blue.deaths, red.gunAmmo], [1, 1, 2]);
  assert.deepEqual(red.inventory, ['gun', 'speed'], 'the gun stays at the front while it has shots');
  assert.equal(game.state.shots.length, 1);
  game.useItem(red.id, 1200);
  game.useItem(red.id, 1300);
  assert.deepEqual(red.inventory, ['speed'], 'used up after three shots');
  assert.equal(red.gunAmmo, 0);
  assert.equal(game.state.shots.length, 3);
});

test('a shot king is unharmed and no capture happens', () => {
  const { game, red, blueKing } = match();
  Object.assign(blueKing, { x: 24, y: 30 });
  game.useItem(red.id, 1100);
  assert.equal(blueKing.respawnAt, 0);
  assert.equal(game.state.phase, 'playing');
  assert.equal(game.state.shots[0]?.stoppedBy, 'king');
});

test('shots go the way you last moved', () => {
  const { game, red, blue } = match();
  Object.assign(blue, { x: 20, y: 34 });
  game.input(red.id, 'down');
  game.input(red.id, null);
  game.useItem(red.id, 1100);
  assert.ok(blue.respawnAt > 0);
});

test('a shot player is out of play for three seconds, then respawns in their starting box', () => {
  for (const movement of ['classic', 'ice'] as const) {
    const { game, red, blue } = match(movement);
    game.useItem(red.id, 1100);
    game.input(blue.id, 'left');
    let now = 1100;
    while (now < 1100 + GUN.respawnMs - TUNING.tickMs) game.tick(now += TUNING.tickMs);
    assert.deepEqual({ x: blue.x, y: blue.y }, { x: 25, y: 30 }, `${movement}: a dead player can't move`);
    Object.assign(red, { x: 24, y: 30 });
    game.input(red.id, 'right');
    game.tick(now += TUNING.tickMs);
    assert.ok(red.x > 24, `${movement}: others move through a dead player's spot`);
    game.input(red.id, null);
    while (now < 1100 + GUN.respawnMs + 100) game.tick(now += TUNING.tickMs);
    const size = game.state.settings.size;
    assert.equal(blue.respawnAt, 0);
    assert.ok(blue.x >= size - 7 && blue.y >= size - 5, `${movement}: back in blue's box (${blue.x}, ${blue.y})`);
  }
});

test('dead players cannot use items and are ignored by the timeout proximity count', () => {
  const { game, red, blue, redKing } = match();
  game.useItem(red.id, 1100);
  blue.inventory.push('strength');
  game.useItem(blue.id, 1150);
  assert.equal(blue.strengthUntil, 0);
  assert.deepEqual(blue.inventory, ['strength']);
  Object.assign(blue, { x: redKing.x + 1, y: redKing.y });
  game.state.settings.timeout = 'proximity';
  game.tick(1000 + 60_000);
  assert.equal(game.state.result?.winner, null, 'the dead blue player near the red king does not count');
});

test('the golden gun is rare: never an opening pickup, and at most one on the board', () => {
  const game = new Game(() => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, pickupCount: 40, portalCount: 0 }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) game.join(id, id);
  game.start(1000);
  assert.ok(game.state.pickups.length > 0);
  assert.ok(game.state.pickups.every(pickup => pickup.kind !== 'gun'), 'opening pickups never include the gun');
  const random = Math.random;
  try {
    Math.random = () => 0.01;
    for (let index = 0; index < 5; index++) game['spawnPickup']();
  } finally {
    Math.random = random;
  }
  assert.equal(game.state.pickups.filter(pickup => pickup.kind === 'gun').length, 1);
});
