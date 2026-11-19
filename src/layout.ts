import type { Obstacle, Point } from './rules.ts';

const SECTORS = 4;
const LANE_MARGIN = 2;

export function mirror({ x, y }: Point, size: number): Point {
  return { x: size - 1 - x, y: size - 1 - y };
}

export function generateArena(size: number, random = Math.random): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const edge = (sector: number) => Math.floor(size * sector / SECTORS);
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
