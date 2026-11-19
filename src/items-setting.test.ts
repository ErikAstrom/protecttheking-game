import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { DEFAULT_SETTINGS, ITEM_KINDS, readSettings } from './rules.ts';
import type { ItemKind } from './rules.ts';
import { startActiveRound } from './test-round.ts';

test('all power-ups are enabled by default', () => {
  assert.deepEqual(DEFAULT_SETTINGS.items, [...ITEM_KINDS]);
});

test('lobby validation accepts any subset (including none) and normalises the order', () => {
  assert.deepEqual(readSettings({ ...DEFAULT_SETTINGS, items: ['sword', 'strength'] })?.items, ['strength', 'sword']);
  assert.deepEqual(readSettings({ ...DEFAULT_SETTINGS, items: [] })?.items, []);
  const { items: _omitted, ...older } = DEFAULT_SETTINGS;
  assert.deepEqual(readSettings(older)?.items, [...ITEM_KINDS], 'older clients without the field get everything');
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, items: ['laser'] }), null);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, items: ['sword', 'sword'] }), null);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, items: 'sword' }), null);
});

function round(items: ItemKind[], pickupCount = 12) {
  const game = new Game(() => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, pickupCount, portalCount: 0, items }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  return game;
}

function respawnMany(game: Game, times: number, random: number) {
  const original = Math.random;
  let call = 0;
  try {
    // Alternate the rolls so both rare and common outcomes get exercised.
    Math.random = () => (call++ % 2 ? original() : random);
    for (let index = 0; index < times; index++) game['spawnPickup']();
  } finally {
    Math.random = original;
  }
}

test('only ticked power-ups appear, at round start and on respawn', () => {
  const game = round(['sword', 'vault']);
  assert.ok(game.state.pickups.length > 0);
  respawnMany(game, 20, 0.001);
  const kinds = new Set(game.state.pickups.map(pickup => pickup.kind));
  assert.deepEqual([...kinds].sort(), ['sword', 'vault']);
});

test('an unticked golden gun never appears, even on a lucky roll', () => {
  const game = round(['strength', 'speed', 'slow', 'vault', 'sword']);
  respawnMany(game, 30, 0.001);
  assert.ok(game.state.pickups.every(pickup => pickup.kind !== 'gun'));
});

test('with nothing ticked there are no pickups at all', () => {
  const game = round([]);
  assert.deepEqual(game.state.pickups, []);
  respawnMany(game, 10, 0.5);
  assert.deepEqual(game.state.pickups, []);
});

test('with only the golden gun ticked, exactly one gun is on the board at a time', () => {
  const game = round(['gun']);
  assert.deepEqual(game.state.pickups.map(pickup => pickup.kind), ['gun']);
  respawnMany(game, 10, 0.9);
  assert.equal(game.state.pickups.length, 1, 'never a second gun');
  game.state.pickups = [];
  respawnMany(game, 1, 0.9);
  assert.deepEqual(game.state.pickups.map(pickup => pickup.kind), ['gun'], 'a collected gun comes back');
});
