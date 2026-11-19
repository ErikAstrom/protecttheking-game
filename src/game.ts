import { BotPilot } from './bots.ts';
import { boardOutline, onBoard } from './board-shape.ts';
import { castShot } from './gun.ts';
import { generateHoles, inHole } from './holes.ts';
import { afterSlide, iceVelocity } from './ice.ts';
import { COMMON_ITEMS, DEFAULT_SETTINGS, DIRECTIONS, GUN, HOLES, ICE, REPLAY, SPACE, SURFACES, TEAMS, TUNING, isFractional, matchStartError, roundStartsAt, scheduleTilt, surfaceAt, tiltSpeed } from './rules.ts';
import type { Direction, Hole, ItemKind, Obstacle, Player, Point, ReplayFrame, Result, Settings, State, Team, Tilt } from './rules.ts';
import { generateArena, generateTerrain, mirror } from './layout.ts';
import { generateIceSheet } from './icesheet.ts';
import { generateRooms } from './rooms.ts';
import { generateSpaceWalls, gravityStep } from './space.ts';

const sameTile = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const offset = (a: Point, b: Point, scale = 1): Point => ({ x: a.x + b.x * scale, y: a.y + b.y * scale });
const tileKey = ({ x, y }: Point) => `${x},${y}`;
const opposite = (team: Team): Team => team === 'red' ? 'blue' : 'red';
const alive = (player: Player) => !player.respawnAt;
const homeFacing = (team: Team): Point => team === 'red' ? { x: 1, y: 0 } : { x: -1, y: 0 };

function makePlayer(id: string, name: string, team: Team): Player {
  return {
    id, name, team, x: 0, y: 0, king: false,
    strengthUntil: 0, paceUntil: 0, pace: null, inventory: [], collected: 0, used: 0, tripped: 0,
    sprintReadyAt: 0, recoilUntil: 0, portalTrips: 0, vaultUntil: 0,
    facing: homeFacing(team), gunAmmo: 0, respawnAt: 0, outCause: null, kills: 0, deaths: 0,
  };
}

export class Game {
  readonly state: State = {
    blackHole: null,
    host: null, phase: 'lobby', settings: { ...DEFAULT_SETTINGS }, score: { red: 0, blue: 0 },
    round: 0, deadline: 0, now: 0, players: [], obstacles: [], pickups: [], traps: [], portals: [], terrain: [], shots: [], holes: [], splashes: [],
    result: null, replay: null, notice: null,
  };
  private readonly inputs = new Map<string, Direction>();
  private readonly velocities = new Map<string, Point>();
  private readonly nextMove = new Map<string, number>();
  private readonly nextPush = new Map<string, number>();
  private readonly gravityProgress = new Map<string, number>();
  private nextBlackHoleAt = 0;
  private readonly respawns: number[] = [];
  private readonly replayFrames: ReplayFrame[] = [];
  private readonly bots = new BotPilot();
  private blocked = new Set<string>();
  private outline = boardOutline(DEFAULT_SETTINGS.size, DEFAULT_SETTINGS.world);
  private scheduledTilt: Tilt | undefined;
  private turn = 0;
  private readonly layout: ((size: number) => Obstacle[]) | undefined;
  private readonly holeLayout: (size: number, obstacles: Obstacle[]) => Hole[];

  /** Without a fixed layout, Penguin world gets an open ice sheet and Castle arena the dense walls. */
  constructor(layout?: (size: number) => Obstacle[], holeLayout: (size: number, obstacles: Obstacle[]) => Hole[] = generateHoles) {
    this.layout = layout;
    this.holeLayout = holeLayout;
  }

  join(id: string, name: string): string | undefined {
    const { phase, players, settings } = this.state;
    if (phase !== 'lobby') return 'Wait for the current match to finish.';
    if (players.some(player => player.id === id)) return 'You already joined.';
    const red = players.filter(player => player.team === 'red').length;
    const blue = players.length - red;
    if (red === settings.teamSize && blue === settings.teamSize) return 'Both teams are full.';
    players.push(makePlayer(id, name, red <= blue ? 'red' : 'blue'));
    this.state.host ??= id;
  }

