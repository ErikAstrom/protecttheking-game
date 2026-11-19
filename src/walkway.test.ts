import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS, TUNING } from './rules.ts';
import type { Direction, Movement, World } from './rules.ts';
import { startActiveRound } from './test-round.ts';
import { levelAt, WALKWAY } from './walkway.ts';

function setup(movement: Movement, world: World = 'rooms') {
  const game = new Game();
  assert.equal(game.configure({
    ...DEFAULT_SETTINGS, world, movement, teamSize: 2, tiltChance: 0, pickupCount: 0, portalCount: 0,
  }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  const [, blueKing, red] = game.state.players;
  assert.ok(blueKing && red);
  let now = 1000;
  const move = (direction: Direction, ms: number, done = () => false) => {
    game.input(red.id, direction);
    for (const end = now + ms; now < end && !done();) game.tick(now += TUNING.tickMs);
    game.input(red.id, null);
  };
  return { game, blueKing, red, move };
}

for (const movement of ['classic', 'smooth', 'ice'] as const) {
  test(`walkway stairs climb, ledges drop, and the platform cannot be climbed from the side (${movement})`, () => {
    const { game, red, move } = setup(movement);
    const { walkway } = game.state;
    assert.ok(walkway);
    Object.assign(red, { x: walkway.x - 1, y: walkway.y + 1 });
    move('right', 475);
    assert.equal(levelAt(walkway, red), WALKWAY.stairs + 1);
    move('up', 450, () => levelAt(walkway, red) === 0);
    assert.equal(levelAt(walkway, red), 0);
    assert.equal(red.drop?.from, WALKWAY.stairs + 1);
    assert.equal(red.drop.to, 0);
    move('down', 750);
    assert.equal(levelAt(walkway, red), 0);
    assert.ok(red.y < walkway.y - 0.5);
  });
}

test('a grounded hunter cannot tag a king above the ledge', () => {
  const { game, red, blueKing, move } = setup('smooth');
  const { walkway } = game.state;
  assert.ok(walkway);
  const x = walkway.x + WALKWAY.stairs + 1;
  Object.assign(red, { x, y: walkway.y - 1 });
  Object.assign(blueKing, { x, y: walkway.y });
  move('down', 250);
  assert.equal(game.state.result, null);
  Object.assign(red, { x: x - 2, y: walkway.y });
  move('right', 300);
  assert.deepEqual(game.state.result, { winner: 'red', reason: 'capture' });
});

test('the corridor stairs connect to the upper walkway and let a player drop into a floor lane', () => {
  const { game, red, move } = setup('classic');
  const { walkway } = game.state;
  assert.ok(walkway?.branch);
  const { x, y, width, depth } = walkway.branch;
  Object.assign(red, { x: x + Math.floor(width / 2), y: y + depth });
  move('up', 2500, () => red.y === y - 1);
  assert.equal(red.y, y - 1, 'the branch joins the original walkway without a gap');
  assert.equal(levelAt(walkway, red), WALKWAY.stairs + 1);
  move('down', 750, () => red.y === y + 3);
  assert.equal(red.y, y + 3);
  move('left', 450, () => levelAt(walkway, red) === 0);
  assert.equal(red.x, x - 1);
  assert.equal(red.drop?.from, WALKWAY.stairs + 1);
  assert.equal(red.drop.to, 0);
});

test('other worlds do not have a walkway', () => {
  assert.equal(setup('classic', 'arena').game.state.walkway, undefined);
});
