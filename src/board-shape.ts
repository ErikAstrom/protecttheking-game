import type { Point, World } from './rules.ts';

const outlines = new Map<string, Point[]>();

export function boardOutline(size: number, world: World): readonly Point[] {
  const key = `${size}:${world}`;
  const cached = outlines.get(key);
  if (cached) return cached;
  const lo = -0.5;
  const hi = size - 0.5;
  if (world === 'rooms' || world === 'space') return [{ x: lo, y: lo }, { x: hi, y: lo }, { x: hi, y: hi }, { x: lo, y: hi }];
  const cut = size * (world === 'penguin' ? 0.28 : 0.2);
  const top = [{ x: lo, y: lo }, { x: hi - cut, y: lo }];
  if (world === 'penguin') top.push({ x: hi - cut * 0.3, y: lo + cut * 0.3 });
  top.push({ x: hi, y: lo + cut });
  const outline = [...top, ...top.map(({ x, y }) => ({ x: size - 1 - x, y: size - 1 - y }))];
  outlines.set(key, outline);
  return outline;
}

export function onBoard(outline: readonly Point[], { x, y }: Point, clearance = 0): boolean {
  return outline.every((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    return dx * (y - a.y) - dy * (x - a.x) >= clearance * Math.hypot(dx, dy) - 1e-8;
  });
}
