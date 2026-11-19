import type { Obstacle, Point, TerrainPatch } from './rules.ts';

const SECTORS = 4;
const LANE_MARGIN = 2;
const sectorEdge = (sector: number, size: number) => Math.floor(size * sector / SECTORS);

export function mirror({ x, y }: Point, size: number): Point {
  return { x: size - 1 - x, y: size - 1 - y };
}

export function generateArena(size: number, random = Math.random): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const edge = (sector: number) => sectorEdge(sector, size);
  for (let row = 0; row < SECTORS / 2; row++) {
    for (let column = 0; column < SECTORS; column++) {
      if (row === 0 && column === 0) continue;
      const left = edge(column) + LANE_MARGIN;
      const top = edge(row) + LANE_MARGIN;
      const width = edge(column + 1) - LANE_MARGIN - left;
      const height = edge(row + 1) - LANE_MARGIN - top;
      const vertical = random() < 0.5;
      const flip = random() < 0.5;
      const run = vertical ? height : width;
      const depth = vertical ? width : height;
      function place(along: number, across: number, kind: Obstacle['kind']) {
        const side = flip ? depth - 1 - across : across;
        const point = { x: left + (vertical ? side : along), y: top + (vertical ? along : side) };
        obstacles.push({ ...point, kind }, { ...mirror(point, size), kind });
      }

      const length = Math.floor(run * (0.7 + random() * 0.24));
      const start = Math.floor(random() * (run - length + 1));
      const wallEdge = Math.floor(random() * (depth - 3));
      for (let index = start; index < start + length; index++) place(index, wallEdge, 'wall');
      const bend = random() < 0.5 ? start : start + length - 1;
      place(bend, wallEdge + 1, 'wall');
      place(Math.floor(random() * Math.floor(run / 2)), depth - 1, 'crate');
      place(Math.floor(run / 2) + Math.floor(random() * Math.ceil(run / 2)), depth - 1, 'pillar');
    }
  }
  return obstacles;
}

export function generateTerrain(size: number, random = Math.random): TerrainPatch[] {
  const sectors = [1, 2, 3, 4, 5, 6, 7];
  const patches: TerrainPatch[] = [];
  for (const kind of ['ice', 'sand', 'ice', 'sand'] as const) {
    const [sector] = sectors.splice(Math.floor(random() * sectors.length), 1);
    if (sector === undefined) break;
    const column = sector % SECTORS;
    const row = Math.floor(sector / SECTORS);
    const x = sectorEdge(column, size) + LANE_MARGIN;
    const y = sectorEdge(row, size) + LANE_MARGIN;
    const width = sectorEdge(column + 1, size) - LANE_MARGIN - x;
    const height = sectorEdge(row + 1, size) - LANE_MARGIN - y;
    patches.push({ x, y, width, height, kind }, { x: size - x - width, y: size - y - height, width, height, kind });
  }
  return patches;
}
