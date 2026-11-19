export const TEAMS = ['red', 'blue'] as const;
export type Team = (typeof TEAMS)[number];
export const DIRECTIONS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
  'up-left': { x: -1, y: -1 }, 'up-right': { x: 1, y: -1 },
  'down-left': { x: -1, y: 1 }, 'down-right': { x: 1, y: 1 },
} satisfies Record<string, Point>;
export type Direction = keyof typeof DIRECTIONS;
export type Point = { x: number; y: number };
export type Obstacle = Point & { kind: 'wall' | 'crate' | 'pillar' };
export const ITEMS = {
  strength: { name: 'Strength', color: '#ffc46e' },
  speed: { name: 'Speed', color: '#66ebbf' },
  slow: { name: 'Slow trap', color: '#e3a8ff' },
} as const;
export const ITEM_KINDS = ['strength', 'speed', 'slow'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export type Pickup = Point & { kind: ItemKind };
export type Trap = Point & { team: Team; expires: number };
export type PortalPair = { a: Point; b: Point };
export type Settings = {
  teamSize: number; seconds: number; wins: number; size: number;
  timeout: 'draw' | 'proximity'; movement: 'classic' | 'smooth'; pickupCount: number; portalPairs: number;
};
export const LIMITS = {
  teamSize: { min: 2, max: 8, initial: 4 },
  seconds: { min: 10, max: 600, initial: 90 },
  wins: { min: 1, max: 20, initial: 3 },
  size: { min: 32, max: 256, initial: 64 },
  pickupCount: { min: 0, max: 40, initial: 14 },
  portalPairs: { min: 0, max: 4, initial: 1 },
} as const;
export const DEFAULT_SETTINGS: Settings = {
  teamSize: LIMITS.teamSize.initial, seconds: LIMITS.seconds.initial,
  wins: LIMITS.wins.initial, size: LIMITS.size.initial, timeout: 'draw',
  movement: 'classic', pickupCount: LIMITS.pickupCount.initial, portalPairs: LIMITS.portalPairs.initial,
};
export const TUNING = {
  pushTiles: 2, strengthMs: 6000, speedMs: 4000, slowMs: 3000,
  moveMs: 100, fastMoveMs: 65, slowMoveMs: 200, proximityTiles: 5, tickMs: 25,
  smoothRadius: 0.44, smoothStep: 0.2, smoothPushCooldownMs: 400,
  smoothTurnMs: 70, smoothFastTurnMs: 120,
  pickupRadius: 0.9, pickupSpacing: 2, respawnMinMs: 2500, respawnMaxMs: 6500,
  trapLifetimeMs: 20000,
  kingRechargeMs: 10000, recoilDistance: 1, recoilMs: 180,
};
export const REPLAY = { windowMs: 3000, sampleMs: 75, speed: 0.75, holdMs: 700 };
export type Player = Point & {
  id: string; name: string; team: Team; king: boolean; strengthUntil: number;
  paceUntil: number; pace: 'speed' | 'slow' | null;
  inventory: ItemKind[]; collected: number; used: number; tripped: number;
  sprintReadyAt: number; recoilUntil: number; portalTrips: number;
};
export type Result = { winner: Team | null; reason: 'capture' | 'timeout' };
export type ReplayFrame = {
  now: number; pickups: Pickup[]; traps: Trap[];
  players: Pick<Player, 'id' | 'team' | 'king' | 'x' | 'y' | 'strengthUntil' | 'paceUntil' | 'pace' |
    'recoilUntil' | 'portalTrips'>[];
};
export type CaptureReplay = {
  hunterId: string; kingId: string; contact: Point; frames: ReplayFrame[];
};
export type State = {
  host: string | null; phase: 'lobby' | 'playing' | 'between' | 'finished';
  settings: Settings; score: Record<Team, number>; round: number;
  deadline: number; now: number; players: Player[]; obstacles: Obstacle[]; pickups: Pickup[]; traps: Trap[];
  portals: PortalPair[]; result: Result | null; replay: CaptureReplay | null; notice: string | null;
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
  | { type: 'start' | 'next' | 'reset' | 'use-item' };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readSettings(value: unknown): Settings | null {
  if (!isRecord(value) || (value.timeout !== 'draw' && value.timeout !== 'proximity')) return null;
  const { teamSize, seconds, wins, size, timeout, movement, pickupCount, portalPairs } = value;
  function valid(key: keyof typeof LIMITS, n: unknown): n is number {
    const { min, max } = LIMITS[key];
    return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  }
  return valid('teamSize', teamSize) && valid('seconds', seconds) &&
    valid('wins', wins) && valid('size', size) && valid('pickupCount', pickupCount) && valid('portalPairs', portalPairs) &&
    (movement === 'classic' || movement === 'smooth')
    ? { teamSize, seconds, wins, size, timeout, movement, pickupCount, portalPairs } : null;
}
