import assert from 'node:assert/strict';
import test from 'node:test';
import { boardOutline, onBoard } from './board-shape.ts';
import { Game } from './game.ts';
import { generateTerrain, mirror } from './layout.ts';
import { DEFAULT_SETTINGS, DIRECTIONS, TUNING, surfaceAt } from './rules.ts';
import { startActiveRound } from './test-round.ts';
import type { Direction, Movement, Point, World } from './rules.ts';

function gameFor(world: World, movement: Movement) {
  const game = new Game(() => [], () => []);
  game.configure({ ...DEFAULT_SETTINGS, world, movement, teamSize: 2, seconds: 10, pickupCount: 0, portalCount: 0 });
  for (const id of ['r1', 'b1', 'r2', 'b2']) game.join(id, id);
  startActiveRound(game, 1000);
  game.state.terrain = [];
  return game;
}

for (const world of ['penguin', 'arena'] as const) {
  test(`${world} cuts the unused corners and blocks movement there`, () => {
    const game = gameFor(world, 'classic');
    const { size } = game.state.settings;
    const outline = boardOutline(size, world);
    assert.ok(!onBoard(outline, { x: size - 1, y: 0 }));
    assert.ok(!onBoard(outline, { x: 0, y: size - 1 }));
    assert.ok(game.state.players.every(player => onBoard(outline, player)));
    const mover = game.state.players[0]!;
    let x = size - 1;
    while (!onBoard(outline, { x, y: 0 })) x--;
    Object.assign(mover, { x, y: 0 });
    game.input(mover.id, 'right');
    game.tick(1025);
    assert.equal(mover.x, x);
    game.input(mover.id, 'down');
    game.tick(1125);
    assert.equal(mover.y, 1);
  });
}

test('natural terrain has mirrored outlines and only affects the visible patch', () => {
  const size = 48;
  const [a, b] = generateTerrain(size, () => 0.41);
  assert.ok(a?.outline && b?.outline);
  assert.ok(a.outline.length > 4);
  assert.deepEqual(b.outline, a.outline.map(point => mirror(point, size)));
  assert.equal(surfaceAt([a], a), undefined);
  assert.equal(surfaceAt([a], { x: a.x + a.width / 2, y: a.y + a.height / 2 }), a.kind);
});

for (const movement of ['classic', 'smooth', 'ice'] as const) {
  test(`${movement} favors downhill without adding idle movement`, () => {
    const game = gameFor('penguin', movement);
    const [a, b, still] = game.state.players;
    assert.ok(a && b && still);
    const originA = { x: 15, y: 15 }, originB = { x: 30, y: 30 };
    Object.assign(a, originA);
    Object.assign(b, originB);
    const idleOrigin = { x: still.x, y: still.y };
    game.tick(6200); // Active for any randomized start in a 10-second round.
    const downhill = game.state.tilt?.downhill;
    assert.ok(downhill);
    const direction = ({ x, y }: Point) => (Object.keys(DIRECTIONS) as Direction[])
      .find(key => DIRECTIONS[key].x === x && DIRECTIONS[key].y === y)!;
    game.input(a.id, direction(downhill));
    game.input(b.id, direction({ x: -downhill.x, y: -downhill.y }));
    for (let now = 6225; now <= 6900; now += TUNING.tickMs) game.tick(now);
    assert.ok(Math.hypot(a.x - originA.x, a.y - originA.y) > Math.hypot(b.x - originB.x, b.y - originB.y));
    assert.deepEqual({ x: still.x, y: still.y }, idleOrigin);
    game.tick(10025);
    assert.equal(game.state.tilt, undefined);
  });
}
