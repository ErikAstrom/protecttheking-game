import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { startActiveRound } from './test-round.ts';
import { afterSlide, iceVelocity } from './ice.ts';
import { DEFAULT_SETTINGS, ICE, TUNING, readSettings } from './rules.ts';
import type { Direction, Point } from './rules.ts';

const TOP = ICE.topSpeedScale / TUNING.moveMs;
const speed = (v: Point) => Math.hypot(v.x, v.y);
const right = { x: 1, y: 0 };
const up = { x: 0, y: -1 };

function simulate(start: Point, direction: Point | null, ms: number, step = TUNING.tickMs): Point {
  let v = start;
  for (let t = 0; t < ms; t += step) v = iceVelocity(v, direction, TOP, step);
  return v;
}

function iceGame() {
  const game = new Game(() => []);
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, seconds: 30, pickupCount: 0, portalCount: 0 }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  game.state.terrain = [];
  game.state.holes = [];
  const red = game.state.players[2];
  assert.ok(red);
  Object.assign(red, { x: 20, y: 40 });
  let now = 1000;
  const run = (direction: Direction | null, ms: number) => {
    game.input(red.id, direction);
    for (const end = now + ms; now < end;) game.tick(now += TUNING.tickMs);
  };
  return { game, red, run };
}

test('defaults are Penguin world with Ice movement, and settings validate both', () => {
  assert.equal(DEFAULT_SETTINGS.movement, 'ice');
  assert.equal(DEFAULT_SETTINGS.world, 'penguin');
  assert.ok(readSettings({ ...DEFAULT_SETTINGS }));
  assert.ok(readSettings({ ...DEFAULT_SETTINGS, movement: 'smooth', world: 'arena' }));
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, world: 'moon' }), null);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, world: undefined }), null);
});

test('running builds momentum instead of starting at full speed', () => {
  const early = simulate({ x: 0, y: 0 }, right, 100);
  assert.ok(speed(early) > 0 && speed(early) < TOP * 0.4, `after 100ms speed is still low (${speed(early)})`);
  const later = simulate({ x: 0, y: 0 }, right, ICE.accelMs + 50);
  assert.ok(Math.abs(speed(later) - TOP) < 1e-9, 'reaches top speed after the acceleration time');
});

test('turning drifts: old momentum keeps carrying you sideways for a while', () => {
  const v = simulate({ x: TOP, y: 0 }, up, 150);
  assert.ok(v.x > TOP * 0.5, `still sliding right after turning up (${v.x})`);
  assert.ok(v.y < 0, 'already gaining speed in the new direction');
  const settled = simulate({ x: TOP, y: 0 }, up, 2000);
  assert.ok(Math.abs(settled.x) < TOP * 0.01, 'sideways drift eventually fades');
});

test('reversing skids through zero before going the other way', () => {
  const v = simulate({ x: TOP, y: 0 }, { x: -1, y: 0 }, 200);
  assert.ok(v.x > 0, `still moving right 200ms after pressing left (${v.x})`);
});

test('releasing keys glides to a gradual stop', () => {
  const v = simulate({ x: TOP, y: 0 }, null, 300);
  assert.ok(v.x > TOP * 0.6, 'keeps most speed shortly after release');
  assert.deepEqual(simulate({ x: TOP, y: 0 }, null, 15000), { x: 0, y: 0 }, 'eventually comes to rest');
});

test('sliding into a wall bounces back a little on the blocked axis only', () => {
  const next = afterSlide({ x: TOP, y: TOP / 2 }, { x: 0, y: (TOP / 2) * 25 }, 25);
  assert.equal(next.x, -TOP * ICE.wallBounce);
  assert.equal(next.y, TOP / 2);
});

test('in a match, a penguin keeps sliding after the keys are released', () => {
  const { red, run } = iceGame();
  run('right', 800);
  const released = red.x;
  assert.ok(released > 24, `covered ground while running (${released})`);
  run(null, 400);
  assert.ok(red.x > released + 2, `glided on after release (${released} -> ${red.x})`);
  assert.equal(red.y, 40);
});

test('in a match, turning mid-run carries the penguin onward before it heads the new way', () => {
  const { red, run } = iceGame();
  run('right', 800);
  const turnX = red.x;
  run('up', 300);
  assert.ok(red.x > turnX + 1, `drifted right after turning (${turnX} -> ${red.x})`);
  assert.ok(red.y < 40, 'and started moving up');
});

test('quicksand drags a sliding penguin down gradually instead of stopping it dead', () => {
  const { game, red, run } = iceGame();
  run('right', 800);
  game.state.terrain = [{ x: Math.ceil(red.x) + 1, y: 36, width: 20, height: 8, kind: 'sand' }];
  const entering = red.x;
  run('right', 300);
  const firstStretch = red.x - entering;
  run('right', 300);
  const secondStretch = red.x - entering - firstStretch;
  assert.ok(firstStretch > secondStretch, `slows down inside the sand (${firstStretch} then ${secondStretch})`);
  assert.ok(secondStretch > 0, 'but keeps moving');
});
