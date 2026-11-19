import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from './game.ts';
import { startActiveRound } from './test-round.ts';
import { generateArena, generateTerrain, mirror } from './layout.ts';
import { DEFAULT_SETTINGS, readSettings, REPLAY, TUNING, GUN, SWORD } from './rules.ts';
import type { Settings } from './rules.ts';

function setup(overrides: Partial<Settings> = {}, game = new Game(() => [{ x: 10, y: 21, kind: 'wall' }])) {
  assert.equal(game.configure({ ...DEFAULT_SETTINGS, teamSize: 2, seconds: 10, pickupCount: 0, portalCount: 0, movement: 'classic', ...overrides }), undefined);
  for (const id of ['r1', 'b1', 'r2', 'b2']) assert.equal(game.join(id, id), undefined);
  startActiveRound(game, 1000);
  game.state.terrain = [];
  game.state.holes = [];
  game.state.movementTerrain = [];
  const [redKing, blueKing, red, blue] = game.state.players;
  assert.ok(redKing && blueKing && red && blue);
  return { game, redKing, blueKing, red, blue };
}

test('terrain patches mirror between teams and leave the spawns and center lanes clear', () => {
  for (const size of [32, 63, 64]) {
    const patches = generateTerrain(size);
    for (const kind of ['ice', 'sand'] as const) {
      assert.equal(patches.filter(patch => patch.kind === kind).length, 4);
    }
    for (const { x, y, width, height, kind } of patches) {
      assert.ok(patches.some(patch => patch.kind === kind && patch.x === size - x - width &&
        patch.y === size - y - height && patch.width === width && patch.height === height));
      const middle = (size - 1) / 2;
      assert.ok(x + width - 0.5 <= middle || x - 0.5 >= middle);
      assert.ok(y + height - 0.5 <= middle || y - 0.5 >= middle);
      assert.ok(x >= 7 || y >= 5);
      assert.ok(x + width <= size - 7 || y + height <= size - 5);
    }
  }
});

test('Classic turns without drift on ice, while quicksand delays the next step', () => {
  for (const kind of ['ice', 'sand'] as const) {
    const { game, red } = setup();
    Object.assign(red, { x: 10, y: 10 });
    game.state.terrain = [{ x: 8, y: 8, width: 8, height: 8, kind }];
    game.input(red.id, 'right');
    game.tick(1025);
    assert.equal(red.x, 11);
    game.input(red.id, 'down');
    game.tick(1100);
    assert.deepEqual([red.x, red.y], [11, kind === 'ice' ? 11 : 10]);
    if (kind === 'sand') {
      game.tick(1200);
      assert.deepEqual([red.x, red.y], [11, 11]);
    }
  }
});

test('Smooth ice increases speed and widens turns; quicksand slows straight travel', () => {
  const results = [undefined, 'ice', 'sand'].map(kind => {
    const { game, red } = setup({ movement: 'smooth' });
    Object.assign(red, { x: 10, y: 10 });
    if (kind === 'ice' || kind === 'sand') game.state.terrain = [{ x: 8, y: 8, width: 8, height: 8, kind }];
    game.input(red.id, 'right');
    game.tick(1025);
    const beforeTurn = red.x;
    game.input(red.id, 'down');
    game.tick(1050);
    return { speed: beforeTurn - 10, drift: (red.x - beforeTurn) / (beforeTurn - 10) };
  });
  const [grass, ice, sand] = results;
  assert.ok(grass && ice && sand);
  assert.ok(ice.speed > grass.speed * 1.3);
  assert.ok(ice.drift > grass.drift * 1.2);
  assert.ok(sand.speed < grass.speed * 0.65);
});

