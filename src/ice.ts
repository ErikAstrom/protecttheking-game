// Penguin world ice physics. Pure functions only: no game state, so it's easy to test and tune.
// Velocities are in tiles per millisecond; durations are in milliseconds.
import { ICE } from './rules.ts';
import type { Point } from './rules.ts';

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

/**
 * Next velocity on ice.
 * - Holding a direction accelerates along it, up to `topSpeed`.
 * - Momentum sideways to the held direction decays slowly, so turning makes you drift.
 * - Holding the opposite direction brakes at the acceleration rate (you skid before reversing).
 * - With no input you glide and slowly come to rest.
 */
export function iceVelocity(velocity: Point, direction: Point | null, topSpeed: number, elapsed: number): Point {
  if (elapsed <= 0) return velocity;
  if (!direction || (!direction.x && !direction.y)) {
    const keep = Math.exp(-elapsed / ICE.glideMs);
    const next = { x: velocity.x * keep, y: velocity.y * keep };
    return Math.hypot(next.x, next.y) < ICE.restSpeed ? { x: 0, y: 0 } : next;
  }
  const length = Math.hypot(direction.x, direction.y);
  const unit = { x: direction.x / length, y: direction.y / length };
  const along = dot(velocity, unit);
  const sideways = { x: velocity.x - along * unit.x, y: velocity.y - along * unit.y };
  const accel = (topSpeed / ICE.accelMs) * elapsed;
  const nextAlong = along <= topSpeed
    ? Math.min(topSpeed, along + accel)
    : Math.max(topSpeed, along - accel * ICE.overspeedBleed);
  const grip = Math.exp(-elapsed / ICE.gripMs);
  return { x: unit.x * nextAlong + sideways.x * grip, y: unit.y * nextAlong + sideways.y * grip };
}

/**
 * Velocity after a slide step: axes that were blocked bounce back a little, and axes that moved keep their speed.
 * `intended` is the velocity before moving; `moved` is the actual displacement this step.
 */
export function afterSlide(intended: Point, moved: Point, elapsed: number): Point {
  const axis = (v: number, d: number) => {
    const expected = v * elapsed;
    if (Math.abs(expected) < 1e-9) return 0;
    return Math.abs(d) + 1e-6 >= Math.abs(expected) * 0.5 ? v : -v * ICE.wallBounce;
  };
  return { x: axis(intended.x, moved.x), y: axis(intended.y, moved.y) };
}
