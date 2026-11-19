import { castShot } from './gun.ts';
import { boardOutline, onBoard } from './board-shape.ts';
import { canTraverse, levelAt } from './walkway.ts';
import { DIRECTIONS, GUN, TUNING, isFractional } from './rules.ts';
import type { Direction, Player, Point, State } from './rules.ts';

const BOT = { thinkMs: 250, threatRange: 7, itemRange: 4, holeClearance: 0.75, turnLeadMs: 100 };
const steps = [DIRECTIONS.up, DIRECTIONS.down, DIRECTIONS.left, DIRECTIONS.right];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const tile = (point: Point) => ({ x: Math.round(point.x), y: Math.round(point.y) });

type Plan = { at: number; route: Point[]; goal: Point | undefined; portalTrips: number; deaths: number };

function routeTo(state: State, bot: Player, goal: Point, quarry?: Player): Point[] {
  const { size } = state.settings;
  const outline = state.outline ?? boardOutline(size, state.roundWorld ?? state.settings.world);
  const clearance = isFractional(state.settings.movement) ? TUNING.smoothRadius : 0;
  const key = ({ x, y }: Point) => y * size + x;
  const start = key(tile(bot));
  const target = key(tile(goal));
  if (start === target) return [];
  const blocked = new Uint8Array(size * size);
  for (const obstacle of state.obstacles) blocked[key(obstacle)] = 1;
  for (const hole of state.holes) {
    const radius = hole.radius + BOT.holeClearance;
    for (let y = Math.max(0, Math.ceil(hole.y - radius)); y <= Math.min(size - 1, Math.floor(hole.y + radius)); y++) {
      for (let x = Math.max(0, Math.ceil(hole.x - radius)); x <= Math.min(size - 1, Math.floor(hole.x + radius)); x++) {
        if (distance(hole, { x, y }) <= radius) blocked[key({ x, y })] = 1;
      }
    }
  }
  for (const other of state.players) {
    if (other !== bot && other !== quarry && !other.respawnAt) blocked[key(tile(other))] = 1;
  }
  for (const trap of state.traps) if (trap.team !== bot.team) blocked[key(tile(trap))] = 1;

  const parents = new Int32Array(size * size).fill(-1);
  const queue = new Int32Array(size * size);
  queue[0] = start;
  parents[start] = start;
  let length = 1;
  let nearest = start;
  let best = Infinity;
  for (let cursor = 0; cursor < length; cursor++) {
    const here = queue[cursor]!;
    if (here === target) { nearest = here; break; }
    const x = here % size;
    const y = Math.floor(here / size);
    const score = Math.abs(x - goal.x) + Math.abs(y - goal.y);
    if (score < best) { best = score; nearest = here; }
    for (const step of steps) {
      const nx = x + step.x;
      const ny = y + step.y;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      const next = ny * size + nx;
      const point = { x: nx, y: ny };
      if (blocked[next] || parents[next] !== -1 || !onBoard(outline, point, clearance) ||
          !canTraverse(state.walkway, { x, y }, point)) continue;
      parents[next] = here;
      queue[length++] = next;
    }
  }
  const route: Point[] = [];
  for (let current = nearest; current !== start; current = parents[current]!) {
    route.push({ x: current % size, y: Math.floor(current / size) });
  }
  return route.reverse();
}

function directionTo(bot: Player, waypoint: Point, fractional: boolean, velocity?: Point): Direction | null {
  const dx = waypoint.x - bot.x;
  const dy = waypoint.y - bot.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.18) return null;
  const vx = (velocity?.x ?? 0) * BOT.turnLeadMs;
  const vy = (velocity?.y ?? 0) * BOT.turnLeadMs;
  const alignment = Math.hypot(vx, vy) > 0.3 ? 0.35 : 0.04;
  const x = horizontal || (fractional && Math.abs(dx - vx) > alignment) ? Math.sign(horizontal ? dx : dx - vx) : 0;
  const y = !horizontal || (fractional && Math.abs(dy - vy) > alignment) ? Math.sign(horizontal ? dy - vy : dy) : 0;
  return (Object.keys(DIRECTIONS) as Direction[]).find(key => DIRECTIONS[key].x === x && DIRECTIONS[key].y === y) ?? null;
}

