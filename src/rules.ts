export const TEAMS = ['red', 'blue'] as const;
export type Team = (typeof TEAMS)[number];
export type Direction = 'up' | 'down' | 'left' | 'right';
export const DIRECTIONS: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
export type Point = { x: number; y: number };
export type Pickup = Point & { kind: 'strength' | 'speed' | 'slow' };
export type Settings = {
  teamSize: number; seconds: number; wins: number; size: number;
  timeout: 'draw' | 'proximity';
};
export const LIMITS = {
  teamSize: { min: 2, max: 8, initial: 4 },
  seconds: { min: 10, max: 600, initial: 90 },
  wins: { min: 1, max: 20, initial: 3 },
  size: { min: 32, max: 256, initial: 64 },
} as const;
export const DEFAULT_SETTINGS: Settings = {
  teamSize: LIMITS.teamSize.initial, seconds: LIMITS.seconds.initial,
  wins: LIMITS.wins.initial, size: LIMITS.size.initial, timeout: 'draw',
};
export const TUNING = {
  pushTiles: 2, strengthMs: 6000, speedMs: 4000, slowMs: 3000,
  moveMs: 100, fastMoveMs: 65, slowMoveMs: 200, proximityTiles: 5, tickMs: 25,
};
export type Player = Point & {
  id: string; name: string; team: Team; king: boolean; strengthUntil: number;
  paceUntil: number; pace: 'speed' | 'slow' | null;
};
export type Result = { winner: Team | null; reason: 'capture' | 'timeout' };
export type State = {
  host: string | null; phase: 'lobby' | 'playing' | 'between' | 'finished';
  settings: Settings; score: Record<Team, number>; round: number;
  deadline: number; now: number; players: Player[]; walls: Point[]; pickups: Pickup[];
  result: Result | null; notice: string | null;
};
export type ServerMessage =
  | { type: 'hello'; id: string }
  | { type: 'state'; state: State }
  | { type: 'error'; message: string };
export type Command =
  | { type: 'join'; name: string }
  | { type: 'team'; team: Team }
  | { type: 'input'; direction: Direction | null }
  | { type: 'settings'; settings: Settings }
  | { type: 'start' | 'next' | 'reset' };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readSettings(value: unknown): Settings | null {
  if (!isRecord(value) || (value.timeout !== 'draw' && value.timeout !== 'proximity')) return null;
  const { teamSize, seconds, wins, size, timeout } = value;
  function valid(key: keyof typeof LIMITS, n: unknown): n is number {
    const { min, max } = LIMITS[key];
    return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  }
  return valid('teamSize', teamSize) && valid('seconds', seconds) &&
    valid('wins', wins) && valid('size', size) ? { teamSize, seconds, wins, size, timeout } : null;
}
