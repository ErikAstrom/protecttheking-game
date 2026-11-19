import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { World } from './rules.ts';

const SIZE = 256;
const SURFACES = {
  penguin: ['#d3edf5', '#eafaff', '#a8cfdf'],
  arena: ['#777d71', '#8e9385', '#565e54'],
  rooms: ['#46645d', '#527369', '#354f48'],
  space: ['#3b4361', '#47516f', '#293349'],
} as const;

export function arenaSurface(world: World) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the arena surface.');
  const [base, light, dark] = SURFACES[world];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);
  if (world === 'penguin') {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    for (const [x, y] of [[43, 62], [155, 110], [94, 192], [211, 221]] as const) {
      ctx.beginPath();
      ctx.moveTo(x - 24, y + 12);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 20, y + 2);
      ctx.lineTo(x + 29, y - 12);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y - 10);
      ctx.stroke();
    }
  } else {
    const stone = world === 'arena';
    const width = stone ? 64 : 128;
    const height = stone ? 32 : 128;
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y += height) {
      const shift = stone && y % (height * 2) ? width / 2 : 0;
      for (let x = -shift; x < SIZE; x += width) {
        ctx.fillStyle = base;
        ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
        ctx.fillStyle = light;
        ctx.fillRect(x + 3, y + 2, width - 6, 2);
        if (world === 'space') {
          ctx.fillStyle = '#6396af';
          for (const dx of [6, width - 9]) for (const dy of [7, height - 10]) {
            ctx.fillRect(x + dx, y + dy, 3, 3);
          }
        }
      }
    }
  }
  for (let i = 0; i < 2048; i++) {
    const x = (Math.imul(i, 4703) ^ (i >>> 4)) & 255;
    const y = (Math.imul(i, 563) ^ (i >>> 2)) & 255;
    ctx.fillStyle = i % 2 ? '#ffffff12' : '#00000012';
    ctx.fillRect(x, y, 2, 1);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.setScalar(1 / 8);
  texture.anisotropy = 4;
  return texture;
}