  leave(id: string): void {
    const index = this.state.players.findIndex(player => player.id === id);
    if (index < 0) return;
    const [player] = this.state.players.splice(index, 1);
    this.input(id, null);
    this.nextMove.delete(id);
    if (this.state.host === id) this.state.host = this.state.players.find(candidate => !candidate.bot)?.id ?? null;
    if (this.state.phase !== 'lobby') this.reset(`${player?.name ?? 'A player'} disconnected; back to lobby.`);
    if (!this.state.players.length) this.state.settings = { ...DEFAULT_SETTINGS };
  }

  switchTeam(id: string, team: Team): string | undefined {
    if (this.state.phase !== 'lobby') return 'Teams are locked during a match.';
    const player = this.state.players.find(candidate => candidate.id === id);
    if (!player) return 'Join first.';
    if (player.team === team) return;
    if (this.state.players.filter(candidate => candidate.team === team).length >= this.state.settings.teamSize) {
      return 'That team is full.';
    }
    player.team = team;
  }

  configure(settings: Settings): string | undefined {
    if (this.state.phase !== 'lobby') return 'Settings are locked during a match.';
    if (TEAMS.some(team => this.state.players.filter(player => player.team === team).length > settings.teamSize)) {
      return 'A team already has more players than that.';
    }
    this.state.settings = settings;
  }

  start(now: number): string | undefined {
    if (this.state.phase !== 'lobby') return 'A match already started.';
    const error = matchStartError(this.state.settings, this.state.players);
    if (error) return error;
    if (this.state.settings.balanceBots) {
      const { players } = this.state;
      const red = players.filter(player => player.team === 'red').length;
      const blue = players.length - red;
      for (let i = 1; i <= Math.abs(red - blue); i++) {
        players.push({ ...makePlayer(`bot:${i}`, `Bot ${i}`, red < blue ? 'red' : 'blue'), bot: true });
      }
    }
    this.startRound(now);
  }

  next(now: number): string | undefined {
    if (this.state.phase !== 'between') return 'There is no next round right now.';
    this.startRound(now);
  }

  reset(notice: string | null = null): void {
    delete this.state.tilt;
    delete this.state.outline;
    this.scheduledTilt = undefined;
    Object.assign(this.state, {
      phase: 'lobby', score: { red: 0, blue: 0 }, round: 0, deadline: 0,
      blackHole: null,
      players: this.state.players.filter(player => !player.bot),
      obstacles: [], pickups: [], traps: [], portals: [], terrain: [], shots: [], holes: [], splashes: [], result: null, replay: null, notice,
    });
    this.inputs.clear();
    this.bots.reset();
    this.velocities.clear();
    this.nextMove.clear();
    this.nextPush.clear();
    this.gravityProgress.clear();
    this.respawns.length = 0;
    this.replayFrames.length = 0;
    for (const player of this.state.players) {
      this.clearEffects(player);
      player.king = false;
    }
  }

  input(id: string, direction: Direction | null): void {
    if (direction === null || (this.state.settings.movement === 'classic' && direction.includes('-'))) {
      this.inputs.delete(id);
      if (this.state.settings.movement !== 'ice') this.velocities.delete(id);
    }
    else if (this.state.phase === 'playing') {
      this.inputs.set(id, direction);
      const player = this.state.players.find(candidate => candidate.id === id);
      if (player) player.facing = DIRECTIONS[direction];
    }
  }

  useItem(id: string, now: number): void {
    if (this.state.phase !== 'playing' || now >= this.state.deadline) return;
    const player = this.state.players.find(candidate => candidate.id === id);
    if (!player || !alive(player)) return;
    if (player.king && player.sprintReadyAt > now) return;
    if (!player.king && player.inventory[0] === 'gun') {
      this.fireGun(player, now);
      return;
    }
    const kind = player.king ? 'speed' : player.inventory.shift();
    if (!kind) return;
    player.used++;
    if (kind === 'strength') player.strengthUntil = now + TUNING.strengthMs;
    else if (kind === 'vault') player.vaultUntil = now + TUNING.vaultMs;
    else if (kind === 'speed') {
      player.pace = 'speed';
      player.paceUntil = now + TUNING.speedMs;
      if (player.king) player.sprintReadyAt = player.paceUntil + TUNING.kingRechargeMs;
    } else {
      const trap = { x: player.x, y: player.y, team: player.team, expires: now + TUNING.trapLifetimeMs };
      this.state.traps.push(trap);
      const enemy = this.state.players.find(candidate => alive(candidate) && candidate.team !== trap.team && this.touches(candidate, trap));
      if (enemy) this.checkTrap(enemy, now);
    }
  }

