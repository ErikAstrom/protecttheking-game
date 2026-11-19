import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS } from './rules.ts';

function lobby() {
  const game = new Game(() => [], () => []);
  game.configure({ ...DEFAULT_SETTINGS, balanceBots: true, seconds: 10, movement: 'classic', pickupCount: 0, portalCount: 0 });
  for (const id of ['red', 'blue', 'hunter']) game.join(id, id);
  return game;
}

test('every round locks movement, bots, and sprint until the full round clock starts', () => {
  const game = lobby();
  assert.equal(game.start(1000), undefined);
  for (const [round, start] of [[1, 1000], [2, 14000]] as const) {
    assert.equal(game.state.round, round);
    assert.equal(game.state.phase, 'countdown');
    const king = game.state.players.find(player => player.king)!;
    const positions = () => game.state.players.map(({ x, y }) => [x, y]);
    const spawns = positions();
    game.input(king.id, 'down');
    game.useItem(king.id, start + 100);
    game.tick(start + 2999);
    assert.equal(game.state.phase, 'countdown');
    assert.equal(king.used, 0);
    assert.deepEqual(positions(), spawns);
    game.tick(start + 3000);
    assert.equal(game.state.phase, 'playing');
    assert.equal(game.state.deadline - game.state.now, 10000);
    assert.deepEqual(positions(), spawns);
    game.input(king.id, 'down');
    game.useItem(king.id, start + 3025);
    game.tick(start + 3025);
    assert.equal(king.used, 1);
    assert.equal(king.y, spawns[game.state.players.indexOf(king)]![1]! + 1);
    game.tick(start + 13000);
    assert.deepEqual(game.state.result, { winner: null, reason: 'timeout' });
    if (round === 1) assert.equal(game.next(14000), undefined);
  }
});

test('a disconnect cancels a pending round instead of starting it later', () => {
  const game = lobby();
  game.start(1000);
  game.leave('blue');
  game.tick(4000);
  assert.equal(game.state.phase, 'lobby');
  assert.equal(game.state.round, 0);
  assert.ok(!game.state.players.some(player => player.bot));
});