export class BotPilot {
  private readonly plans = new Map<string, Plan>();

  reset(): void {
    this.plans.clear();
  }

  control(state: State, bot: Player, velocity: Point | undefined): { direction: Direction | null; useItem: boolean } {
    let plan = this.plans.get(bot.id);
    const think = !plan || plan.at <= state.now || plan.portalTrips !== bot.portalTrips || plan.deaths !== bot.deaths;
    if (think || !plan) {
      const active = state.players.filter(player => !player.respawnAt);
      const allyKing = active.find(player => player.team === bot.team && player.king);
      const enemies = active.filter(player => player.team !== bot.team);
      const enemyKing = enemies.find(player => player.king);
      const threat = allyKing && enemies.reduce<Player | undefined>((closest, enemy) =>
        !enemy.king && distance(allyKing, enemy) < (closest ? distance(allyKing, closest) : BOT.threatRange) ? enemy : closest, undefined);
      const intercept = allyKing && threat ? { x: (allyKing.x + threat.x) / 2, y: (allyKing.y + threat.y) / 2 } : undefined;
      const push = threat && (bot.strengthUntil > state.now || bot.inventory[0] === 'strength');
      const quarry = intercept ? (push ? threat : undefined) : enemyKing;
      const goal = quarry ?? intercept;
      const route = goal ? routeTo(state, bot, goal, quarry) : [];
      plan = { at: state.now + BOT.thinkMs, route, goal: goal && { x: goal.x, y: goal.y }, portalTrips: bot.portalTrips, deaths: bot.deaths };
      this.plans.set(bot.id, plan);
    }

    const fractional = isFractional(state.settings.movement);
    while (plan.route[0] && distance(bot, plan.route[0]) <= (fractional ? 0.38 : 0)) plan.route.shift();
    const here = tile(bot);
    const waypoint = plan.route[0] ?? (plan.goal &&
      here.x === Math.round(plan.goal.x) && here.y === Math.round(plan.goal.y) ? plan.goal : undefined);
    const direction = waypoint ? directionTo(bot, waypoint, fractional, velocity) : null;
    return { direction, useItem: think && this.shouldUseItem(state, bot, direction) };
  }

  private shouldUseItem(state: State, bot: Player, direction: Direction | null): boolean {
    const kind = bot.inventory[0];
    if (!kind) return false;
    const enemies = state.players.filter(player => player.team !== bot.team && !player.respawnAt);
    if (kind === 'strength' || kind === 'slow') {
      return (kind !== 'strength' || bot.strengthUntil <= state.now) &&
        enemies.some(enemy => !enemy.king && distance(bot, enemy) <= BOT.itemRange);
    }
    if (kind === 'speed') return direction !== null && bot.paceUntil <= state.now;
    if (kind !== 'gun') return false;
    const facing = direction ? DIRECTIONS[direction] : bot.facing;
    const level = levelAt(state.walkway, bot);
    return !!castShot(bot, facing, bot.team, state.players.filter(player => player !== bot && !player.respawnAt &&
      levelAt(state.walkway, player) === level),
      point => {
        const { x, y } = tile(point);
        const { size } = state.settings;
        const world = state.roundWorld ?? state.settings.world;
        return levelAt(state.walkway, point) !== level ||
          !onBoard(state.outline ?? boardOutline(size, world), { x, y }) || state.obstacles.some(wall => wall.x === x && wall.y === y);
      },
      GUN.rangeTiles, GUN.stepTiles, GUN.hitRadius).hit;
  }
}