  tick(now: number): void {
    const { phase, deadline, players, settings } = this.state;
    if (phase === 'countdown') {
      this.state.now = now;
      if (now >= roundStartsAt(this.state)) {
        this.state.phase = 'playing';
        this.state.deadline = now + settings.seconds * 1000;
        if (settings.world === 'space') this.scheduleBlackHole(now);
        this.scheduledTilt = scheduleTilt(settings, now);
        this.recordReplayFrame(now);
      }
      return;
    }
    if (phase !== 'playing') return;
    const elapsed = Math.min(now - this.state.now, TUNING.tickMs * 2);
    this.state.now = now;
    if (now >= deadline) {
      this.end({ winner: this.timeoutWinner(), reason: 'timeout' });
      return;
    }
    const tilt = this.scheduledTilt;
    if (tilt && now >= tilt.startedAt && now < tilt.endsAt) this.state.tilt = tilt;
    else if (this.state.tilt) delete this.state.tilt;
    this.state.traps = this.state.traps.filter(trap => trap.expires > now);
    this.state.shots = this.state.shots.filter(shot => now - shot.at < GUN.tracerMs);
    this.state.splashes = this.state.splashes.filter(splash => now - splash.at < HOLES.splashMs);
    for (const player of players) if (player.respawnAt && player.respawnAt <= now) this.respawn(player);
    for (let index = this.respawns.length - 1; index >= 0; index--) {
      if ((this.respawns[index] ?? Infinity) <= now && this.spawnPickup()) this.respawns.splice(index, 1);
    }
    const first = TEAMS[this.turn % TEAMS.length] ?? 'red';
    const ordered = [first, opposite(first)].flatMap(team => players.filter(player => player.team === team));
    let attemptedMove = false;
    for (const player of ordered) {
      if (!alive(player)) continue;
      if (player.bot && player.recoilUntil <= now) {
        const action = this.bots.control(this.state, player, this.velocities.get(player.id));
        this.input(player.id, action.direction);
        if (action.useItem) this.useItem(player.id, now);
      }
      const direction = this.inputs.get(player.id);
      if (settings.movement === 'ice') {
        if (player.recoilUntil > now) continue;
        attemptedMove = this.glide(player, direction ? DIRECTIONS[direction] : null, elapsed, now) || attemptedMove;
        if (this.state.phase !== 'playing') return;
        continue;
      }
      if (!direction || player.recoilUntil > now || (this.nextMove.get(player.id) ?? 0) > now) continue;
      attemptedMove = true;
      const delta = DIRECTIONS[direction];
      const interval = this.moveInterval(player, now, delta);
      if (settings.movement === 'smooth') {
        this.steer(player, delta, interval, elapsed, now);
      } else {
        this.move(player, delta, now, false);
        this.nextMove.set(player.id, now + this.moveInterval(player, now, delta));
      }
      if (this.state.phase !== 'playing') return;
    }
    if (settings.world === 'space') {
      this.updateBlackHole(now);
      if (this.state.blackHole && elapsed > 0) {
        for (const player of ordered) {
          this.pullTowardBlackHole(player, elapsed, now);
          if (this.state.phase !== 'playing') return;
        }
      }
    }
    if (attemptedMove) this.turn++;
    this.recordReplayFrame(now);
  }

  private recordReplayFrame(now: number, final = false): void {
    const last = this.replayFrames.at(-1);
    if (!final && last && now - last.now < REPLAY.sampleMs) return;
    if (last?.now === now) this.replayFrames.pop();
    const { players, pickups, traps, blackHole, tilt } = this.state;
    this.replayFrames.push({
      now, pickups: pickups.slice(), traps: traps.slice(), blackHole,
      ...(tilt ? { tilt } : {}),
      players: players.map(({ id, team, king, x, y, strengthUntil, paceUntil, pace, recoilUntil, portalTrips, respawnAt }) =>
        ({ id, team, king, x, y, strengthUntil, paceUntil, pace, recoilUntil, portalTrips, respawnAt })),
    });
    while ((this.replayFrames[0]?.now ?? now) < now - REPLAY.windowMs) this.replayFrames.shift();
  }

