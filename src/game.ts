import { DEFAULT_SETTINGS, DIRECTIONS, TEAMS, TUNING } from './rules.ts';
import type { Direction, Pickup, Player, Point, Result, Settings, State, Team } from './rules.ts';

const sameTile = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
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
    round: 0, deadline: 0, now: 0, players: [], walls: [], pickups: [], result: null, notice: null,
  };
  private readonly inputs = new Map<string, Direction>();
  private readonly nextMove = new Map<string, number>();
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
      strengthUntil: 0, paceUntil: 0, pace: null,
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
      walls: [], pickups: [], result: null, notice,
    });
    this.inputs.clear();
    this.nextMove.clear();
    for (const player of this.state.players) {
      Object.assign(player, { king: false, strengthUntil: 0, paceUntil: 0, pace: null });
    }
  }

  input(id: string, direction: Direction | null): void {
    if (direction === null) this.inputs.delete(id);
    else if (this.state.phase === 'playing') this.inputs.set(id, direction);
  }

  tick(now: number): void {
    const { phase, deadline, players } = this.state;
    if (phase !== 'playing') return;
    this.state.now = now;
    if (now >= deadline) {
      this.end({ winner: this.timeoutWinner(), reason: 'timeout' });
      return;
    }
    const first = TEAMS[this.turn % TEAMS.length] ?? 'red';
    const ordered = [first, opposite(first)].flatMap(team => players.filter(player => player.team === team));
    let attemptedMove = false;
    for (const player of ordered) {
      const direction = this.inputs.get(player.id);
      if (!direction || (this.nextMove.get(player.id) ?? 0) > now) continue;
      attemptedMove = true;
      this.move(player, DIRECTIONS[direction], now);
      if (this.state.phase !== 'playing') return;
      const interval = player.paceUntil <= now ? TUNING.moveMs
        : player.pace === 'speed' ? TUNING.fastMoveMs : TUNING.slowMoveMs;
      this.nextMove.set(player.id, now + interval);
    }
    if (attemptedMove) this.turn++;
  }

  private startRound(now: number): void {
    const state = this.state;
    const { size, seconds } = state.settings;
    state.round++;
    state.phase = 'playing';
    state.result = null;
    state.notice = null;
    state.now = now;
    state.deadline = now + seconds * 1000;
    state.walls = fixedArena(size);
    this.blocked = new Set(state.walls.map(tileKey));
    this.inputs.clear();
    this.nextMove.clear();
    this.turn = (state.round - 1) % TEAMS.length;
    for (const team of TEAMS) {
      const roster = state.players.filter(player => player.team === team);
      roster.forEach((player, index) => {
        const corner = { x: 2 + index % 4, y: 2 + Math.floor(index / 4) };
        Object.assign(player, team === 'red' ? corner : mirror(corner, size), {
          king: index === (state.round - 1) % roster.length, strengthUntil: 0, paceUntil: 0, pace: null,
        });
      });
    }
    state.pickups = [];
    for (const kind of ['strength', 'speed', 'slow'] as const) {
      const spots: Point[] = [];
      const margin = Math.floor(size / 4);
      for (let y = margin; y < size - margin; y++) {
        for (let x = margin; x < Math.floor(size / 2); x++) {
          const point = { x, y };
          if (![point, mirror(point, size)].some(tile =>
            this.isBlocked(tile) || state.pickups.some(pickup => sameTile(pickup, tile)))) spots.push(point);
        }
      }
      const spot = spots[Math.floor(Math.random() * spots.length)];
      if (spot) state.pickups.push({ ...spot, kind }, { ...mirror(spot, size), kind });
    }
  }

  private isBlocked(tile: Point): boolean {
    const { size } = this.state.settings;
    return tile.x < 0 || tile.y < 0 || tile.x >= size || tile.y >= size || this.blocked.has(tileKey(tile));
  }

  private move(player: Player, delta: Point, now: number): void {
    const target = { x: player.x + delta.x, y: player.y + delta.y };
    if (this.isBlocked(target)) return;
    const defender = this.state.players.find(candidate => sameTile(candidate, target));
    if (defender) {
      if (defender.team === player.team) return;
      if (defender.king !== player.king) {
        this.end({ winner: player.king ? defender.team : player.team, reason: 'capture' });
        return;
      }
      if (player.king || player.strengthUntil <= now) return;
      for (let distance = 1; distance <= TUNING.pushTiles; distance++) {
        const pushed = { x: defender.x + delta.x, y: defender.y + delta.y };
        if (this.isBlocked(pushed) || this.state.players.some(candidate => sameTile(candidate, pushed))) break;
        Object.assign(defender, pushed);
        this.collect(defender, now);
      }
      if (sameTile(defender, target)) return;
    }
    Object.assign(player, target);
    this.collect(player, now);
  }

  private collect(player: Player, now: number): void {
    const index = this.state.pickups.findIndex(pickup => sameTile(pickup, player));
    if (index < 0) return;
    const [pickup] = this.state.pickups.splice(index, 1);
    if (!pickup) return;
    if (pickup.kind === 'strength') player.strengthUntil = now + TUNING.strengthMs;
    else {
      player.pace = pickup.kind;
      player.paceUntil = now + (pickup.kind === 'speed' ? TUNING.speedMs : TUNING.slowMs);
    }
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
  }
}
