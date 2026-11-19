// Penguin world layout: a mostly open ice sheet with a few chunky, rotationally mirrored icebergs.
import type { Obstacle, Point } from './rules.ts';
import { mirror } from './layout.ts';

export const ICE_SHEET = {
  /** Spawn box in the red corner (tiles 0..width-1, 0..height-1); blue's is mirrored. */
  spawn: { width: 7, height: 5 },
  /** Open ice kept around each spawn box. */
  spawnClearance: 3,
  /** Open ice kept along the floe's edge, so there is always a lap lane around the sheet. */
  edgeLane: 3,
  /** Minimum open ice between two icebergs (Chebyshev distance), so lanes stay wide enough to slide. */
  gap: 5,
  /** Board side length per mirrored iceberg pair. Higher = fewer icebergs (a 48-tile board gets 3 pairs). */
  tilesPerPair: 16,
  /** Iceberg footprint range in tiles (before corners are chipped off). */
  minSide: 3,
  maxSide: 5,
  attempts: 400,
} as const;

const key = ({ x, y }: Point) => `${x},${y}`;

/** True for tiles inside a spawn box (either team) grown by `margin`. */
export function nearSpawn({ x, y }: Point, size: number, margin = 0): boolean {
  const { width, height } = ICE_SHEET.spawn;
  const inRed = (p: Point) => p.x < width + margin && p.y < height + margin;
  return inRed({ x, y }) || inRed(mirror({ x, y }, size));
}

/** One iceberg: a chunky block with some corners chipped off (drawn as one slab of ice blocks). */
function berg(random: () => number): Obstacle[] {
  const { minSide, maxSide } = ICE_SHEET;
  const side = () => minSide + Math.floor(random() * (maxSide - minSide + 1));
  const width = side(), height = side();
  const tiles: Obstacle[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
      if (corner && width > 3 && height > 3 && random() < 0.6) continue;
      tiles.push({ x, y, kind: 'wall' });
    }
  }
  return tiles;
}

/** Chebyshev distance between the closest tiles of two tile sets. */
function apart(a: readonly Point[], b: readonly Point[]): number {
  let best = Infinity;
  for (const p of a) for (const q of b) best = Math.min(best, Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)));
  return best;
}

export function generateIceSheet(size: number, random = Math.random): Obstacle[] {
  const { edgeLane, gap, spawnClearance, tilesPerPair, attempts } = ICE_SHEET;
  const pairs = Math.max(2, Math.round(size / tilesPerPair));
  const placed: Obstacle[][] = [];
  for (let attempt = 0; attempt < attempts && placed.length < pairs * 2; attempt++) {
    const shape = berg(random);
    const width = Math.max(...shape.map(tile => tile.x)) + 1;
    const height = Math.max(...shape.map(tile => tile.y)) + 1;
    const left = edgeLane + Math.floor(random() * (size - 2 * edgeLane - width + 1));
    const top = edgeLane + Math.floor(random() * (size - 2 * edgeLane - height + 1));
    const tiles = shape.map(tile => ({ ...tile, x: tile.x + left, y: tile.y + top }));
    const twin = tiles.map(tile => ({ ...tile, ...mirror(tile, size) }));
    if (tiles.some(tile => nearSpawn(tile, size, spawnClearance))) continue;
    if (apart(tiles, twin) <= gap || placed.some(other => apart(tiles, other) <= gap)) continue;
    placed.push(tiles, twin);
  }
  return placed.flat();
}

/** Tiles at least `clearance` tiles (Chebyshev) from every obstacle and outside the spawn margins — the open ice. */
export function openTiles(size: number, obstacles: readonly Point[], clearance: number, spawnMargin = 0): Point[] {
  const blocked = new Set(obstacles.map(key));
  const open: Point[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (nearSpawn({ x, y }, size, spawnMargin)) continue;
      let clear = true;
      for (let dy = -clearance; clear && dy <= clearance; dy++) {
        for (let dx = -clearance; dx <= clearance; dx++) if (blocked.has(key({ x: x + dx, y: y + dy }))) clear = false;
      }
      if (clear) open.push({ x, y });
    }
  }
  return open;
}