  private moveInterval(player: Player, now: number, direction: Point | null): number {
    const base = player.paceUntil <= now ? TUNING.moveMs
      : player.pace === 'speed' ? TUNING.fastMoveMs : TUNING.slowMoveMs;
    const surface = surfaceAt(this.state.terrain, player);
    return base * (surface ? SURFACES[surface].intervalFactor : 1) / tiltSpeed(this.state.tilt, direction, now);
  }

  private scheduleBlackHole(now: number): void {
    this.nextBlackHoleAt = now + SPACE.minDelayMs + Math.random() * (SPACE.maxDelayMs - SPACE.minDelayMs);
  }

  private updateBlackHole(now: number): void {
    const active = this.state.blackHole;
    if (active) {
      if (now < active.expires) return;
      this.state.blackHole = null;
      this.gravityProgress.clear();
      this.scheduleBlackHole(now);
      return;
    }
    if (now < this.nextBlackHoleAt) return;
    const { size, movement } = this.state.settings;
    const margin = Math.ceil(size * SPACE.spawnInset);
    const coordinate = () => margin + Math.floor(Math.random() * (size - 2 * margin));
    for (let attempt = 0; attempt < SPACE.spawnAttempts; attempt++) {
      const point = { x: coordinate(), y: coordinate() };
      if (this.isBlocked(point, isFractional(movement))) continue;
      this.state.blackHole = { ...point, expires: now + SPACE.durationMs };
      return;
    }
    this.scheduleBlackHole(now);
  }

  private pullTowardBlackHole(player: Player, elapsed: number, now: number): void {
    const hole = this.state.blackHole;
    if (!hole || !alive(player) || player.recoilUntil > now) {
      this.gravityProgress.delete(player.id);
      return;
    }
    const delta = gravityStep(hole, player, elapsed);
    if (!delta.x && !delta.y) {
      this.gravityProgress.delete(player.id);
      return;
    }
    if (isFractional(this.state.settings.movement)) {
      this.moveSmooth(player, delta, now);
      return;
    }
    const progress = (this.gravityProgress.get(player.id) ?? 0) + Math.hypot(delta.x, delta.y);
    this.gravityProgress.set(player.id, progress % 1);
    if (progress >= 1) {
      const step = Math.abs(delta.x) >= Math.abs(delta.y)
        ? { x: Math.sign(delta.x), y: 0 }
        : { x: 0, y: Math.sign(delta.y) };
      this.move(player, step, now, false);
    }
  }

  private clearEffects(player: Player): void {
    Object.assign(player, {
      strengthUntil: 0, paceUntil: 0, pace: null, inventory: [], collected: 0, used: 0, tripped: 0,
      sprintReadyAt: 0, recoilUntil: 0, portalTrips: 0, vaultUntil: 0, gunAmmo: 0, respawnAt: 0, outCause: null, kills: 0, deaths: 0,
      facing: homeFacing(player.team),
    });
  }

  private startRound(now: number): void {
    const state = this.state;
    const { size, seconds, world } = state.settings;
    state.round++;
    state.phase = 'countdown';
    state.result = null;
    state.shots = [];
    state.splashes = [];
    state.replay = null;
    delete state.tilt;
    state.notice = null;
    state.now = now;
    state.deadline = now + TUNING.roundCountdownMs + seconds * 1000;
    const layout = world === 'space' ? generateSpaceWalls : world === 'rooms' ? generateRooms : world === 'penguin' ? generateIceSheet : generateArena;
    this.outline = state.outline = boardOutline(size, world, Math.random(), Math.random());
    state.obstacles = (this.layout ?? layout)(size)
      .filter(obstacle => onBoard(this.outline, obstacle, Math.SQRT1_2));
    state.terrain = world === 'rooms' || world === 'space' ? [] : generateTerrain(size);
    state.blackHole = null;
    this.gravityProgress.clear();
    state.holes = world === 'penguin' ? this.holeLayout(size, state.obstacles)
      .filter(hole => onBoard(this.outline, hole, hole.radius)) : [];
    this.blocked = new Set(state.obstacles.map(tileKey));
    this.inputs.clear();
    this.bots.reset();
    this.velocities.clear();
    this.nextMove.clear();
    this.nextPush.clear();
    this.respawns.length = 0;
    this.replayFrames.length = 0;
    this.turn = (state.round - 1) % TEAMS.length;
    for (const team of TEAMS) {
      const roster = state.players.filter(player => player.team === team);
      const humans = roster.filter(player => !player.bot);
      const king = humans[(state.round - 1) % humans.length];
      roster.forEach((player, index) => {
        const corner = { x: 2 + index % 4, y: 2 + Math.floor(index / 4) };
        this.clearEffects(player);
        Object.assign(player, team === 'red' ? corner : mirror(corner, size), {
          king: player === king,
        });
      });
    }
    state.pickups = [];
    state.traps = [];
    state.portals = [];
    while (state.portals.length < state.settings.portalCount) {
      const mirrored = state.settings.portalCount - state.portals.length >= 2;
      const portal = this.findSpawn(point => {
        if (!this.spawnOpen(point)) return false;
        const other = mirror(point, size);
        return !mirrored || (distance(point, other) >= size / 4 && this.spawnOpen(other));
      });
      if (!portal) {
        state.notice = 'Not all teleporters could fit in this arena.';
        break;
      }
      state.portals.push(portal);
      if (mirrored) state.portals.push(mirror(portal, size));
    }
    const pairs = Math.floor(state.settings.pickupCount / 2);
    for (let index = 0; index < pairs; index++) {
      if (!this.spawnPickup(COMMON_ITEMS[index % COMMON_ITEMS.length], true)) {
        this.scheduleRespawn(roundStartsAt(state));
        this.scheduleRespawn(roundStartsAt(state));
      }
    }
    if (state.settings.pickupCount % 2 && !this.spawnPickup(COMMON_ITEMS[pairs % COMMON_ITEMS.length])) {
      this.scheduleRespawn(roundStartsAt(state));
    }
  }

