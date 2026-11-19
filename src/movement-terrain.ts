import { onBoard } from './board-shape.ts';
import { nearSpawn } from './icesheet.ts';
import { mirror } from './layout.ts';
import type { Point, World } from './rules.ts';

type Footprint = Point & { rx: number; ry: number };
export type MovementTerrain = Footprint & (
  { kind: 'iceberg' | 'rubble' } | { kind: 'conveyor' | 'boost'; direction: Point }
);

export const TRAVERSAL = {
  slopeGain: 0.38, conveyorGain: 0.32, boostSpeed: 1.48, boostMs: 650, boostAlignment: 0.7,
  boostRunout: 6,
  rubbleGripMs: 75, rubbleTurnMs: 65,
} as const;

const KINDS = { penguin: 'iceberg', arena: 'rubble', rooms: 'conveyor', space: 'boost' } as const;

export function generateMovementTerrain(size: number, world: World, outline: readonly Point[],
  occupied: (point: Point) => boolean, random = Math.random): MovementTerrain[] {
  const kind = KINDS[world];
  const start = Math.floor(random() * size * size);
  const horizontal = random() < 0.5;
  const sign = random() < 0.5 ? 1 : -1;
  const center = (size - 1) / 2;

  function fits({ x, y, rx, ry }: Footprint): boolean {
    for (const dx of [-rx, rx]) for (const dy of [-ry, ry]) {
      if (!onBoard(outline, { x: x + dx, y: y + dy }, 0.5)) return false;
    }
    for (let dy = -Math.floor(ry + 0.9); dy <= Math.floor(ry + 0.9); dy++) {
      for (let dx = -Math.floor(rx + 0.9); dx <= Math.floor(rx + 0.9); dx++) {
        const u = Math.max(0, Math.abs(dx) - 0.9) / rx;
        const v = Math.max(0, Math.abs(dy) - 0.9) / ry;
        if ((kind === 'iceberg' || kind === 'rubble') && u * u + v * v > 1) continue;
        const point = { x: x + dx, y: y + dy };
        if (nearSpawn(point, size, 1) || occupied(point)) return false;
      }
    }
    return true;
  }

  for (const scale of [1, 0.75, 0.6]) for (const alongX of [horizontal, !horizontal]) {
    const long = 3 * scale;
    const short = (kind === 'iceberg' || kind === 'rubble' ? 2.2 : 1) * scale;
    const rx = alongX ? long : short, ry = alongX ? short : long;
    for (let i = 0; i < size * size; i++) {
      const tile = (start + i) % (size * size);
      const a = { x: tile % size, y: Math.floor(tile / size), rx, ry };
      const b = { ...a, ...mirror(a, size) };
      if (Math.abs(a.x - b.x) < 2 * rx + 1 && Math.abs(a.y - b.y) < 2 * ry + 1) continue;
      const forward = kind === 'boost' ? Math.sign(center - (alongX ? a.x : a.y)) : sign;
      const dx = alongX ? forward : 0, dy = alongX ? 0 : forward;
      if (kind === 'boost') {
        if (!forward) continue;
        const halfRunout = TRAVERSAL.boostRunout / 2;
        const extended = {
          x: a.x + dx * halfRunout, y: a.y + dy * halfRunout,
          rx: rx + Math.abs(dx) * halfRunout, ry: ry + Math.abs(dy) * halfRunout,
        };
        if (!fits(extended) || !fits({ ...extended, ...mirror(extended, size) })) continue;
      } else if (!fits(a) || !fits(b)) continue;
      if (kind === 'iceberg' || kind === 'rubble') return [{ ...a, kind }, { ...b, kind }];
      return [
        { ...a, kind, direction: { x: dx, y: dy } },
        { ...b, kind, direction: { x: -dx, y: -dy } },
      ];
    }
  }
  return [];
}

export function movementTerrainAt(patches: readonly MovementTerrain[], { x, y }: Point): MovementTerrain | undefined {
  return patches.find(patch => {
    const dx = (x - patch.x) / patch.rx, dy = (y - patch.y) / patch.ry;
    return 'direction' in patch ? Math.abs(dx) <= 1 && Math.abs(dy) <= 1 : dx * dx + dy * dy <= 1;
  });
}

function alignment(a: Point, b: Point) {
  const length = Math.hypot(a.x, a.y);
  return length ? (a.x * b.x + a.y * b.y) / length : 0;
}

export function followsBoost(patch: MovementTerrain | undefined, direction: Point): boolean {
  return patch?.kind === 'boost' && alignment(direction, patch.direction) >= TRAVERSAL.boostAlignment;
}

export function terrainSpeed(patch: MovementTerrain | undefined, position: Point, direction: Point | null): number {
  if (!patch || !direction || patch.kind === 'boost') return 1;
  if (patch.kind === 'conveyor') return 1 + TRAVERSAL.conveyorGain * alignment(direction, patch.direction);

  const x = (position.x - patch.x) / patch.rx, y = (position.y - patch.y) / patch.ry;
  // The slope is flat at the crest and tapers back to flat at the edge.
  const taper = Math.max(0, 1 - x * x - y * y);
  const downhill = { x: x * (3 / patch.rx) * taper, y: y * (3 / patch.ry) * taper };
  const grade = Math.max(-1, Math.min(1, alignment(direction, downhill) * 2.6));
  return 1 + TRAVERSAL.slopeGain * grade;
}