test('denser layouts vary while keeping every open tile reachable and both spawns clear', () => {
  for (const size of [32, 63, 64, 256]) {
    let seed = 19;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    const arena = generateArena(size, random);
    assert.notDeepEqual(arena, generateArena(size, random));
    const key = (x: number, y: number) => y * size + x;
    const blocked = new Map(arena.map(tile => [key(tile.x, tile.y), tile.kind]));
    assert.equal(blocked.size, arena.length);
    const oldWallCount = 2 * (Math.floor(size / 2) - 2 - Math.floor(size / 8) +
      Math.floor(size / 3) - Math.floor(size / 9));
    assert.ok(arena.filter(tile => tile.kind === 'wall').length > oldWallCount);
    assert.ok(arena.some(tile => tile.kind === 'crate') && arena.some(tile => tile.kind === 'pillar'));
    for (const tile of arena) {
      assert.ok(tile.x >= 0 && tile.x < size && tile.y >= 0 && tile.y < size);
      const partner = mirror(tile, size);
      assert.equal(blocked.get(key(partner.x, partner.y)), tile.kind);
    }
    for (let x = 1; x <= 6; x++) {
      for (let y = 1; y <= 4; y++) {
        assert.ok(!blocked.has(key(x, y)));
        const partner = mirror({ x, y }, size);
        assert.ok(!blocked.has(key(partner.x, partner.y)));
      }
    }
    const visited = new Set([0]);
    const queue = [0];
    for (const index of queue) {
      const x = index % size, y = Math.floor(index / size);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const neighbor = key(nx, ny);
        if (blocked.has(neighbor) || visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    assert.equal(visited.size + blocked.size, size * size);
  }
});

test('crates and pillars block players in both movement modes', () => {
  for (const movement of ['classic', 'smooth'] as const) {
    for (const kind of ['crate', 'pillar'] as const) {
      const { game, red } = setup({ movement }, new Game(() => [{ x: 11, y: 10, kind }]));
      Object.assign(red, { x: 10, y: 10 });
      game.input(red.id, 'right');
      game.tick(1050);
      assert.equal(red.x, 10);
    }
  }
});

test('a defender blocks a hunter, but a Bodyguard (passive strength) pushes through', () => {
  const { game, red, blue } = setup();
  Object.assign(red, { x: 10, y: 10 });
  Object.assign(blue, { x: 11, y: 10, role: 'bodyguard' });
  game.input(red.id, 'right');
  game.tick(1100);
  assert.deepEqual([red.x, blue.x], [9, 11]);
  game.tick(1200);
  assert.deepEqual([red.x, blue.x], [9, 11]);
  red.role = 'bodyguard';
  game.tick(1300);
  game.tick(1400);
  assert.deepEqual([red.x, blue.x], [11, 13]);
});

test('a push stops before an occupied tile and cannot push a teammate', () => {
  const { game, redKing, blueKing, red, blue } = setup();
  Object.assign(red, { x: 10, y: 10, role: 'bodyguard' });
  Object.assign(blue, { x: 11, y: 10 });
  Object.assign(blueKing, { x: 13, y: 10 });
  game.input(red.id, 'right');
  game.tick(1100);
  assert.deepEqual([red.x, blue.x, blueKing.x], [11, 12, 13]);
  Object.assign(redKing, { x: 11, y: 9 });
  game.input(red.id, 'up');
  game.tick(1200);
  assert.deepEqual([red.y, redKing.y], [11, 9]);
});

test('touching a pickup activates it at once for 10 s, and collected pickups respawn', () => {
  const { game, red } = setup({ pickupCount: 2 });
  assert.equal(game.state.pickups.length, 2);
  game.state.pickups = [{ x: 11, y: 10, kind: 'sword' }, { x: 12, y: 10, kind: 'gun' }];
  Object.assign(red, { x: 10, y: 10 });
  game.input(red.id, 'right');
  game.tick(1100);
  assert.equal(red.swordUntil, 1100 + SWORD.activeMs);
  game.tick(1200);
  assert.equal(red.gunUntil, 1200 + GUN.activeMs, 'both can be active together');
  assert.equal(red.collected, 2);
  assert.equal(game.state.pickups.length, 0);
  game.input(red.id, null);
  game.tick(1200 + TUNING.respawnMaxMs);
  assert.equal(game.state.pickups.length, 2);
  const [first, second] = game.state.pickups;
  assert.ok(first && second && Math.hypot(first.x - second.x, first.y - second.y) >= TUNING.pickupSpacing);
});

test('smooth diagonals use fractional coordinates and the same speed as cardinal movement', () => {
  const { game, red } = setup({ movement: 'smooth' });
  const start = { x: red.x, y: red.y };
  game.input(red.id, 'down-right');
  game.tick(1025);
  assert.ok(red.x > start.x && red.y > start.y);
  assert.ok(!Number.isInteger(red.x));
  assert.ok(Math.abs(Math.hypot(red.x - start.x, red.y - start.y) - 0.25) < 1e-8);
});

test('smooth turns carry momentum and sprinting increases sideways drift', () => {
  function corner(sprinting: boolean) {
    const { game, red } = setup({ movement: 'smooth' });
    Object.assign(red, { x: 10, y: 10 });
    if (sprinting) game.useAbility(red.id, 1000); // Hunter (the default class) sprints
    game.input(red.id, 'right');
    game.tick(1025);
    const turnX = red.x;
    game.input(red.id, 'down');
    for (let now = 1050; now <= 1125; now += 25) game.tick(now);
    assert.ok(red.y > 10.3, 'the player steers toward the new direction');
    const drift = red.x - turnX;
    const stop = { x: red.x, y: red.y };
    game.input(red.id, null);
    game.tick(1150);
    assert.deepEqual({ x: red.x, y: red.y }, stop, 'releasing movement holds position');
    game.input(red.id, 'down');
    game.tick(1175);
    assert.equal(red.x, stop.x, 'starting again does not restore old momentum');
    return drift;
  }
  const normal = corner(false);
  assert.ok(normal > 0.3);
  assert.ok(corner(true) > normal * 1.5);
});

test('continuous bodies stop at walls and block, push, and capture without tile equality', () => {
  const { game, red, blue, blueKing } = setup({ movement: 'smooth' });
  Object.assign(red, { x: 10, y: 19.9 });
  game.input(red.id, 'down');
  game.tick(1025);
  game.tick(1050);
  assert.ok(red.y >= 19.9 && red.y < 20.07);
  Object.assign(red, { x: 10.1, y: 10 });
  Object.assign(blue, { x: 11.1, y: 10 });
  game.input(red.id, 'right');
  game.tick(1075);
  assert.ok(red.x < 10.1 && blue.x === 11.1);
  red.x = 10.1;
  red.role = 'bodyguard';
  game.tick(1275);
  assert.ok(Math.abs(blue.x - 13.1) < 1e-8);
  Object.assign(blueKing, { x: red.x + 0.98, y: 10.01 });
  game.tick(1300);
  assert.deepEqual(game.state.result, { winner: 'red', reason: 'capture' });
});

test('lobby validation rejects invalid pickup counts and movement modes', () => {
  assert.deepEqual(readSettings({ ...DEFAULT_SETTINGS, pickupCount: 0 }), { ...DEFAULT_SETTINGS, pickupCount: 0 });
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, pickupCount: 41 }), null);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, movement: 'unknown' }), null);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, portalCount: 9 }), null);
  assert.equal(readSettings({ ...DEFAULT_SETTINGS, portalCount: 1 }), null);
});