  private spawnPickup(kind?: ItemKind, paired = false): boolean {
    const { settings, pickups } = this.state;
    const point = this.findSpawn(point => {
      if (!this.spawnOpen(point)) return false;
      const partner = mirror(point, settings.size);
      return !paired || (this.spawnOpen(partner) && distance(point, partner) >= TUNING.pickupSpacing);
    });
    if (!point) return false;
    const gunAllowed = !kind && !pickups.some(pickup => pickup.kind === 'gun');
    const randomKind = gunAllowed && Math.random() < GUN.spawnChance ? 'gun'
      : COMMON_ITEMS[Math.floor(Math.random() * COMMON_ITEMS.length)] ?? 'strength';
    const item = kind ?? randomKind;
    pickups.push({ ...point, kind: item });
    if (paired) pickups.push({ ...mirror(point, settings.size), kind: item });
    return true;
  }

  private spawnOpen(point: Point): boolean {
    const { settings, pickups, players, portals } = this.state;
    return !this.isBlocked(point, isFractional(settings.movement)) && !inHole(this.state.holes, point, -TUNING.pickupSpacing) &&
      [...pickups, ...players, ...portals]
        .every(other => distance(other, point) >= TUNING.pickupSpacing);
  }

  private findSpawn(valid: (point: Point) => boolean): Point | undefined {
    const { settings } = this.state;
    const width = settings.size - 4;
    const coordinate = () => {
      const random = Math.random() * width;
      return 2 + (isFractional(settings.movement) ? random : Math.floor(random));
    };
    for (let attempt = 0; attempt < 64; attempt++) {
      const point = { x: coordinate(), y: coordinate() };
      if (valid(point)) return point;
    }
    for (let y = 2; y < width + 2; y++) {
      for (let x = 2; x < width + 2; x++) if (valid({ x, y })) return { x, y };
    }
  }

  private scheduleRespawn(now: number): void {
    this.respawns.push(now + TUNING.respawnMinMs + Math.random() * (TUNING.respawnMaxMs - TUNING.respawnMinMs));
  }

  private isBlocked(tile: Point, smooth = false): boolean {
    if (!onBoard(this.outline, tile, smooth ? TUNING.smoothRadius : 0)) return true;
    if (!smooth) return this.blocked.has(tileKey(tile));
    const radius = TUNING.smoothRadius;
    for (let y = Math.round(tile.y - radius); y <= Math.round(tile.y + radius); y++) {
      for (let x = Math.round(tile.x - radius); x <= Math.round(tile.x + radius); x++) {
        if (this.blocked.has(tileKey({ x, y })) &&
          Math.hypot(Math.max(0, Math.abs(tile.x - x) - 0.5), Math.max(0, Math.abs(tile.y - y) - 0.5)) < radius) return true;
      }
    }
    return false;
  }

