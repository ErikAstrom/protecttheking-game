// Penguin world visuals: ocean, ice floe, ice blocks and penguins. Drawing only — no game rules here.
import type { Obstacle, Point, TerrainPatch } from './rules.ts';

export type Project = (x: number, y: number, z?: number) => Point;

const ICE_TOP = '#e9f6fb';
const ICE_SHADE = '#bfe0ec';
const ICE_EDGE = '#7fc3d8';
const ICE_DEEP = '#3f8fae';
const OCEAN = '#0b3a5c';
const OCEAN_DEEP = '#06253f';

/** Deterministic pseudo-random numbers so cracks and floating chunks don't jump between frames. */
function seeded(seed: number) {
  let value = seed % 2147483647 || 1;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

function shape(ctx: CanvasRenderingContext2D, points: Point[], fill: string, stroke?: string, width = 1) {
  ctx.beginPath();
  points.forEach(({ x, y }, index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, w), Math.max(0.1, h), rotation, 0, 2 * Math.PI);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Ocean background, the floating ice floe (with visible thickness), cracks, and tinted team nests. */
export function drawIceFloe(
  ctx: CanvasRenderingContext2D, project: Project, size: number, width: number, height: number, time: number,
) {
  const sea = ctx.createLinearGradient(0, 0, 0, height);
  sea.addColorStop(0, OCEAN);
  sea.addColorStop(1, OCEAN_DEEP);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, width, height);

  // Rolling wave highlights.
  ctx.strokeStyle = '#5fb4d633';
  ctx.lineWidth = 2;
  for (let row = 0; row < 9; row++) {
    const y = 8 + row * (height / 8);
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += 10) {
      const wave = Math.sin(x / 38 + time / 900 + row * 1.7) * 3;
      if (x === -20) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  // Small ice chunks bobbing in the water around the floe.
  const random = seeded(size * 977);
  for (let index = 0; index < 14; index++) {
    const side = index % 2 ? 1 : -1;
    const x = width / 2 + side * (width * 0.455 + random() * width * 0.04);
    const y = 40 + random() * (height - 80) + Math.sin(time / 700 + index) * 2;
    const w = 6 + random() * 10;
    shape(ctx, [
      { x: x - w, y }, { x: x - w * 0.4, y: y - w * 0.45 }, { x: x + w * 0.7, y: y - w * 0.3 },
      { x: x + w, y: y + w * 0.1 }, { x: x + w * 0.2, y: y + w * 0.4 },
    ], '#d8eef6', '#7fc3d8');
  }

  const a = project(-0.5, -0.5), b = project(size - 0.5, -0.5);
  const c = project(size - 0.5, size - 0.5), d = project(-0.5, size - 0.5);
  const thickness = 24;

  // Foam ring where the floe meets the water.
  const foam = 5 + Math.sin(time / 500) * 1.5;
  shape(ctx, [
    { x: a.x - foam, y: a.y - foam }, { x: b.x + foam, y: b.y - foam },
    { x: c.x + foam, y: c.y + thickness + foam }, { x: d.x - foam, y: d.y + thickness + foam },
  ], '#cfeaf455');

  // Ice thickness on the near and side edges.
  shape(ctx, [d, c, { x: c.x, y: c.y + thickness }, { x: d.x, y: d.y + thickness }], ICE_EDGE);
  shape(ctx, [b, c, { x: c.x, y: c.y + thickness }, { x: b.x, y: b.y + thickness * 0.4 }], ICE_DEEP);
  shape(ctx, [a, d, { x: d.x, y: d.y + thickness }, { x: a.x, y: a.y + thickness * 0.4 }], ICE_DEEP);
  ctx.strokeStyle = '#ffffff55';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let line = 1; line < 3; line++) {
    ctx.moveTo(d.x, d.y + (thickness * line) / 3);
    ctx.lineTo(c.x, c.y + (thickness * line) / 3);
  }
  ctx.stroke();

  // The slab itself.
  const top = ctx.createLinearGradient(0, a.y, 0, d.y);
  top.addColorStop(0, ICE_SHADE);
  top.addColorStop(0.5, ICE_TOP);
  top.addColorStop(1, '#d6edf6');
  shape(ctx, [a, b, c, d], '#000');
  ctx.fillStyle = top;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cracks and scuffs.
  const crack = seeded(size * 131 + 7);
  ctx.strokeStyle = '#8fc5d866';
  ctx.lineWidth = 1.2;
  for (let index = 0; index < Math.round(size / 3); index++) {
    let x = crack() * size, y = crack() * size;
    ctx.beginPath();
    const start = project(x, y);
    ctx.moveTo(start.x, start.y);
    for (let segment = 0; segment < 3; segment++) {
      x += (crack() - 0.5) * 4;
      y += (crack() - 0.5) * 3;
      const point = project(Math.max(-0.4, Math.min(size - 0.6, x)), Math.max(-0.4, Math.min(size - 0.6, y)));
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  // Glints that drift slowly across the ice.
  for (let index = 0; index < 6; index++) {
    const gx = ((index * 0.17 + time / 40000) % 1) * size;
    const gy = ((index * 0.37) % 1) * size;
    const p = project(gx, gy);
    oval(ctx, p.x, p.y, 14, 3, '#ffffff99', -0.2);
  }

  // Team nests in the spawn corners.
  const face = (x: number, y: number, w: number, h: number) =>
    [project(x, y), project(x + w, y), project(x + w, y + h), project(x, y + h)];
  shape(ctx, face(-0.5, -0.5, 7, 5), '#ff737b30', '#ff737b66');
  shape(ctx, face(size - 7.5, size - 5.5, 7, 5), '#62bcff30', '#62bcff66');
}

/** Obstacles as packed ice: walls are ice blocks (plain tops, so neighbouring blocks merge into one iceberg), crates are snow-capped blocks, pillars are tall ice spires. */
export function drawIceBlock(ctx: CanvasRenderingContext2D, project: Project, obstacle: Obstacle, scale: number) {
  const x = obstacle.x - 0.5, y = obstacle.y - 0.5;
  const h = Math.max(5, scale * (obstacle.kind === 'pillar' ? 1.05 : 0.8));
  const face = (fx: number, fy: number, w: number, d: number, z = 0) =>
    [project(fx, fy, z), project(fx + w, fy, z), project(fx + w, fy + d, z), project(fx, fy + d, z)];
  shape(ctx, face(x + 0.1, y + 0.3, 1.05, 1), '#5a9fb944');
  if (obstacle.kind === 'pillar') {
    const base = project(x + 0.5, y + 0.85);
    const tip = project(x + 0.5, y + 0.5, h * 1.25);
    const half = Math.max(3, scale * 0.42);
    shape(ctx, [{ x: base.x - half, y: base.y }, tip, { x: base.x + half, y: base.y }], '#a8dcec', '#ffffff', 1);
    shape(ctx, [{ x: base.x - half * 0.15, y: base.y }, tip, { x: base.x + half * 0.55, y: base.y }], '#e6f7fd');
    return;
  }
  shape(ctx, [project(x, y + 1, h), project(x + 1, y + 1, h), project(x + 1, y + 1), project(x, y + 1)], '#8ccbe0');
  shape(ctx, face(x, y, 1.01, 1, h), '#d5eef7');
  if (obstacle.kind === 'crate') {
    const top = project(x + 0.5, y + 0.5, h);
    oval(ctx, top.x, top.y - 1, Math.max(3, scale * 0.5), Math.max(2, scale * 0.24), '#ffffff');
  }
  const shine = project(x + 0.3, y + 1, h * 0.55);
  oval(ctx, shine.x, shine.y, Math.max(1.5, scale * 0.12), Math.max(1, h * 0.25), '#ffffffaa');
}

/** Terrain patches in Penguin world: ice patches are dark, glassy "black ice"; quicksand becomes deep slush. */
export function drawPenguinTerrain(ctx: CanvasRenderingContext2D, project: Project, terrain: readonly TerrainPatch[]) {
  const face = (fx: number, fy: number, w: number, d: number) =>
    [project(fx, fy), project(fx + w, fy), project(fx + w, fy + d), project(fx, fy + d)];
  for (const { x, y, width, height, kind } of terrain) {
    const left = x - 0.5, top = y - 0.5;
    if (kind === 'ice') {
      shape(ctx, face(left, top, width, height), '#4f9cc2', '#2f7aa3');
      shape(ctx, face(left + 0.3, top + 0.3, width - 0.6, height - 0.6), '#79bfdc');
      for (let i = 1; i < 4; i++) {
        const sx = left + width * i / 4, sy = top + height * i / 4;
        shape(ctx, [project(sx - width * 0.14, sy + height * 0.11), project(sx + width * 0.14, sy - height * 0.16),
          project(sx + width * 0.03, sy + height * 0.08)], '#f2fdffaa');
      }
    } else {
      shape(ctx, face(left, top, width, height), '#9fb3bf', '#7c93a1');
      shape(ctx, face(left + 0.25, top + 0.25, width - 0.5, height - 0.5), '#b9c9d2');
      const random = seeded(Math.round(x * 31 + y * 17 + width));
      for (let i = 0; i < width * height / 6; i++) {
        const p = project(left + 0.4 + random() * (width - 0.8), top + 0.4 + random() * (height - 0.8));
        oval(ctx, p.x, p.y, 3 + random() * 3, 1.5 + random() * 1.5, '#8aa1ae');
      }
    }
  }
}

export type PenguinLook = {
  /** Screen position of the penguin's feet. */
  at: Point;
  /** Base size in pixels. */
  r: number;
  team: string;
  teamLetter: string;
  king: boolean;
  you: boolean;
  /** Recent screen-space movement per frame, used for facing, leaning and ice spray. */
  motion: Point;
  time: number;
};

/** A penguin with a team-coloured scarf; kings are emperor penguins with a crown. */
export function drawPenguin(ctx: CanvasRenderingContext2D, look: PenguinLook) {
  const { at, r, team, king, you, motion, time } = look;
  const speed = Math.hypot(motion.x, motion.y);
  const facing = motion.x > 0.02 ? 1 : motion.x < -0.02 ? -1 : 0;
  const lean = Math.max(-0.5, Math.min(0.5, motion.x * 1.6));

  // Ice spray behind fast-sliding penguins.
  if (speed > 0.12) {
    for (let index = 0; index < 4; index++) {
      const back = 0.6 + index * 0.45;
      const jitter = Math.sin(time / 60 + index * 2.1) * r * 0.25;
      oval(ctx, at.x - (motion.x / speed) * r * back + jitter, at.y - (motion.y / speed) * r * back * 0.5,
        r * (0.22 - index * 0.04), r * (0.13 - index * 0.025), '#ffffffcc');
    }
  }

  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(lean);

  // Feet.
  oval(ctx, -r * 0.32, -r * 0.05, r * 0.3, r * 0.14, '#ff9f2e');
  oval(ctx, r * 0.32, -r * 0.05, r * 0.3, r * 0.14, '#ff9f2e');

  // Flippers flare out while sliding.
  const flare = Math.min(0.9, 0.25 + speed * 3);
  oval(ctx, -r * 0.82, -r * 1.15, r * 0.2, r * 0.62, '#16212c', flare);
  oval(ctx, r * 0.82, -r * 1.15, r * 0.2, r * 0.62, '#16212c', -flare);

  // Body, belly and scarf.
  oval(ctx, 0, -r * 1.1, r * 0.92, r * 1.18, '#16212c');
  oval(ctx, facing * r * 0.12, -r * 0.98, r * 0.62, r * 0.95, '#f7fbff');
  if (king) {
    oval(ctx, -r * 0.48, -r * 1.75, r * 0.2, r * 0.32, '#ffc94a', 0.5);
    oval(ctx, r * 0.48, -r * 1.75, r * 0.2, r * 0.32, '#ffc94a', -0.5);
  }
  oval(ctx, 0, -r * 1.66, r * 0.82, r * 0.2, team);
  const tail = Math.sin(time / 140) * r * 0.12;
  shape(ctx, [
    { x: -facing * r * 0.45 - r * 0.05, y: -r * 1.7 },
    { x: -facing * r * 1.25 - r * 0.15, y: -r * 1.55 + tail },
    { x: -facing * r * 1.1 - r * 0.15, y: -r * 1.3 + tail },
    { x: -facing * r * 0.35, y: -r * 1.55 },
  ], team);

  // Head, face patches, eyes and beak.
  oval(ctx, 0, -r * 2.15, r * 0.62, r * 0.58, '#16212c');
  oval(ctx, facing * r * 0.14 - r * 0.24, -r * 2.17, r * 0.17, r * 0.2, '#ffffff');
  oval(ctx, facing * r * 0.14 + r * 0.24, -r * 2.17, r * 0.17, r * 0.2, '#ffffff');
  oval(ctx, facing * r * 0.19 - r * 0.22, -r * 2.15, r * 0.07, r * 0.09, '#0b1321');
  oval(ctx, facing * r * 0.19 + r * 0.26, -r * 2.15, r * 0.07, r * 0.09, '#0b1321');
  const beakX = facing * r * 0.42;
  shape(ctx, [
    { x: beakX - r * 0.16, y: -r * 2.02 }, { x: beakX + r * 0.16, y: -r * 2.02 },
    { x: beakX + facing * r * 0.3, y: -r * 1.9 },
  ], '#ff9f2e');
  if (!facing) shape(ctx, [{ x: -r * 0.16, y: -r * 2.0 }, { x: r * 0.16, y: -r * 2.0 }, { x: 0, y: -r * 1.82 }], '#ff9f2e');

  // Team letter on the belly, so teams are readable without relying on colour alone.
  ctx.font = `bold ${Math.max(8, r * 0.7)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0b1321aa';
  ctx.fillText(look.teamLetter, facing * r * 0.12, -r * 0.9);

  if (king) {
    const cy = -r * 2.68;
    shape(ctx, [
      { x: -r * 0.6, y: cy - r * 0.42 }, { x: -r * 0.26, y: cy - r * 0.18 }, { x: 0, y: cy - r * 0.6 },
      { x: r * 0.26, y: cy - r * 0.18 }, { x: r * 0.6, y: cy - r * 0.42 }, { x: r * 0.44, y: cy + r * 0.15 },
      { x: -r * 0.44, y: cy + r * 0.15 },
    ], '#ffdc78', '#a8742a');
  }
  ctx.restore();

  const label = king ? (you ? 'YOUR KING' : 'KING') : you ? 'YOU' : '';
  if (label) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0b1321cc';
    const y = at.y - r * (king ? 3.75 : 3.05);
    ctx.strokeText(label, at.x, y);
    ctx.fillStyle = king ? '#ffe097' : '#ffffff';
    ctx.fillText(label, at.x, y);
  }
}
