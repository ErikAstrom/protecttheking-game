import { DEFAULT_SETTINGS, DIRECTIONS, ITEM_KINDS, REPLAY, TEAMS, TUNING } from './rules.ts';
import type { Direction, ItemKind, Player, Point, ReplayFrame, Result, Settings, State, Team } from './rules.ts';

const sameTile = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const offset = (a: Point, b: Point, scale = 1): Point => ({ x: a.x + b.x * scale, y: a.y + b.y * scale });
const tileKey = ({ x, y }: Point) => `${x},${y}`;
const opposite = (team: Team): Team => team === 'red' ? 'blue' : 'red';
const mirror = ({ x, y }: Point, size: number) => ({ x: size - 1 - x, y: size - 1 - y });

function fixedArena(size: number): Point[] {
  const walls: Point[] = [];
  for (let x = Math.floor(size / 8); x < Math.floor(size / 2) - 2; x++) {
    const tile = { x, y: Math.floor(size / 3) };
    walls.push(tile, mirror(tile, size));
  }
  for (let y = Math.floor(size / 9); y < Math.floor(size / 3); y++) {
    const tile = { x: Math.floor(size / 2), y };
    walls.push(tile, mirror(tile, size));
  }
  return walls;
}

export class Game {
  readonly state: State = {
    host: null, phase: 'lobby', settings: { ...DEFAULT_SETTINGS }, score: { red: 0, blue: 0 },
    round: 0, deadline: 0, now: 0, players: [], walls: [], pickups: [], traps: [], result: null, replay: null, notice: null,
  };
  private readonly inputs = new Map<string, Direction>();
  private readonly nextMove = new Map<string, number>();
  private readonly nextPush = new Map<string, number>();
  private readonly respawns: number[] = [];
  private readonly replayFrames: ReplayFrame[] = [];
  private blocked = new Set<string>();
  private turn = 0;

  join(id: string, name: string): string | undefined {
    const { phase, players, settings } = this.state;
    if (phase !== 'lobby') return 'Wait for the current match to finish.';
    if (players.some(player => player.id === id)) return 'You already joined.';
    const red = players.filter(player => player.team === 'red').length;
    const blue = players.length - red;
    if (red === settings.teamSize && blue === settings.teamSize) return 'Both teams are full.';
    players.push({
      id, name, team: red <= blue ? 'red' : 'blue', x: 0, y: 0, king: false,
      strengthUntil: 0, paceUntil: 0, pace: null, inventory: [], collected: 0, used: 0, tripped: 0,
    });
    this.state.host ??= id;
  }

  leave(id: string): void {
    const index = this.state.players.findIndex(player => player.id === id);
    if (index < 0) return;
    const [player] = this.state.players.splice(index, 1);
    this.inputs.delete(id);
    this.nextMove.delete(id);
    if (this.state.host === id) this.state.host = this.state.players[0]?.id ?? null;
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
    if (TEAMS.some(team => this.state.players.filter(player => player.team === team).length !== this.state.settings.teamSize)) {
      return `Both teams need ${this.state.settings.teamSize} players.`;
    }
    this.startRound(now);
  }

  next(now: number): string | undefined {
    if (this.state.phase !== 'between') return 'There is no next round right now.';
    this.startRound(now);
  }

  reset(notice: string | null = null): void {
    Object.assign(this.state, {
      phase: 'lobby', score: { red: 0, blue: 0 }, round: 0, deadline: 0,
      walls: [], pickups: [], traps: [], result: null, replay: null, notice,
    });
    this.inputs.clear();
    this.nextMove.clear();
    this.nextPush.clear();
    this.respawns.length = 0;
    this.replayFrames.length = 0;
    for (const player of this.state.players) {
      this.clearEffects(player);
      player.king = false;
    }
  }

  input(id: string, direction: Direction | null): void {
    if (direction === null || (this.state.settings.movement === 'classic' && direction.includes('-'))) this.inputs.delete(id);
    else if (this.state.phase === 'playing') this.inputs.set(id, direction);
  }

  useItem(id: string, now: number): void {
    if (this.state.phase !== 'playing' || now >= this.state.deadline) return;
    const player = this.state.players.find(candidate => candidate.id === id);
    const kind = player?.inventory.shift();
    if (!player || !kind) return;
    player.used++;
    if (kind === 'strength') player.strengthUntil = now + TUNING.strengthMs;
    else if (kind === 'speed') {
      player.pace = 'speed';
      player.paceUntil = now + TUNING.speedMs;
    } else {
      const trap = { x: player.x, y: player.y, team: player.team, expires: now + TUNING.trapLifetimeMs };
      this.state.traps.push(trap);
      const enemy = this.state.players.find(candidate => candidate.team !== trap.team && this.touches(candidate, trap));
      if (enemy) this.checkTrap(enemy, now);
    }
  }

