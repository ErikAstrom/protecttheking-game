import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from './game.ts';
import { startActiveRound } from './test-round.ts';
import { DEFAULT_SETTINGS, readSettings, TUNING } from './rules.ts';
import type { Movement, State, Settings } from './rules.ts';

function lobby(settings: Partial<Settings> = {}) {
  const game = new Game(() => [], () => []);
  assert.equal(game.configure({
    ...DEFAULT_SETTINGS, movement: 'classic', pickupCount: 0, portalCount: 0, ...settings,
  }), undefined);
  return game;
}

function uneven(game: Game) {
  for (const id of ['r1', 'b1', 'r2', 'b2', 'r3']) assert.equal(game.join(id, id), undefined);
}

function player(game: Game, id: string) {
  const found = game.state.players.find(candidate => candidate.id === id);
  assert.ok(found);
  return found;
}

test('bot balancing fills only the smaller team, rotates human kings, and cleans up on disconnect', () => {
  const game = lobby({ balanceBots: true });
  uneven(game);
  startActiveRound(game, 1000);
  const bot = game.state.players.find(candidate => candidate.bot);
  assert.ok(bot);
  assert.equal(bot.team, 'blue');
  assert.equal(game.state.players.filter(candidate => candidate.team === 'blue').length, 3);
  assert.equal(game.state.players.filter(candidate => candidate.team === 'red').length, 3);
  for (const [round, blueKing] of ['b1', 'b2', 'b1'].entries()) {
    assert.equal(player(game, blueKing).king, true);
    assert.equal(bot.king, false);
    game.tick(game.state.deadline);
    if (round < 2) startActiveRound(game, game.state.now + TUNING.roundCountdownMs + 1, 'next');
  }
  game.leave('r1');
  assert.equal(game.state.phase, 'lobby');
  assert.equal(game.state.host, 'b1');
  assert.ok(game.state.players.every(candidate => !candidate.bot));
  assert.equal(game.state.players.length, 4);
});

test('bot balancing is opt-in and still needs a human king on each team', () => {
  const original = lobby();
  uneven(original);
  assert.match(original.start(1000) ?? '', /Both teams need 4 players/);
  const balanced = lobby({ balanceBots: true });
  balanced.join('r1', 'r1');
  assert.match(balanced.start(1000) ?? '', /human on each team/);
  balanced.join('b1', 'b1');
  assert.equal(balanced.start(1000), undefined);
  assert.equal(balanced.state.players.length, 2);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, balanceBots: true })?.balanceBots, true);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, balanceBots: 'yes' }), null);
});

test('balancing gives each bot a distinct marked alias without changing human names', () => {
  const game = lobby({ balanceBots: true, teamSize: 8 });
  assert.equal(game.join('red', 'Red Captain'), undefined);
  assert.equal(game.join('blue', 'Blue Captain'), undefined);
  for (let i = 1; i < 8; i++) {
    const id = `red-${i}`;
    assert.equal(game.join(id, `Red ${i}`), undefined);
    assert.equal(game.switchTeam(id, 'red'), undefined);
  }
  startActiveRound(game, 1000);
  const bots = game.state.players.filter(member => member.bot);
  assert.equal(bots.length, 7);
  assert.equal(new Set(bots.map(bot => bot.name)).size, 7);
  for (const bot of bots) assert.match(bot.name, /^[A-Za-z][A-Za-z -]+ \[BOT\]$/);
  assert.equal(player(game, 'red').name, 'Red Captain');
  assert.equal(player(game, 'blue').name, 'Blue Captain');
});

function setupBot(movement: Movement) {
  const game = lobby({ balanceBots: true, movement });
  for (const id of ['r1', 'b1', 'r2']) game.join(id, id);
  startActiveRound(game, 1000);
  const bot = game.state.players.find(candidate => candidate.bot);
  assert.ok(bot);
  game.state.terrain = [];
  return { game, bot };
}

for (const movement of ['classic', 'ice'] as const) {
  test(`a bot in ${movement} mode goes around water and captures the opposing king`, () => {
    const { game, bot } = setupBot(movement);
    Object.assign(bot, { x: 8, y: 9 });
    Object.assign(player(game, 'r1'), { x: 20, y: 9 });
    game.state.holes = [{ x: 14, y: 9, radius: 2 }];
    let detour = 0;
    for (let now = 1025; now < 9000 && game.state.phase === 'playing'; now += TUNING.tickMs) {
      game.tick(now);
      detour = Math.max(detour, Math.abs(bot.y - 9));
    }
    assert.deepEqual(game.state.result, { winner: 'blue', reason: 'capture' });
    assert.equal(game.state.replay?.hunterId, bot.id);
    assert.ok(detour > 2);
    assert.equal(bot.deaths, 0);
  });
}

test('a Bodyguard bot diverts to defend its king and shoves the threat with passive strength', () => {
  const { game, bot } = setupBot('classic');
  Object.assign(player(game, 'b1'), { x: 10, y: 10 });
  Object.assign(player(game, 'r2'), { x: 14, y: 10 });
  Object.assign(player(game, 'r1'), { x: 1, y: 1 });
  Object.assign(bot, { x: 10, y: 12, role: 'bodyguard' });
  const threat = player(game, 'r2');
  const threatStart = threat.x;
  for (let now = 1025; now < 1600; now += TUNING.tickMs) game.tick(now);
  assert.ok(bot.x > 10, 'moves to intercept');
  assert.notEqual(threat.x, threatStart, 'the threat got shoved');
});

test('a bot navigates around a wall rather than walking into it', () => {
  const wall: State['obstacles'] = Array.from({ length: 5 }, (_, dy) => ({ x: 14, y: 7 + dy, kind: 'wall' }));
  const game = new Game(() => wall, () => []);
  game.configure({ ...DEFAULT_SETTINGS, balanceBots: true, movement: 'smooth', pickupCount: 0, portalCount: 0 });
  for (const id of ['r1', 'b1', 'r2']) game.join(id, id);
  startActiveRound(game, 1000);
  const bot = game.state.players.find(candidate => candidate.bot);
  assert.ok(bot);
  Object.assign(bot, { x: 8, y: 9 });
  Object.assign(player(game, 'r1'), { x: 20, y: 9 });
  game.state.terrain = [];
  for (let now = 1025; now < 9000 && game.state.phase === 'playing'; now += TUNING.tickMs) game.tick(now);
  assert.equal(game.state.replay?.hunterId, bot.id);
});
