import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS } from './rules.ts';
import type { Settings } from './rules.ts';

function setup(overrides: Partial<Settings> = {}) {
  const game = new Game();
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, seconds: 10, ...overrides }), undefined);
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
  assert.equal(red.strengthUntil, 7100);
  game.tick(1200);
  assert.equal(red.strengthUntil, 7200);
  game.tick(7200);
  assert.equal(blue.x, 13);
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
  assert.deepEqual([redKing.king, blueKing.king, red.king, blue.king], [false, false, true, true]);
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
  }
});