  tick(now: number): void {
    const { phase, deadline, players, settings } = this.state;
    if (phase !== 'playing') return;
    const elapsed = Math.min(now - this.state.now, TUNING.tickMs * 2);
    this.state.now = now;
    if (now >= deadline) {
      this.end({ winner: this.timeoutWinner(), reason: 'timeout' });
      return;
    }
    this.state.traps = this.state.traps.filter(trap => trap.expires > now);
    for (let index = this.respawns.length - 1; index >= 0; index--) {
      if ((this.respawns[index] ?? Infinity) <= now && this.spawnPickup()) this.respawns.splice(index, 1);
    }
    const first = TEAMS[this.turn % TEAMS.length] ?? 'red';
    const ordered = [first, opposite(first)].flatMap(team => players.filter(player => player.team === team));
    let attemptedMove = false;
    for (const player of ordered) {
      const direction = this.inputs.get(player.id);
      if (!direction || (this.nextMove.get(player.id) ?? 0) > now) continue;
      attemptedMove = true;
      const delta = DIRECTIONS[direction];
      const interval = this.moveInterval(player, now);
      if (settings.movement === 'smooth') {
        const length = elapsed / (interval * Math.hypot(delta.x, delta.y));
        this.moveSmooth(player, offset({ x: 0, y: 0 }, delta, length), now);
      } else {
        this.move(player, delta, now, false);
        this.nextMove.set(player.id, now + this.moveInterval(player, now));
      }
      if (this.state.phase !== 'playing') return;
    }
    if (attemptedMove) this.turn++;
    this.recordReplayFrame(now);
  }

  private recordReplayFrame(now: number, final = false): void {
    const last = this.replayFrames.at(-1);
    if (!final && last && now - last.now < REPLAY.sampleMs) return;
    if (last?.now === now) this.replayFrames.pop();
    const { players, pickups, traps } = this.state;
    this.replayFrames.push({
      now, pickups: pickups.slice(), traps: traps.slice(),
      players: players.map(({ id, team, king, x, y, strengthUntil, paceUntil, pace }) =>
        ({ id, team, king, x, y, strengthUntil, paceUntil, pace })),
    });
    while ((this.replayFrames[0]?.now ?? now) < now - REPLAY.windowMs) this.replayFrames.shift();
  }

  private moveInterval(player: Player, now: number): number {
    return player.paceUntil <= now ? TUNING.moveMs
      : player.pace === 'speed' ? TUNING.fastMoveMs : TUNING.slowMoveMs;
  }

  private clearEffects(player: Player): void {
    Object.assign(player, { strengthUntil: 0, paceUntil: 0, pace: null, inventory: [], collected: 0, used: 0, tripped: 0 });
  }

  private startRound(now: number): void {
    const state = this.state;
    const { size, seconds } = state.settings;
    state.round++;
    state.phase = 'playing';
    state.result = null;
    state.replay = null;
    state.notice = null;
    state.now = now;
    state.deadline = now + seconds * 1000;
    state.walls = fixedArena(size);
    this.blocked = new Set(state.walls.map(tileKey));
    this.inputs.clear();
    this.nextMove.clear();
    this.nextPush.clear();
    this.respawns.length = 0;
    this.replayFrames.length = 0;
    this.turn = (state.round - 1) % TEAMS.length;
    for (const team of TEAMS) {
      const roster = state.players.filter(player => player.team === team);
      roster.forEach((player, index) => {
        const corner = { x: 2 + index % 4, y: 2 + Math.floor(index / 4) };
        this.clearEffects(player);
        Object.assign(player, team === 'red' ? corner : mirror(corner, size), {
          king: index === (state.round - 1) % roster.length,
        });
      });
    }
    state.pickups = [];
    state.traps = [];
    const pairs = Math.floor(state.settings.pickupCount / 2);
    for (let index = 0; index < pairs; index++) {
      if (!this.spawnPickup(ITEM_KINDS[index % ITEM_KINDS.length], true)) {
        this.scheduleRespawn(now);
        this.scheduleRespawn(now);
      }
    }
    if (state.settings.pickupCount % 2 && !this.spawnPickup(ITEM_KINDS[pairs % ITEM_KINDS.length])) {
      this.scheduleRespawn(now);
    }
    this.recordReplayFrame(now);
  }