  private steer(player: Player, direction: Point, interval: number, elapsed: number, now: number): void {
    if (elapsed <= 0) return;
    const targetSpeed = 1 / interval;
    const desired = offset({ x: 0, y: 0 }, direction, targetSpeed / Math.hypot(direction.x, direction.y));
    const last = this.velocities.get(player.id);
    let velocity = desired;
    if (last) {
      const highSpeed = Math.max(targetSpeed, Math.hypot(last.x, last.y)) > 1 / TUNING.moveMs + Number.EPSILON;
      const surface = surfaceAt(this.state.terrain, player);
      const turnMs = Math.max(highSpeed ? TUNING.smoothFastTurnMs : TUNING.smoothTurnMs,
        surface ? SURFACES[surface].turnMs : 0);
      const retention = Math.exp(-elapsed / turnMs);
      velocity = {
        x: desired.x + (last.x - desired.x) * retention,
        y: desired.y + (last.y - desired.y) * retention,
      };
    }
    const { x, y, portalTrips, vaultUntil } = player;
    this.moveSmooth(player, offset({ x: 0, y: 0 }, velocity, elapsed), now);
    if (!alive(player) || player.portalTrips !== portalTrips || player.recoilUntil > now ||
        (player.x === x && player.y === y)) {
      this.velocities.delete(player.id);
    } else if (player.vaultUntil !== vaultUntil) {
      this.velocities.set(player.id, velocity);
    } else {
      this.velocities.set(player.id, { x: (player.x - x) / elapsed, y: (player.y - y) / elapsed });
    }
  }

  /** Ice movement: momentum, drift on turns, and gliding after release. Returns true if the penguin moved or had input. */
  private glide(player: Player, direction: Point | null, elapsed: number, now: number): boolean {
    const last = this.velocities.get(player.id) ?? { x: 0, y: 0 };
    if (elapsed <= 0 || (!direction && !last.x && !last.y)) return false;
    const topSpeed = ICE.topSpeedScale / this.moveInterval(player, now, direction);
    const velocity = iceVelocity(last, direction, topSpeed, elapsed);
    const { x, y, portalTrips, vaultUntil } = player;
    this.moveSmooth(player, offset({ x: 0, y: 0 }, velocity, elapsed), now);
    if (!alive(player)) return true;
    if (player.recoilUntil > now) this.velocities.delete(player.id);
    else if (player.portalTrips !== portalTrips || player.vaultUntil !== vaultUntil) this.velocities.set(player.id, velocity);
    else {
      const next = afterSlide(velocity, { x: player.x - x, y: player.y - y }, elapsed);
      if (next.x || next.y) this.velocities.set(player.id, next);
      else this.velocities.delete(player.id);
    }
    return true;
  }

  private moveSmooth(player: Player, delta: Point, now: number): void {
    const steps = Math.ceil(Math.hypot(delta.x, delta.y) / TUNING.smoothStep);
    if (!steps) return;
    const step = offset({ x: 0, y: 0 }, delta, 1 / steps);
    const { portalTrips, vaultUntil } = player;
    for (let index = 0; index < steps && this.state.phase === 'playing' && alive(player); index++) {
      if (step.x && step.y && this.isBlocked(offset(player, step), true)) {
        if (this.tryVault(player, step, now, true)) break;
        if (!this.move(player, { x: step.x, y: 0 }, now, true) && this.state.phase === 'playing' && player.recoilUntil <= now) {
          this.move(player, { x: 0, y: step.y }, now, true);
        }
      } else if (!this.move(player, step, now, true)) break;
      if (player.portalTrips !== portalTrips || player.vaultUntil !== vaultUntil || player.recoilUntil > now) break;
    }
  }

  /** Fires one golden gun shot in the player's facing direction. Its last shot frees the item slot. */
  private fireGun(player: Player, now: number): void {
    player.gunAmmo = (player.gunAmmo || GUN.shots) - 1;
    if (!player.gunAmmo) {
      player.inventory.shift();
      player.used++;
    }
    const targets = this.state.players.filter(candidate => candidate !== player && alive(candidate));
    const shot = castShot(player, player.facing, player.team, targets,
      point => this.isBlocked({ x: Math.round(point.x), y: Math.round(point.y) }),
      GUN.rangeTiles, GUN.stepTiles, GUN.hitRadius);
    this.state.shots.push({
      from: { x: player.x, y: player.y }, to: shot.to, team: player.team, at: now,
      hitId: shot.hit?.id ?? null, stoppedBy: shot.stoppedBy,
    });
    const victim = shot.hit && this.state.players.find(candidate => candidate.id === shot.hit?.id);
    if (!victim) return;
    player.kills++;
    this.takeOut(victim, now, 'shot', GUN.respawnMs);
  }