test('portals work both ways without retriggering on arrival and do not land on another player', () => {
  const { game, red, blue } = setup();
  game.state.portals = [{ x: 10, y: 10 }, { x: 30, y: 10 }];
  Object.assign(red, { x: 9, y: 10 });
  Object.assign(blue, { x: 30, y: 10 });
  game.input(red.id, 'right');
  game.tick(1100);
  assert.deepEqual([red.x, red.portalTrips], [10, 0]);
  Object.assign(blue, { x: 31, y: 11 });
  game.tick(1200);
  assert.deepEqual([red.x, red.portalTrips], [11, 0]);
  game.input(red.id, 'left');
  game.tick(1300);
  assert.deepEqual([red.x, red.portalTrips], [30, 1]);
  game.tick(1400);
  assert.deepEqual([red.x, red.portalTrips], [29, 1]);
  game.input(red.id, 'right');
  game.tick(1500);
  assert.deepEqual([red.x, red.portalTrips], [10, 2]);
});

test('configured portals spawn on open ground, clear of pickups and starting players', () => {
  const { game } = setup({ size: 32, portalCount: 7, pickupCount: 40 }, new Game());
  const { portals, obstacles, pickups, players } = game.state;
  assert.equal(portals.length, 7);
  assert.equal(pickups.length, 40);
  const endpoints = portals;
  for (const [index, endpoint] of endpoints.entries()) {
    assert.ok(!obstacles.some(tile => tile.x === endpoint.x && tile.y === endpoint.y));
    for (const other of [...endpoints.slice(index + 1), ...players, ...pickups]) {
      assert.ok(Math.hypot(other.x - endpoint.x, other.y - endpoint.y) >= TUNING.pickupSpacing);
    }
  }
  assert.ok(pickups.every(pickup => !obstacles.some(tile => tile.x === pickup.x && tile.y === pickup.y)));
});

