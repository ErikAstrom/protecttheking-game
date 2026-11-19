import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS, readSettings, REPLAY, TUNING } from './rules.ts';
import type { Settings } from './rules.ts';

function setup(overrides: Partial<Settings> = {}) {
  const game = new Game();
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, seconds: 10, pickupCount: 0, ...overrides }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  assert.equal(game.start(1000), undefined);
  const [redKing, blueKing, red, blue] = game.state.players;
  assert.ok(redKing && blueKing && red && blue);
  return { game, redKing, blueKing, red, blue };
}

test('a defender blocks a hunter until the hunter has strength', () => {
  const { game, red, blue } = setup();
  Object.assign(red, { x: 10, y: 10 });
  Object.assign(blue, { x: 11, y: 10, strengthUntil: 9000 });
  game.input(red.id, 'right');
  game.tick(1100);
  assert.deepEqual([red.x, blue.x], [10, 11]);
  red.strengthUntil = 9000;
  game.tick(1200);
  assert.deepEqual([red.x, blue.x], [11, 13]);
});

test('a push stops before an occupied tile and cannot push a teammate', () => {
  const { game, redKing, blueKing, red, blue } = setup();
  Object.assign(red, { x: 10, y: 10, strengthUntil: 9000 });
  Object.assign(blue, { x: 11, y: 10 });
  Object.assign(blueKing, { x: 13, y: 10 });
  game.input(red.id, 'right');
  game.tick(1100);
  assert.deepEqual([red.x, blue.x, blueKing.x], [11, 12, 13]);
  Object.assign(redKing, { x: 11, y: 9 });
  game.input(red.id, 'up');
  game.tick(1200);
  assert.deepEqual([red.y, redKing.y], [10, 9]);
});

test('strength pickups refresh a six-second effect that expires at the deadline', () => {
  const { game, red, blue } = setup();
  Object.assign(red, { x: 10, y: 10 });
  Object.assign(blue, { x: 13, y: 10 });
  game.state.pickups = [{ x: 11, y: 10, kind: 'strength' }, { x: 12, y: 10, kind: 'strength' }];
  game.input(red.id, 'right');
  game.tick(1100);
  assert.equal(red.strengthUntil, 0);
  game.useItem(red.id, 1100);
  assert.equal(red.strengthUntil, 7100);
  game.tick(1200);
  game.useItem(red.id, 1200);
  assert.equal(red.strengthUntil, 7200);
  game.tick(7200);
  assert.equal(blue.x, 13);
});

test('pickups replenish to the configured count and activate in pickup order', () => {
  const { game, red } = setup({ pickupCount: 2 });
  assert.equal(game.state.pickups.length, 2);
  game.state.pickups = [{ x: 11, y: 10, kind: 'speed' }, { x: 12, y: 10, kind: 'strength' }];
  Object.assign(red, { x: 10, y: 10 });
  game.input(red.id, 'right');
  game.tick(1100);
  game.tick(1200);
  game.input(red.id, null);
  assert.deepEqual(red.inventory, ['speed', 'strength']);
  assert.equal(game.state.pickups.length, 0);
  assert.equal(red.pace, null);
  game.useItem(red.id, 1200);
  assert.deepEqual(red.inventory, ['strength']);
  assert.equal(red.pace, 'speed');
  assert.equal(red.strengthUntil, 0);
  game.useItem(red.id, 1201);
  assert.equal(red.strengthUntil, 1201 + TUNING.strengthMs);
  game.tick(1100 + TUNING.respawnMinMs - 1);
  assert.equal(game.state.pickups.length, 0);
  game.tick(1200 + TUNING.respawnMaxMs);
  assert.equal(game.state.pickups.length, 2);
  const [first, second] = game.state.pickups;
  assert.ok(first && second && Math.hypot(first.x - second.x, first.y - second.y) >= TUNING.pickupSpacing);
});

test('placed trap ignores teammates and slows only the first enemy who enters', () => {
  const { game, red, redKing, blue, blueKing } = setup();
  Object.assign(red, { x: 10, y: 10, inventory: ['slow'] });
  Object.assign(redKing, { x: 9, y: 10 });
  Object.assign(blue, { x: 10, y: 11 });
  Object.assign(blueKing, { x: 11, y: 10 });
  game.useItem(red.id, 1050);
  game.input(red.id, 'up');
  game.tick(1100);
  game.input(red.id, null);
  game.input(redKing.id, 'right');
  game.tick(1125);
  assert.equal(redKing.pace, null);
  assert.equal(game.state.traps.length, 1);
  game.input(redKing.id, 'left');
  game.input(blue.id, 'up');
  game.tick(1225);
  assert.equal(blue.pace, 'slow');
  assert.equal(blue.paceUntil, 1225 + TUNING.slowMs);
  assert.equal(game.state.traps.length, 0);
});