  /** Takes a player out of play (shot or drowned) until `respawn` brings them back in their starting box. */
  private takeOut(victim: Player, now: number, cause: 'shot' | 'drowned', ms: number): void {
    victim.deaths++;
    victim.respawnAt = now + ms;
    victim.outCause = cause;
    Object.assign(victim, { strengthUntil: 0, paceUntil: 0, pace: null, recoilUntil: 0, vaultUntil: 0 });
    this.velocities.delete(victim.id);
  }

  /** Brings a shot player back in their team's starting box, on the first free tile near the middle of it. */
  private respawn(player: Player): void {
    const { size } = this.state.settings;
    const smooth = isFractional(this.state.settings.movement);
    const spots: Point[] = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) spots.push({ x, y });
    spots.sort((a, b) => distance(a, { x: 3, y: 2 }) - distance(b, { x: 3, y: 2 }));
    const spot = spots
      .map(point => player.team === 'red' ? point : mirror(point, size))
      .find(point => !this.isBlocked(point, smooth) && this.occupants(point, player, smooth).length === 0 &&
        this.state.players.every(other => other === player || !alive(other) || distance(other, point) >= 1));
    Object.assign(player, spot ?? (player.team === 'red' ? { x: 2, y: 2 } : mirror({ x: 2, y: 2 }, size)), {
      respawnAt: 0, outCause: null, facing: homeFacing(player.team),
    });
    this.velocities.delete(player.id);
    this.nextMove.delete(player.id);
  }

  private occupants(target: Point, player: Player, smooth: boolean): Player[] {
    return this.state.players.filter(candidate => candidate !== player && alive(candidate) &&
      (smooth ? distance(candidate, target) <= 2 * TUNING.smoothRadius : sameTile(candidate, target)));
  }

  private move(player: Player, delta: Point, now: number, smooth: boolean): boolean {
    const target = offset(player, delta);
    if (this.isBlocked(target, smooth)) return this.tryVault(player, delta, now, smooth);
    const occupants = this.occupants(target, player, smooth);
    const opponent = occupants.find(candidate => candidate.team !== player.team && candidate.king !== player.king);
    if (opponent) {
      const [king, hunter] = player.king ? [player, opponent] : [opponent, player];
      this.recordReplayFrame(now, true);
      this.state.replay = {
        kingId: king.id, hunterId: hunter.id,
        contact: { x: (target.x + opponent.x) / 2, y: (target.y + opponent.y) / 2 },
        frames: this.replayFrames.slice(),
      };
      this.end({ winner: hunter.team, reason: 'capture' });
      return false;
    }
    const defender = occupants[0];
    if (defender) {
      if (occupants.length > 1 || defender.team === player.team || player.king || player.strengthUntil <= now ||
        (smooth && (this.nextPush.get(player.id) ?? 0) > now)) {
        return (occupants.length === 1 && this.tryVault(player, delta, now, smooth, defender)) ||
          this.recoil(player, delta, now, smooth);
      }
      const steps = smooth ? Math.ceil(TUNING.pushTiles / TUNING.smoothStep) : TUNING.pushTiles;
      const step = smooth ? offset({ x: 0, y: 0 }, delta, TUNING.pushTiles / (steps * Math.hypot(delta.x, delta.y))) : delta;
      for (let index = 0; index < steps; index++) {
        const pushed = offset(defender, step);
        if (this.isBlocked(pushed, smooth) || this.occupants(pushed, defender, smooth).length) break;
        const teleported = this.stepTo(defender, pushed, now, smooth);
        if (smooth) this.nextPush.set(player.id, now + TUNING.smoothPushCooldownMs);
        if (teleported || !alive(defender)) break;
      }
      const remaining = this.occupants(target, player, smooth);
      if (remaining.length) {
        return (remaining.length === 1 && remaining[0] === defender && this.tryVault(player, delta, now, smooth, defender)) ||
          this.recoil(player, delta, now, smooth);
      }
    }
    this.stepTo(player, target, now, smooth);
    return true;
  }

  private tryVault(player: Player, delta: Point, now: number, smooth: boolean, defender?: Player): boolean {
    if (player.vaultUntil <= now) return false;
    const length = Math.hypot(delta.x, delta.y);
    const stride = smooth ? TUNING.vaultScanStep : 1;
    const limit = defender ? TUNING.vaultPlayerTiles : TUNING.vaultWallTiles;
    const step = offset({ x: 0, y: 0 }, delta, stride / length);
    const contact = offset(player, delta);
    for (let index = 1; length + index * stride <= limit; index++) {
      const landing = offset(contact, step, index);
      const occupants = this.occupants(landing, player, smooth);
      if (occupants.some(other => other !== defender)) return false;
      if (this.isBlocked(landing, smooth)) {
        if (defender) return false;
        continue;
      }
      if (occupants.length) continue;
      if (this.state.holes.some(hole => distance(hole, landing) <= hole.radius)) return false;
      player.vaultUntil = 0;
      this.stepTo(player, landing, now, smooth);
      return true;
    }
    return false;
  }

  private recoil(player: Player, delta: Point, now: number, smooth: boolean): false {
    player.recoilUntil = now + TUNING.recoilMs;
    const steps = smooth ? Math.ceil(TUNING.recoilDistance / TUNING.smoothStep) : TUNING.recoilDistance;
    const scale = -TUNING.recoilDistance / (steps * Math.hypot(delta.x, delta.y));
    for (let index = 0; index < steps; index++) {
      const target = offset(player, delta, scale);
      if (this.isBlocked(target, smooth) || this.occupants(target, player, smooth).length) break;
      if (this.stepTo(player, target, now, smooth) || !alive(player)) break;
    }
    return false;
  }

  private stepTo(player: Player, target: Point, now: number, smooth: boolean): boolean {
    const entered = this.state.portals.find(portal => this.touches(target, portal) && !this.touches(player, portal));
    const exits = entered ? this.state.portals.filter(portal =>
      portal !== entered && !this.occupants(portal, player, smooth).length) : [];
    const destination = exits.length ? exits[Math.floor(Math.random() * exits.length)] : undefined;
    Object.assign(player, destination ?? target);
    if (destination) {
      player.portalTrips++;
      this.velocities.delete(player.id);
    }
    this.enter(player, now);
    return destination !== undefined;
  }

  private touches(a: Point, b: Point): boolean {
    return isFractional(this.state.settings.movement) ? distance(a, b) <= TUNING.pickupRadius : sameTile(a, b);
  }

  private enter(player: Player, now: number): void {
    const index = player.king || player.inventory.length ? -1 : this.state.pickups.findIndex(pickup => this.touches(player, pickup));
    if (index >= 0) {
      const [pickup] = this.state.pickups.splice(index, 1);
      if (pickup) {
        player.inventory.push(pickup.kind);
        player.collected++;
        this.scheduleRespawn(now);
      }
    }
    this.checkTrap(player, now);
    if (inHole(this.state.holes, player)) {
      this.state.splashes.push({ x: player.x, y: player.y, at: now });
      this.takeOut(player, now, 'drowned', HOLES.respawnMs);
      if (player.king) this.end({ winner: opposite(player.team), reason: 'king-drowned' });
    }
  }

  private checkTrap(player: Player, now: number): void {
    const index = this.state.traps.findIndex(trap => trap.team !== player.team && trap.expires > now && this.touches(player, trap));
    if (index < 0) return;
    this.state.traps.splice(index, 1);
    player.pace = 'slow';
    player.paceUntil = now + TUNING.slowMs;
    player.tripped++;
  }

  private timeoutWinner(): Team | null {
    if (this.state.settings.timeout === 'draw') return null;
    const count = (team: Team) => {
      const king = this.state.players.find(player => player.king && player.team !== team && alive(player));
      return king ? this.state.players.filter(player => player.team === team && !player.king && alive(player) &&
        Math.hypot(player.x - king.x, player.y - king.y) <= TUNING.proximityTiles).length : 0;
    };
    const red = count('red');
    const blue = count('blue');
    return red === blue ? null : red > blue ? 'red' : 'blue';
  }

  private end(result: Result): void {
    const { winner } = result;
    if (winner) this.state.score[winner]++;
    this.state.result = result;
    this.state.phase = winner && this.state.score[winner] >= this.state.settings.wins ? 'finished' : 'between';
    this.inputs.clear();
    this.velocities.clear();
    this.replayFrames.length = 0;
  }
}