test('a smooth portal moves the player to the exact exit and uses up that movement tick', () => {
  const { game, redKing } = setup({ movement: 'smooth' });
  game.state.portals = [{ x: 10.1, y: 10 }, { x: 30.2, y: 10.3 }];
  Object.assign(redKing, { x: 9.1, y: 10 });
  game.input(redKing.id, 'right');
  game.tick(1050);
  assert.deepEqual([redKing.x, redKing.y, redKing.portalTrips], [30.2, 10.3, 1]);
  game.tick(1075);
  assert.ok(redKing.x > 30.2);
  assert.equal(redKing.portalTrips, 1);
});

test('kings skip pickups, sprint from the start, and recharge before reuse', () => {
  const { game, redKing } = setup({ seconds: 60 });
  Object.assign(redKing, { x: 9, y: 10 });
  game.state.pickups = [{ x: 10, y: 10, kind: 'sword' }];
  game.input(redKing.id, 'right');
  game.tick(1100);
  assert.equal(redKing.x, 10);
  assert.equal(game.state.pickups.length, 1);
  assert.equal(redKing.swordUntil, 0);
  game.useAbility(redKing.id, 1100);
  assert.equal(redKing.pace, 'speed');
  assert.equal(redKing.paceUntil, 1100 + TUNING.speedMs);
  const ready = redKing.sprintReadyAt;
  assert.equal(ready, redKing.paceUntil + TUNING.kingRechargeMs);
  game.useAbility(redKing.id, ready - 1);
  assert.equal(redKing.used, 1);
  game.useAbility(redKing.id, ready);
  assert.equal(redKing.used, 2);
  assert.equal(redKing.paceUntil, ready + TUNING.speedMs);
});

test('king contact scores before pushback and the next round rotates the kings', () => {
  const { game, redKing, blueKing, red, blue } = setup();
  Object.assign(red, { x: 10, y: 10, role: 'bodyguard' });
  Object.assign(blueKing, { x: 11, y: 10 });
  game.input(red.id, 'right');
  game.tick(1100);
  assert.equal(blueKing.x, 11);
  assert.deepEqual(game.state.result, { winner: 'red', reason: 'capture' });
  assert.deepEqual(game.state.score, { red: 1, blue: 0 });
  startActiveRound(game, 1200, 'next');
  assert.equal(game.state.round, 2);
  assert.equal(game.state.replay, null);
  assert.deepEqual([redKing.king, blueKing.king, red.king, blue.king], [false, false, true, true]);
});

test('capture includes a bounded, ordered history and identifies the hunter even when the king moves into them', () => {
  const { game, blueKing, red } = setup({ wins: 1 });
  Object.assign(red, { x: 11, y: 10 });
  Object.assign(blueKing, { x: 8, y: 10 });
  game.state.pickups = [{ x: 9, y: 10, kind: 'sword' }];
  for (let now = 1025; now <= 5000; now += 25) game.tick(now);
  game.input(blueKing.id, 'right');
  for (let now = 5025; now <= 5225; now += 25) game.tick(now);

  const { replay } = game.state;
  assert.ok(replay);
  assert.equal(game.state.phase, 'finished');
  assert.equal(game.state.score.red, 1);
  assert.equal(replay.kingId, blueKing.id);
  assert.equal(replay.hunterId, red.id);
  assert.deepEqual(replay.contact, { x: 11, y: 10 });
  const first = replay.frames[0];
  const last = replay.frames.at(-1);
  assert.ok(first && last);
  assert.ok(last.now - first.now <= REPLAY.windowMs);
  assert.ok(last.now - first.now >= REPLAY.windowMs - REPLAY.sampleMs);
  assert.ok(replay.frames.every((frame, index) => !index || frame.now > (replay.frames[index - 1]?.now ?? Infinity)));
  assert.equal(last.now, 5225);
  assert.equal(first.players.find(player => player.id === blueKing.id)?.x, 8);
  assert.equal(last.players.find(player => player.id === blueKing.id)?.x, 10);
  assert.equal(first.pickups.length, 1);
  assert.equal(last.pickups.length, 1);
  game.reset();
  assert.equal(game.state.replay, null);
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
    assert.equal(game.state.replay, null);
  }
});