test('smooth diagonals use fractional coordinates and the same speed as cardinal movement', () => {
  const { game, red } = setup({ movement: 'smooth' });
  const start = { x: red.x, y: red.y };
  game.input(red.id, 'down-right');
  game.tick(1025);
  assert.ok(red.x > start.x && red.y > start.y);
  assert.ok(!Number.isInteger(red.x));
  assert.ok(Math.abs(Math.hypot(red.x - start.x, red.y - start.y) - 0.25) < 1e-8);
});

test('continuous bodies stop at walls and block, push, and capture without tile equality', () => {
  const { game, red, blue, blueKing } = setup({ movement: 'smooth' });
  Object.assign(red, { x: 10, y: 19.9 });
  game.input(red.id, 'down');
  game.tick(1025);
  game.tick(1050);
  assert.ok(red.y >= 19.9 && red.y < 20.07);
  Object.assign(red, { x: 10.1, y: 10 });
  Object.assign(blue, { x: 11.1, y: 10 });
  game.input(red.id, 'right');
  game.tick(1075);
  assert.ok(red.x < 10.23 && blue.x === 11.1);
  red.inventory.push('strength');
  game.useItem(red.id, 1075);
  game.tick(1100);
  assert.ok(Math.abs(blue.x - 13.1) < 1e-8);
  Object.assign(blueKing, { x: red.x + 0.98, y: 10.01 });
  game.tick(1125);
  assert.deepEqual(game.state.result, { winner: 'red', reason: 'capture' });
});

test('lobby validation rejects invalid pickup counts and movement modes', () => {
  assert.deepEqual(readSettings({ ...DEFAULT_SETTINGS, pickupCount: 0 }), { ...DEFAULT_SETTINGS, pickupCount: 0 });
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, pickupCount: 41 }), null);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, movement: 'unknown' }), null);
});

test('king contact scores before pushback and the next round rotates the kings', () => {
  const { game, redKing, blueKing, red, blue } = setup();
  Object.assign(red, { x: 10, y: 10, strengthUntil: 9000 });
  Object.assign(blueKing, { x: 11, y: 10 });
  game.input(red.id, 'right');
  game.tick(1100);
  assert.equal(blueKing.x, 11);
  assert.deepEqual(game.state.result, { winner: 'red', reason: 'capture' });
  assert.deepEqual(game.state.score, { red: 1, blue: 0 });
  assert.equal(game.next(1200), undefined);
  assert.equal(game.state.round, 2);
  assert.equal(game.state.replay, null);
  assert.deepEqual([redKing.king, blueKing.king, red.king, blue.king], [false, false, true, true]);
});

test('capture includes a bounded, ordered history and identifies the hunter even when the king moves into them', () => {
  const { game, blueKing, red } = setup({ wins: 1 });
  Object.assign(red, { x: 11, y: 10 });
  Object.assign(blueKing, { x: 8, y: 10 });
  game.state.pickups = [{ x: 9, y: 10, kind: 'speed' }];
  for (let now = 1025; now <= 5000; now += 25) game.tick(now);
  game.input(blueKing.id, 'right');
  for (let now = 5025; now <= 5225; now += 25) game.tick(now);

  const { replay } = game.state;
  assert.ok(replay);
  assert.equal(game.state.phase, 'finished');
  assert.equal(game.state.score.red, 1);
  assert.equal(replay.kingId, blueKing.id);
  assert.equal(replay.hunterId, red.id);
  assert.deepEqual(replay.contact, { x: 11, y: 10 });
  const first = replay.frames[0];
  const last = replay.frames.at(-1);
  assert.ok(first && last);
  assert.ok(last.now - first.now <= REPLAY.windowMs);
  assert.ok(last.now - first.now >= REPLAY.windowMs - REPLAY.sampleMs);
  assert.ok(replay.frames.every((frame, index) => !index || frame.now > (replay.frames[index - 1]?.now ?? Infinity)));
  assert.equal(last.now, 5225);
  assert.equal(first.players.find(player => player.id === blueKing.id)?.x, 8);
  assert.equal(last.players.find(player => player.id === blueKing.id)?.x, 10);
  assert.equal(first.pickups.length, 1);
  assert.equal(last.pickups.length, 0);
  game.reset();
  assert.equal(game.state.replay, null);
});

test('timeout awards no points in draw mode; proximity can decide the match', () => {
  for (const timeout of ['draw', 'proximity'] as const) {
    const { game, blueKing, red } = setup({ timeout, wins: 1 });
    Object.assign(red, { x: blueKing.x - 5, y: blueKing.y });
    game.tick(11000);
    const proximity = timeout === 'proximity';
    assert.deepEqual(game.state.result, { winner: proximity ? 'red' : null, reason: 'timeout' });
    assert.equal(game.state.score.red, proximity ? 1 : 0);
    assert.equal(game.state.phase, proximity ? 'finished' : 'between');
    assert.equal(game.state.replay, null);
  }
});
