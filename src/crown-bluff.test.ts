import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS } from './rules.ts';
import { startActiveRound } from './test-round.ts';

function setup() {
  const game = new Game(() => [], () => []);
  assert.equal(game.configure({
    ...DEFAULT_SETTINGS, teamSize: 3, movement: 'classic', tiltChance: 0, pickupCount: 0, portalCount: 0,
  }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2', 'r3', 'b3']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  const player = (id: string) => game.state.players.find(member => member.id === id)!;
  for (const [id, x, y] of [['r1', 10, 10], ['r2', 17, 10], ['r3', 12, 10], ['b2', 12, 11]] as const) {
    Object.assign(player(id), { x, y });
  }
  game.state.terrain = [];
  game.state.movementTerrain = [];
  return { game, player };
}

test('only the king can bluff; failed attempts preserve the charge and the nearest teammate gets it', () => {
  const { game, player } = setup();
  assert.match(game.crownBluff('r3', 1000) ?? '', /king/i);
  player('r3').x = 20;
  assert.match(game.crownBluff('r1', 1000) ?? '', /nearby/i);
  player('r3').x = 12;
  player('r2').x = 13;
  assert.equal(game.crownBluff('r1', 1000), undefined);
  assert.equal(game.snapshot('r2').crownBluff?.decoyId, 'r3');
  assert.equal(player('r3').king, false);
  for (const viewer of ['b1', null, 'unjoined']) {
    const snapshot = game.snapshot(viewer);
    assert.equal(snapshot.crownBluff, undefined);
    assert.deepEqual(snapshot.players.filter(p => p.team === 'red' && p.king).map(p => p.id), ['r1', 'r3']);
  }
  assert.match(game.crownBluff('r1', 1001) ?? '', /already/i);
  game.tick(7000);
  assert.equal(game.snapshot(null).players.filter(p => p.team === 'red' && p.king).length, 1);
  assert.match(game.crownBluff('r1', 7000) ?? '', /already/i);
});

test('tagging the decoy pops the crown without a point; tagging the real king still wins and reveals the decoy', () => {
  const { game, player } = setup();
  assert.equal(game.crownBluff('r1', 1000), undefined);
  game.input('b2', 'up');
  game.tick(1025);
  assert.equal(game.state.phase, 'playing');
  assert.deepEqual(game.state.score, { red: 0, blue: 0 });
  assert.equal(game.snapshot(null).players.find(p => p.id === 'r3')?.king, false);
  assert.equal(game.state.crownPop?.at, 1025);
  assert.equal(player('r3').respawnAt, 0);

  Object.assign(player('b3'), { x: 10, y: 11 });
  game.input('b3', 'up');
  game.tick(1050);
  assert.deepEqual(game.state.result, { winner: 'blue', reason: 'capture' });
  assert.deepEqual(game.state.replay?.decoyIds, ['r3']);
  startActiveRound(game, game.state.now + 4000, 'next');
  assert.equal(game.snapshot('r1').crownBluff, undefined);
  assert.equal(game.state.crownPop, undefined);
});
