import assert from 'node:assert/strict';
import { test } from 'node:test';
import { abilityStatus, hasStrength } from './classes.ts';
import { Game } from './game.ts';
import { ABILITY, CLASS_KINDS, DEFAULT_SETTINGS, TUNING } from './rules.ts';
import type { ClassKind } from './rules.ts';
import { startActiveRound } from './test-round.ts';

function match(role: ClassKind) {
  const game = new Game(() => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, seconds: 60, pickupCount: 0, portalCount: 0, movement: 'classic' }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  assert.equal(game.chooseClass('r2', role), undefined);
  startActiveRound(game, 1000);
  game.state.terrain = [];
  game.state.holes = [];
  game.state.movementTerrain = [];
  const [redKing, blueKing, red, blue] = game.state.players;
  assert.ok(redKing && blueKing && red && blue);
  Object.assign(red, { x: 20, y: 30, facing: { x: 1, y: 0 } });
  Object.assign(blue, { x: 24, y: 30 });
  Object.assign(redKing, { x: 10, y: 40 });
  Object.assign(blueKing, { x: 40, y: 40 });
  let now = 1000;
  const run = (ms: number) => { for (const end = now + ms; now < end;) game.tick(now += TUNING.tickMs); };
  return { game, redKing, blueKing, red, blue, run, time: () => now };
}

test('everyone starts as a Hunter; classes are picked in the lobby (or between rounds), not mid-round', () => {
  const { game, red } = match('wizard');
  assert.equal(red.role, 'wizard');
  assert.equal(game.state.players.find(player => player.id === 'b2')?.role, 'hunter');
  assert.match(game.chooseClass(red.id, 'spy') ?? '', /lobby/);
  assert.equal(red.role, 'wizard');
});

test('Hunter: Space sprints like the king, then recharges', () => {
  const { game, red } = match('hunter');
  game.useAbility(red.id, 1000);
  assert.deepEqual([red.pace, red.paceUntil], ['speed', 1000 + TUNING.speedMs]);
  assert.equal(red.abilityReadyAt, 1000 + TUNING.speedMs + TUNING.kingRechargeMs);
  game.useAbility(red.id, 2000);
  assert.equal(red.used, 1, 'no second sprint while recharging');
  assert.equal(abilityStatus(red, 2000).state, 'active');
  assert.equal(abilityStatus(red, 6000).state, 'cooldown');
});

test('Bodyguard: strength is passive, and Space does nothing', () => {
  const { game, red, run } = match('bodyguard');
  assert.ok(hasStrength(red));
  game.useAbility(red.id, 1000);
  assert.equal(red.used, 0);
  assert.equal(abilityStatus(red, 1000).state, 'passive');
  Object.assign(red, { x: 23, y: 30 });
  game.input(red.id, 'right');
  run(100);
  assert.ok(game.state.players.find(player => player.team === 'blue' && !player.king)!.x > 24, 'shoves an enemy hunter');
});

test('Wizard: a freeze bolt freezes the first enemy it reaches (kings too) and has a 1.5 s cooldown', () => {
  const { game, red, blue, blueKing, run } = match('wizard');
  game.useAbility(red.id, 1000);
  assert.equal(blue.frozenUntil, 1000 + ABILITY.freezeMs);
  assert.equal(game.state.shots[0]?.kind, 'freeze');
  assert.equal(red.abilityReadyAt, 1000 + ABILITY.wizardCooldownMs);
  game.input(blue.id, 'left');
  run(ABILITY.freezeMs - 50);
  assert.equal(blue.x, 24, 'frozen units cannot move');
  game.useAbility(blue.id, 1500);
  assert.equal(blue.used, 0, 'or use abilities');
  run(200);
  assert.ok(blue.x < 24, 'moves again after thawing');
  game.input(blue.id, null);

  Object.assign(blueKing, { x: 22, y: 30 });
  game.useAbility(red.id, 1000 + ABILITY.wizardCooldownMs);
  assert.ok(blueKing.frozenUntil > 1000 + ABILITY.wizardCooldownMs, 'kings can be frozen');
});

test('Wizard: a just-thawed unit cannot be frozen again straight away', () => {
  const { game, red, blue } = match('wizard');
  game.useAbility(red.id, 1000);
  const firstThaw = blue.frozenUntil;
  game.useAbility(red.id, 1000 + ABILITY.wizardCooldownMs);
  assert.equal(blue.frozenUntil, firstThaw, 'immune right after thawing');
});

test('Strategist: Space readies a vault, then recharges', () => {
  const { game, red } = match('strategist');
  game.useAbility(red.id, 1000);
  assert.equal(red.vaultUntil, 1000 + TUNING.vaultMs);
  assert.equal(red.abilityReadyAt, 1000 + ABILITY.strategistCooldownMs);
});

test('Spy: Space cloaks for a few seconds; the recharge starts when the cloak ends', () => {
  const { game, red } = match('spy');
  game.useAbility(red.id, 1000);
  assert.equal(red.invisibleUntil, 1000 + ABILITY.spyCloakMs);
  assert.equal(red.abilityReadyAt, red.invisibleUntil + ABILITY.spyCooldownMs);
  assert.equal(abilityStatus(red, 2000).state, 'active');
});

test('kings use the king sprint whatever class they picked', () => {
  const { game, redKing } = match('wizard');
  redKing.role = 'wizard';
  game.useAbility(redKing.id, 1000);
  assert.equal(redKing.pace, 'speed');
  assert.equal(game.state.shots.length, 0, 'no freeze bolt from a king');
});

test('balancing bots are spread across the classes', () => {
  const game = new Game(() => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 4, balanceBots: true, pickupCount: 0, portalCount: 0 }), undefined);
  for (const id of ['r1', 'r2', 'r3', 'r4', 'b1']) assert.equal(game.join(id, id), undefined);
  for (const player of game.state.players) player.team = player.id === 'b1' ? 'blue' : 'red';
  startActiveRound(game, 1000);
  const roles = new Set(game.state.players.filter(player => player.bot).map(player => player.role));
  assert.ok(roles.size >= 3, `bots use several classes (${[...roles]})`);
  assert.ok([...roles].every(role => CLASS_KINDS.includes(role)));
});
