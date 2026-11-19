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
export type TerrainPatch = Point & { width: number; height: number; kind: 'ice' | 'sand'; outline?: Point[] };
export const SURFACES = {
  ice: { label: 'Ice', intervalFactor: 0.7, turnMs: 200 },
  sand: { label: 'Quicksand', intervalFactor: 1.7, turnMs: 0 },
} as const;

export function terrainOutline({ x, y, width, height, outline }: TerrainPatch): readonly Point[] {
  return outline ?? [{ x: x - 0.5, y: y - 0.5 }, { x: x + width - 0.5, y: y - 0.5 },
    { x: x + width - 0.5, y: y + height - 0.5 }, { x: x - 0.5, y: y + height - 0.5 }];
}

function insideTerrain(outline: readonly Point[], { x, y }: Point): boolean {
  let inside = false;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
    if ((a.y > y) !== (b.y > y) && x < a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

export function surfaceAt(terrain: readonly TerrainPatch[], point: Point) {
  return terrain.find(({ x, y, width, height, outline }) =>
    point.x >= x - 0.5 && point.x < x + width - 0.5 &&
    point.y >= y - 0.5 && point.y < y + height - 0.5 && (!outline || insideTerrain(outline, point)))?.kind;
}
export type Tilt = { downhill: Point; startedAt: number; endsAt: number };
export const TILT = { rampMs: 1000, minimumLeadMs: 1000, firstFraction: 0.3, lastFraction: 0.5, speedGain: 0.32 } as const;
export function scheduleTilt(settings: Settings, now: number, random = Math.random): Tilt | undefined {
  const roundMs = settings.seconds * 1000;
  const duration = settings.tiltSeconds * 1000;
  const latest = Math.min(roundMs * TILT.lastFraction, roundMs - duration);
  if (latest < TILT.minimumLeadMs || random() * 100 >= settings.tiltChance) return undefined;
  const earliest = Math.min(latest, roundMs * TILT.firstFraction);
  const startedAt = now + Math.round(earliest + random() * (latest - earliest));
  const downhill = [DIRECTIONS.up, DIRECTIONS.down, DIRECTIONS.left, DIRECTIONS.right][Math.floor(random() * 4)]!;
  return { downhill, startedAt, endsAt: startedAt + duration };
}
export function tiltAmount(tilt: Tilt | undefined, now: number): number {
  if (!tilt) return 0;
  const ramp = Math.min(TILT.rampMs, (tilt.endsAt - tilt.startedAt) / 2);
  const fraction = Math.max(0, Math.min(1, (now - tilt.startedAt) / ramp, (tilt.endsAt - now) / ramp));
  return fraction * fraction * (3 - 2 * fraction);
}
export function tiltSpeed(tilt: Tilt | undefined, direction: Point | null, now: number): number {
  if (!tilt || !direction) return 1;
  return 1 + tiltAmount(tilt, now) * TILT.speedGain * (direction.x * tilt.downhill.x + direction.y * tilt.downhill.y) /
    (Math.hypot(direction.x, direction.y) || 1);
}
export const ITEMS = {
  strength: { name: 'Strength', color: '#ffc46e' },
  speed: { name: 'Speed', color: '#66ebbf' },
  slow: { name: 'Slow trap', color: '#e3a8ff' },
  vault: { name: 'Vault', color: '#8de8ff' },
  gun: { name: 'Golden gun', color: '#ffd23f' },
} as const;
/** Items used for opening pickups and ordinary respawns. The golden gun is rare and spawns separately (see GUN). */
export const COMMON_ITEMS = ['strength', 'speed', 'slow', 'vault'] as const;
export const ITEM_KINDS = [...COMMON_ITEMS, 'gun'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export type Pickup = Point & { kind: ItemKind };
export type Trap = Point & { team: Team; expires: number };
/** A round water hole in the ice sheet (Penguin world). Fall in and you're out until respawn. */
export type Hole = Point & { radius: number };
/** A brief splash where someone fell into the water, for drawing. */
export type Splash = Point & { at: number };
export type BlackHole = Point & { expires: number };
/** A golden gun shot, kept briefly so clients can draw the tracer. */
export type Shot = { from: Point; to: Point; team: Team; at: number; hitId: string | null; stoppedBy: 'wall' | 'king' | 'player' | 'range' };
export const MOVEMENTS = ['ice', 'smooth', 'classic'] as const;
export type Movement = (typeof MOVEMENTS)[number];
export const WORLDS = ['penguin', 'arena', 'rooms', 'space'] as const;
export type World = (typeof WORLDS)[number];
/** True for movement modes with fractional coordinates (Smooth and Ice). Use this instead of `movement === 'smooth'`. */
export const isFractional = (movement: Movement) => movement !== 'classic';
export type Settings = {
  teamSize: number; seconds: number; wins: number; size: number;
  timeout: 'draw' | 'proximity'; movement: Movement; pickupCount: number; portalCount: number;
  world: World; balanceBots: boolean; tiltChance: number; tiltSeconds: number;
};
export const LIMITS = {
  teamSize: { min: 2, max: 8, initial: 4 },
  seconds: { min: 10, max: 600, initial: 90 },
  wins: { min: 1, max: 20, initial: 3 },
  size: { min: 32, max: 256, initial: 48 },
  pickupCount: { min: 0, max: 40, initial: 14 },
  portalCount: { min: 0, max: 8, initial: 4 },
  tiltChance: { min: 0, max: 100, initial: 50 },
  tiltSeconds: { min: 1, max: 120, initial: 20 },
} as const;
export const DEFAULT_SETTINGS: Settings = {
  teamSize: LIMITS.teamSize.initial, seconds: LIMITS.seconds.initial,
  wins: LIMITS.wins.initial, size: LIMITS.size.initial, timeout: 'draw',
  movement: 'ice', pickupCount: LIMITS.pickupCount.initial, portalCount: LIMITS.portalCount.initial,
  world: 'penguin', balanceBots: false,
  tiltChance: LIMITS.tiltChance.initial, tiltSeconds: LIMITS.tiltSeconds.initial,
};
export function matchStartError(settings: Settings, players: readonly Player[]): string | undefined {
  const counts = TEAMS.map(team => players.filter(player => player.team === team && !player.bot).length);
  if (settings.balanceBots ? counts.some(count => count === 0) : counts.some(count => count !== settings.teamSize)) {
    return settings.balanceBots ? 'Starting requires at least one human on each team.' : `Both teams need ${settings.teamSize} players.`;
  }
}
export const TUNING = {
  roundCountdownMs: 3000, roundGoMs: 700,
  pushTiles: 2, strengthMs: 6000, speedMs: 4000, slowMs: 3000,
  moveMs: 100, fastMoveMs: 65, slowMoveMs: 200, proximityTiles: 5, tickMs: 25,
  smoothRadius: 0.44, smoothStep: 0.2, smoothPushCooldownMs: 400,
  smoothTurnMs: 70, smoothFastTurnMs: 120,
  pickupRadius: 0.9, pickupSpacing: 2, respawnMinMs: 2500, respawnMaxMs: 6500,
  trapLifetimeMs: 20000,
  vaultMs: 5000, vaultWallTiles: 6, vaultPlayerTiles: 2, vaultScanStep: 0.05,
  kingRechargeMs: 10000, recoilDistance: 1, recoilMs: 180,
};
// Penguin world ice physics (used by src/ice.ts). Velocities in tiles/ms.
export const ICE = {
  /** Time to accelerate from standstill to top speed while holding a direction. */
  accelMs: 520,
  /** How fast sideways momentum fades after a turn (higher = longer drift). */
  gripMs: 340,
  /** How fast you coast to a stop after releasing all keys (higher = longer slide). */
  glideMs: 950,
  /** Above top speed (e.g. after a speed boost ends), excess speed bleeds off at this fraction of the acceleration. */
  overspeedBleed: 0.45,
  /** Top speed relative to normal movement speed. */
  topSpeedScale: 1.1,
  /** Fraction of the into-wall speed kept, reversed, when a penguin slides into a wall. */
  wallBounce: 0.25,
  /** Below this speed (tiles/ms) a coasting penguin stops completely. */
  restSpeed: 0.0004,
} as const;
// Golden gun (rare item; see src/gun.ts).
export const GUN = {
  /** Shots per gun. */
  shots: 3,
  /** Chance that a respawning pickup becomes a golden gun (only when none is on the board). */
  spawnChance: 0.08,
  /** Maximum shot distance in tiles. */
  rangeTiles: 14,
  /** Shot resolution step and how close (in tiles) a shot must pass to hit a player. */
  stepTiles: 0.25, hitRadius: 0.5,
  /** Time before a shot player respawns in their team's starting box. */
  respawnMs: 3000,
  /** How long tracers stay in the state for drawing. */
  tracerMs: 350,
} as const;
// Water holes in the ice (Penguin world; see src/holes.ts).
export const HOLES = {
  /** One mirrored pair of holes per this many tiles of board side (48 → 3 pairs, 64 → 4). */
  tilesPerPair: 16,
  minRadius: 1.4, maxRadius: 2.4,
  /** You fall in once your centre is this far past the rim, so grazing the edge is forgiving. */
  edgeMargin: 0.25,
  /** Clearances in tiles from starting boxes, obstacles, the board edge and other holes. */
  boxClearance: 3, obstacleClearance: 1.6, edgeClearance: 2, spacing: 4,
  /** Out-of-play time after falling in, and how long the splash is drawn. */
  respawnMs: 3000, splashMs: 700,
} as const;
export const SPACE = {
  minDelayMs: 4000, maxDelayMs: 8000, durationMs: 6500,
  radius: 9, coreRadius: 1, maxPullPerMs: 0.0035,
  spawnInset: 0.25, spawnAttempts: 16,
} as const;
export const REPLAY = { windowMs: 3000, sampleMs: 75, speed: 0.75, holdMs: 700 };
export type Player = Point & {
  id: string; name: string; team: Team; king: boolean; strengthUntil: number;
  bot?: true;
  paceUntil: number; pace: 'speed' | 'slow' | null;
  inventory: ItemKind[]; collected: number; used: number; tripped: number;
  vaultUntil: number;
  sprintReadyAt: number; recoilUntil: number; portalTrips: number;
  /** Last movement direction; golden gun shots go this way. */
  facing: Point;
  /** Shots left on the held golden gun (0 = not started yet). */
  gunAmmo: number;
  /** While > 0 the player is dead and respawns at this time. */
  respawnAt: number;
  outCause: 'shot' | 'drowned' | null;
  kills: number; deaths: number;
};
export type Result = { winner: Team | null; reason: 'capture' | 'timeout' | 'king-drowned' };
export type ReplayFrame = {
  tilt?: Tilt;
  now: number; pickups: Pickup[]; traps: Trap[]; blackHole: BlackHole | null;
  players: Pick<Player, 'id' | 'team' | 'king' | 'x' | 'y' | 'strengthUntil' | 'paceUntil' | 'pace' |
    'recoilUntil' | 'portalTrips' | 'respawnAt'>[];
};
export type CaptureReplay = {
  hunterId: string; kingId: string; contact: Point; frames: ReplayFrame[];
};
export type State = {
  blackHole: BlackHole | null;
  tilt?: Tilt;
  outline?: readonly Point[];
  host: string | null; phase: 'lobby' | 'countdown' | 'playing' | 'between' | 'finished';
  settings: Settings; score: Record<Team, number>; round: number;
  deadline: number; now: number; players: Player[]; obstacles: Obstacle[]; pickups: Pickup[]; traps: Trap[];
  portals: Point[]; terrain: TerrainPatch[]; shots: Shot[]; holes: Hole[]; splashes: Splash[]; result: Result | null; replay: CaptureReplay | null; notice: string | null;
};
export const roundStartsAt = (state: State) => state.deadline - state.settings.seconds * 1000;
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
  const { teamSize, seconds, wins, size, timeout, movement, pickupCount, portalCount, world, balanceBots = false,
    tiltChance = DEFAULT_SETTINGS.tiltChance, tiltSeconds = DEFAULT_SETTINGS.tiltSeconds } = value;
  function valid(key: keyof typeof LIMITS, n: unknown): n is number {
    const { min, max } = LIMITS[key];
    return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  }
  return valid('teamSize', teamSize) && valid('seconds', seconds) &&
    valid('wins', wins) && valid('size', size) && valid('pickupCount', pickupCount) &&
    valid('portalCount', portalCount) && portalCount !== 1 &&
    valid('tiltChance', tiltChance) && valid('tiltSeconds', tiltSeconds) &&
    typeof balanceBots === 'boolean' && MOVEMENTS.some(mode => mode === movement) && WORLDS.some(option => option === world)
    ? { teamSize, seconds, wins, size, timeout, movement: movement as Movement, pickupCount, portalCount, world: world as World,
      balanceBots, tiltChance, tiltSeconds } : null;
}