  private spawnPickup(kind?: ItemKind, paired = false): boolean {
    const { settings, pickups, players } = this.state;
    const width = settings.size - 4;
    const valid = (point: Point) => !this.isBlocked(point, settings.movement === 'smooth') &&
      [...pickups, ...players].every(other => distance(other, point) >= TUNING.pickupSpacing);
    const coordinate = () => {
      const random = Math.random() * width;
      return 2 + (settings.movement === 'smooth' ? random : Math.floor(random));
    };
    const place = (point: Point) => {
      if (!valid(point)) return false;
      const partner = mirror(point, settings.size);
      if (paired && (!valid(partner) || distance(point, partner) < TUNING.pickupSpacing)) return false;
      const randomKind = ITEM_KINDS[Math.floor(Math.random() * ITEM_KINDS.length)] ?? 'strength';
      const item = kind ?? randomKind;
      pickups.push({ ...point, kind: item });
      if (paired) pickups.push({ ...partner, kind: item });
      return true;
    };
    for (let attempt = 0; attempt < 64; attempt++) {
      if (place({ x: coordinate(), y: coordinate() })) return true;
    }
    for (let y = 2; y < width + 2; y++) {
      for (let x = 2; x < width + 2; x++) if (place({ x, y })) return true;
    }
    return false;
  }

  private scheduleRespawn(now: number): void {
    this.respawns.push(now + TUNING.respawnMinMs + Math.random() * (TUNING.respawnMaxMs - TUNING.respawnMinMs));
  }

  private isBlocked(tile: Point, smooth = false): boolean {
    const { size } = this.state.settings;
    if (!smooth) return tile.x < 0 || tile.y < 0 || tile.x >= size || tile.y >= size || this.blocked.has(tileKey(tile));
    const radius = TUNING.smoothRadius;
    if (tile.x - radius < -0.5 || tile.y - radius < -0.5 ||
      tile.x + radius > size - 0.5 || tile.y + radius > size - 0.5) return true;
    for (let y = Math.round(tile.y - radius); y <= Math.round(tile.y + radius); y++) {
      for (let x = Math.round(tile.x - radius); x <= Math.round(tile.x + radius); x++) {
        if (this.blocked.has(tileKey({ x, y })) &&
          Math.hypot(Math.max(0, Math.abs(tile.x - x) - 0.5), Math.max(0, Math.abs(tile.y - y) - 0.5)) < radius) return true;
      }
    }
    return false;
  }

  private moveSmooth(player: Player, delta: Point, now: number): void {
    const steps = Math.ceil(Math.hypot(delta.x, delta.y) / TUNING.smoothStep);
    if (!steps) return;
    const step = offset({ x: 0, y: 0 }, delta, 1 / steps);
    for (let index = 0; index < steps && this.state.phase === 'playing'; index++) {
      if (step.x && step.y && this.isBlocked(offset(player, step), true)) {
        if (!this.move(player, { x: step.x, y: 0 }, now, true) && this.state.phase === 'playing') {
          this.move(player, { x: 0, y: step.y }, now, true);
        }
      } else if (!this.move(player, step, now, true)) break;
    }
  }

  private occupants(target: Point, player: Player, smooth: boolean): Player[] {
    return this.state.players.filter(candidate => candidate !== player &&
      (smooth ? distance(candidate, target) <= 2 * TUNING.smoothRadius : sameTile(candidate, target)));
  }

  private move(player: Player, delta: Point, now: number, smooth: boolean): boolean {
    const target = offset(player, delta);
    if (this.isBlocked(target, smooth)) return false;
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
        (smooth && (this.nextPush.get(player.id) ?? 0) > now)) return false;
      const steps = smooth ? Math.ceil(TUNING.pushTiles / TUNING.smoothStep) : TUNING.pushTiles;
      const step = smooth ? offset({ x: 0, y: 0 }, delta, TUNING.pushTiles / (steps * Math.hypot(delta.x, delta.y))) : delta;
      for (let index = 0; index < steps; index++) {
        const pushed = offset(defender, step);
        if (this.isBlocked(pushed, smooth) || this.occupants(pushed, defender, smooth).length) break;
        Object.assign(defender, pushed);
        this.enter(defender, now);
        if (smooth) this.nextPush.set(player.id, now + TUNING.smoothPushCooldownMs);
      }
      if (this.occupants(target, player, smooth).length) return false;
    }
    Object.assign(player, target);
    this.enter(player, now);
    return true;
  }

  private touches(a: Point, b: Point): boolean {
    return this.state.settings.movement === 'smooth' ? distance(a, b) <= TUNING.pickupRadius : sameTile(a, b);
  }

  private enter(player: Player, now: number): void {
    const index = this.state.pickups.findIndex(pickup => this.touches(player, pickup));
    if (index >= 0) {
      const [pickup] = this.state.pickups.splice(index, 1);
      if (pickup) {
        player.inventory.push(pickup.kind);
        player.collected++;
        this.scheduleRespawn(now);
      }
    }
    this.checkTrap(player, now);
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
      const king = this.state.players.find(player => player.king && player.team !== team);
      return king ? this.state.players.filter(player => player.team === team && !player.king &&
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
    this.replayFrames.length = 0;
  }
}
