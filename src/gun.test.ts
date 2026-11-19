import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { startActiveRound } from './test-round.ts';
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
  startActiveRound(game, 1000);
  game.state.terrain = [];
  game.state.holes = [];
  game.state.movementTerrain = [];
  const [redKing, blueKing, red, blue] = game.state.players;
  assert.ok(redKing && blueKing && red && blue);
  Object.assign(red, { x: 20, y: 30, facing: { x: 1, y: 0 } });
  Object.assign(blue, { x: 25, y: 30 });
  Object.assign(redKing, { x: 10, y: 40 });
  Object.assign(blueKing, { x: 40, y: 40 });
  let now = 1000;
  const run = (ms: number) => { for (const end = now + ms; now < end;) game.tick(now += TUNING.tickMs); };
  const arm = () => { red.gunUntil = now + GUN.activeMs; red.nextShotAt = now; };
  return { game, redKing, blueKing, red, blue, run, arm, time: () => now };
}

test('picking up the golden gun arms it for 10 s; it auto-fires at an enemy in sight, in any direction', () => {
  const { game, red, blue, run } = match();
  Object.assign(blue, { x: 20, y: 25 });
  game.state.pickups = [{ x: 21, y: 30, kind: 'gun' }];
  game.input(red.id, 'right');
  run(100);
  game.input(red.id, null);
  assert.ok(red.gunUntil > 1000 && red.gunUntil <= 1100 + GUN.activeMs, 'armed on touch');
  run(100);
  assert.equal(blue.outCause, 'shot', 'auto-aimed upward although the player moved right');
  assert.equal(red.kills, 1);
  assert.equal(game.state.shots[0]?.kind, 'gun');
});

test('auto-fire waits between shots and stops after 10 s', () => {
  const { game, red, blue, run, arm, time } = match();
  arm();
  run(25);
  assert.equal(red.kills, 1);
  Object.assign(blue, { x: 23, y: 30, respawnAt: 0, outCause: null });
  run(GUN.autoIntervalMs - 100);
  assert.equal(blue.respawnAt, 0, 'no shot before the interval');
  run(150);
  assert.equal(red.kills, 2);
  run(GUN.activeMs - (time() - 1000) + 50);
  Object.assign(blue, { x: 23, y: 30, respawnAt: 0, outCause: null });
  run(GUN.autoIntervalMs + 50);
  assert.equal(blue.respawnAt, 0, 'gun expired');
  assert.equal(game.state.players.find(player => player.id === red.id)?.gunUntil, red.gunUntil);
});

test('auto-fire never targets kings, cloaked spies, or enemies behind walls or out of range', () => {
  const { game, red, blue, blueKing, run, arm } = match();
  Object.assign(blueKing, { x: 22, y: 30 });
  Object.assign(blue, { x: 20, y: 33 });
  blue.invisibleUntil = 99_999;
  arm();
  run(300);
  assert.equal(red.kills, 0);
  assert.equal(blueKing.respawnAt, 0);
  blue.invisibleUntil = 0;
  Object.assign(blue, { x: 20 + GUN.rangeTiles + 2, y: 30 });
  Object.assign(blueKing, { x: 40, y: 40 });
  run(300);
  assert.equal(red.kills, 0, 'out of range');
  Object.assign(blue, { x: 25, y: 30 });
  game['blocked'].add('22,30');
  run(300);
  assert.equal(red.kills, 0, 'wall in the way');
});

test('a shot player is out of play for three seconds, then respawns in their starting box', () => {
  for (const movement of ['classic', 'ice'] as const) {
    const { game, red, blue, run, arm, time } = match(movement);
    arm();
    run(25);
    assert.equal(blue.outCause, 'shot');
    red.gunUntil = 0;
    const shotAt = time();
    game.input(blue.id, 'left');
    run(GUN.respawnMs - 2 * TUNING.tickMs);
    assert.deepEqual({ x: blue.x, y: blue.y }, { x: 25, y: 30 }, `${movement}: a dead player can't move`);
    run(shotAt + GUN.respawnMs + 100 - time());
    const size = game.state.settings.size;
    assert.equal(blue.respawnAt, 0);
    assert.ok(blue.x >= size - 7 && blue.y >= size - 5, `${movement}: back in blue's box (${blue.x}, ${blue.y})`);
  }
});

test('dead players cannot use abilities and are ignored by the timeout proximity count', () => {
  const { game, red, blue, redKing, run, arm } = match();
  arm();
  run(25);
  assert.ok(blue.respawnAt > 0);
  red.gunUntil = 0;
  game.useAbility(blue.id, 1050);
  assert.equal(blue.used, 0);
  Object.assign(blue, { x: redKing.x + 1, y: redKing.y });
  game.state.settings.timeout = 'proximity';
  game.tick(1000 + 60_000);
  assert.equal(game.state.result?.winner, null, 'the dead blue player near the red king does not count');
});

test('the golden gun is rarer: never an opening pickup, and at most one on the board', () => {
  const game = new Game(() => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, pickupCount: 40, portalCount: 0 }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) game.join(id, id);
  startActiveRound(game, 1000);
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
