import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS, readSettings } from './rules.ts';

function startWith(humans: number, pickupCount = DEFAULT_SETTINGS.pickupCount) {
  const game = new Game(() => [], () => []);
  const settings = { ...DEFAULT_SETTINGS, pickupCount, teamSize: 4, balanceBots: true, portalCount: 0 };
  assert.deepEqual(readSettings(settings), settings);
  assert.equal(game.configure(settings), undefined);
  for (let i = 0; i < humans; i++) assert.equal(game.join(`p${i}`, `Player ${i}`), undefined);
  assert.equal(game.start(1000), undefined);
  return game.state;
}

test('default pickups match the starting roster, including bots and both kings', () => {
  const twoPlayers = startWith(2);
  assert.equal(twoPlayers.pickups.length, 2);

  const withBot = startWith(3);
  assert.equal(withBot.players.filter(player => player.bot).length, 1);
  assert.equal(withBot.pickups.length, 4);
});

test('a fixed count overrides the roster, including zero and odd counts', () => {
  assert.equal(startWith(3, 0).pickups.length, 0);
  assert.equal(startWith(2, 5).pickups.length, 5);
});
