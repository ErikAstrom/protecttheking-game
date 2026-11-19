import type { Point, World } from './rules.ts';

export function boardOutline(size: number, world: World, variation = 0.5, oppositeVariation = variation): readonly Point[] {
  const lo = -0.5;
  const hi = size - 0.5;
  function half(amount: number): Point[] {
    const cut = size * ((world === 'penguin' ? 0.18 : 0.12) + amount * 0.2);
    const points = [{ x: lo, y: lo }, { x: hi - cut, y: lo }];
    if (world === 'penguin') points.push({ x: hi - cut * 0.3, y: lo + cut * 0.3 });
    points.push({ x: hi, y: lo + cut });
    return points;
  }
  return [...half(variation), ...half(oppositeVariation).map(({ x, y }) => ({ x: size - 1 - x, y: size - 1 - y }))];
}

export function onBoard(outline: readonly Point[], { x, y }: Point, clearance = 0): boolean {
  return outline.every((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    return dx * (y - a.y) - dy * (x - a.x) >= clearance * Math.hypot(dx, dy) - 1e-8;
  });
}
