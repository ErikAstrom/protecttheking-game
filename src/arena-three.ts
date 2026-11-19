import * as THREE from 'three';
import { boardOutline } from './board-shape.ts';
import { HOLES, ITEMS, SPACE, terrainOutline, tiltAmount } from './rules.ts';
import type { CaptureReplay, Point, ReplayFrame, State, World } from './rules.ts';
import { levelAt, stairAxisAt, WALKWAY } from './walkway.ts';
import { arenaSurface } from './arena-three-art.ts';

const TIER = 0.55;
const PALETTE = {
  penguin: { sky: 0x123752, edge: 0x518ca4, wall: 0x78b8cf, trim: 0xd4f2fb },
  arena: { sky: 0x182424, edge: 0x353c35, wall: 0x686b63, trim: 0xb1aa97 },
  rooms: { sky: 0x152637, edge: 0x233d47, wall: 0x52747b, trim: 0xa2c2bf },
  space: { sky: 0x090d24, edge: 0x434d77, wall: 0x59688d, trim: 0x80b9dc },
} satisfies Record<World, Record<string, number>>;
const TEAM = { red: 0xff616a, blue: 0x53baff };
const ITEM_LABEL = { strength: '✊', speed: '⚡', slow: '✥', vault: '↥', gun: '⌖' };

function shape(points: readonly Point[]) {
  const result = new THREE.Shape();
  for (const [i, p] of points.entries()) {
    if (i) result.lineTo(p.x, -p.y);
    else result.moveTo(p.x, -p.y);
  }
  result.closePath();
  return result;
}

export class ThreeArena {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera();
  private readonly pivot = new THREE.Group();
  private readonly board = new THREE.Group();
  private readonly fixed = new THREE.Group();
  private readonly roundGeometry: THREE.BufferGeometry[] = [];
  private readonly surfaces = new Map<World, THREE.MeshStandardMaterial>();
  private readonly sun = new THREE.DirectionalLight(0xffe6c6, 2.45);
  private readonly dynamic = new Map<string, THREE.Object3D>();
  private readonly used = new Set<string>();
  private readonly materials = new Map<THREE.ColorRepresentation, THREE.MeshStandardMaterial>();
  private readonly labels = new Map<string, THREE.SpriteMaterial>();
  private readonly box = new THREE.BoxGeometry();
  private readonly ball = new THREE.SphereGeometry(1, 16, 10);
  private readonly gem = new THREE.OctahedronGeometry(1);
  private readonly ring = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
  private readonly disk = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  private readonly crown = new THREE.CylinderGeometry(0.31, 0.23, 0.23, 5);
  private readonly fin = new THREE.ConeGeometry(1, 1, 4);
  private readonly matrix = new THREE.Matrix4();
  private readonly beamDirection = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private round = -1;

  constructor(canvas: HTMLCanvasElement, context: WebGL2RenderingContext) {
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
    const { width, height } = canvas;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0004;
    this.scene.add(new THREE.HemisphereLight(0xe4f6ff, 0x585278, 1.65), this.pivot, this.sun);
    this.pivot.add(this.board);
    this.board.add(this.fixed);
  }

  private material(color: THREE.ColorRepresentation) {
    let result = this.materials.get(color);
    if (!result) {
      result = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
      this.materials.set(color, result);
    }
    return result;
  }

  private mesh(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation,
    x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  }

  private label(text: string, width: number, height: number) {
    let material = this.labels.get(text);
    if (!material) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not draw Three.js arena labels.');
      ctx.font = 'bold 38px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#122034';
      ctx.strokeText(text, 128, 32, 240);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 128, 32, 240);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      material = new THREE.SpriteMaterial({ map: texture });
      this.labels.set(text, material);
    }
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, height, 1);
    return sprite;
  }

  private polygon(points: readonly Point[], color: number, height: number) {
    const geometry = new THREE.ShapeGeometry(shape(points)).rotateX(-Math.PI / 2);
    this.roundGeometry.push(geometry);
    this.fixed.add(this.mesh(geometry, color, 0, height, 0));
  }

  private boxes(boxes: { x: number; y: number; h: number; color: number; width?: number; depth?: number; base?: number }[],
    shadows = true) {
    if (!boxes.length) return;
    const batch = new THREE.InstancedMesh(this.box, this.material(0xffffff), boxes.length);
    const tint = new THREE.Color();
    for (const [i, { x, y, h, color, width = 1, depth = 1, base = 0 }] of boxes.entries()) {
      this.matrix.makeScale(width, h, depth).setPosition(x, base + h / 2, y);
      batch.setMatrixAt(i, this.matrix);
      batch.setColorAt(i, tint.setHex(color));
    }
    batch.castShadow = shadows;
    batch.receiveShadow = true;
    this.fixed.add(batch);
  }

  private rebuild(state: State) {
    this.clearRound();
    this.round = state.round;
    const { size } = state.settings;
    const world = state.roundWorld ?? state.settings.world;
    const colors = PALETTE[world];
    this.scene.background = new THREE.Color(colors.sky);
    const center = (size - 1) / 2;
    this.board.position.set(-center, 0, -center);
    this.camera.position.set(0, size * 0.84, size);
    this.camera.lookAt(0, 0, 0);
    const halfWidth = size * 0.57;
    const halfHeight = halfWidth * this.renderer.domElement.height / this.renderer.domElement.width;
    Object.assign(this.camera, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight, far: size * 4 });
    this.camera.updateProjectionMatrix();
    this.sun.position.set(-size * 0.44, size, size * 0.28);
    const extent = size * 0.78;
    Object.assign(this.sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, far: size * 2.7 });
    this.sun.shadow.camera.updateProjectionMatrix();

    const outline = state.outline ?? boardOutline(size, world);
    const floor = shape(outline);
    for (const hole of state.holes) {
      const path = new THREE.Path();
      path.absarc(hole.x, -hole.y, hole.radius, 0, 2 * Math.PI, true);
      floor.holes.push(path);
      this.fixed.add(this.mesh(this.disk, 0x246e99, hole.x, -0.32, hole.y, hole.radius, 1, hole.radius),
        this.mesh(this.ring, 0xd5f8ff, hole.x, 0.02, hole.y, hole.radius * 1.06, 1, hole.radius * 1.06));
    }
    const slab = new THREE.ExtrudeGeometry(floor, { depth: 0.65, bevelEnabled: false, curveSegments: 24 });
    slab.rotateX(-Math.PI / 2).translate(0, -0.65, 0);
    this.roundGeometry.push(slab);
    let surface = this.surfaces.get(world);
    if (!surface) {
      surface = new THREE.MeshStandardMaterial({ map: arenaSurface(world), roughness: world === 'penguin' ? 0.4 : 0.83 });
      this.surfaces.set(world, surface);
    }
    const deck = new THREE.Mesh(slab, [surface, this.material(colors.edge)]);
    deck.receiveShadow = true;
    this.fixed.add(deck);
    for (const patch of state.terrain) this.polygon(terrainOutline(patch),
      patch.kind === 'ice' ? 0x5395ac : world === 'penguin' ? 0x80999e : 0x9a784f, 0.013);
    for (const [x, y, color] of [[3, 2, 0x9e5263], [size - 4, size - 3, 0x426e9b]] as const) {
      this.fixed.add(this.mesh(this.box, color, x, 0.013, y, 7, 0.025, 5));
    }

    const boxes = state.obstacles.map(({ x, y, kind }) => ({ x, y,
      h: kind === 'pillar' ? 1.25 : kind === 'crate' ? 0.82 : 0.64,
      color: kind === 'crate' ? (world === 'penguin' ? 0xdaf6ff : 0x9a6948) : colors.wall }));
    const caps = boxes.map(({ x, y, h, color }) => ({ x, y, h: 0.075, base: h,
      width: world === 'penguin' ? 1 : 0.92, depth: world === 'penguin' ? 1 : 0.92,
      color: color === colors.wall ? colors.trim : color }));
    const { walkway } = state;
    if (walkway) for (const section of walkway.branch ? [walkway, walkway.branch] : [walkway]) {
      for (let y = section.y; y < section.y + section.depth; y++) {
        for (let x = section.x; x < section.x + section.width; x++) {
          const point = { x, y };
          const h = levelAt(walkway, point) * TIER;
          const stairs = stairAxisAt(walkway, point);
          boxes.push({ x, y, h, color: stairs ? 0x9a7849 : 0x536681 });
          caps.push({ x, y, h: 0.03, base: h, width: stairs === 'x' ? 0.8 : 0.97,
            depth: stairs === 'y' ? 0.8 : 0.97, color: stairs ? 0xf3c675 : 0x7488a1 });
        }
      }
    }
    this.boxes(boxes);
    this.boxes(caps, false);
    for (const patch of state.movementTerrain) {
      const { x, y, rx, ry } = patch;
      if ('direction' in patch) {
        const color = patch.kind === 'boost' ? 0x319cbe : 0xc28839;
        this.fixed.add(this.mesh(this.box, color, x, 0.026, y, 2 * rx, 0.045, 2 * ry));
        for (const offset of [-0.62, 0, 0.62]) {
          const { direction } = patch;
          const arrow = this.mesh(this.fin, 0xf1f4ff, x + direction.x * offset * rx,
            0.09, y + direction.y * offset * ry, 0.28, 0.7, 0.28);
          arrow.quaternion.setFromUnitVectors(this.up, this.beamDirection.set(direction.x, 0, direction.y));
          this.fixed.add(arrow);
        }
      } else {
        this.fixed.add(this.mesh(this.ball, patch.kind === 'iceberg' ? 0x75b9d1 : 0x877363,
          x, 0, y, rx, 0.38, ry));
      }
    }
    for (const { x, y } of state.portals) {
      this.fixed.add(this.mesh(this.disk, 0x392966, x, 0.049, y, 0.85, 1, 0.85),
        this.mesh(this.ring, 0xd6acff, x, 0.052, y, 0.9, 1, 0.9));
      const marker = this.label('↻', 2.4, 0.8);
      marker.position.set(x, 0.32, y);
      this.fixed.add(marker);
    }
    if (world === 'space') {
      const positions = [];
      for (let i = 0; i < 260; i++) {
        positions.push(Math.sin(i * 42.37) * size * 1.3, -2 - (i % 5), Math.cos(i * 15.43) * size * 1.3);
      }
      const stars = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      this.roundGeometry.push(stars);
      this.fixed.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xa6c8ed, size: 2, sizeAttenuation: false })));
    }
  }

  private entity(key: string, create: () => THREE.Object3D) {
    this.used.add(key);
    let object = this.dynamic.get(key);
    if (!object) {
      object = create();
      this.board.add(object);
      this.dynamic.set(key, object);
    }
    return object;
  }

  private animal(team: keyof typeof TEAM, king: boolean, local: boolean, heldGun: boolean, replayLabel: string) {
    const group = new THREE.Group();
    const body = new THREE.Group();
    body.name = 'body';
    const dark = team === 'red' ? 0x263344 : 0x192940;
    const white = 0xe9f3f8;
    if (team === 'red') {
      body.add(this.mesh(this.ball, dark, 0, 0.58, 0, 0.48, 0.63, 0.46),
        this.mesh(this.ball, white, 0, 0.58, 0.28, 0.37, 0.45, 0.25),
        this.mesh(this.ball, dark, 0, 1.09, 0.09, 0.36, 0.36, 0.36),
        this.mesh(this.ball, 0xffb05a, 0, 1.02, 0.42, 0.19, 0.09, 0.18));
      for (const side of [-1, 1]) body.add(
        this.mesh(this.ball, dark, side * 0.43, 0.52, 0, 0.17, 0.37, 0.2),
        this.mesh(this.ball, 0xffb05a, side * 0.23, 0.11, 0.24, 0.2, 0.11, 0.24),
        this.mesh(this.ball, white, side * 0.14, 1.16, 0.4, 0.055, 0.07, 0.035));
    } else {
      body.add(this.mesh(this.ball, dark, 0, 0.45, 0, 0.5, 0.41, 0.76),
        this.mesh(this.ball, white, 0, 0.29, 0.25, 0.37, 0.23, 0.51),
        this.mesh(this.fin, dark, 0, 0.95, -0.15, 0.14, 0.66, 0.3),
        this.mesh(this.ball, dark, 0, 0.41, -0.73, 0.39, 0.1, 0.21));
      for (const side of [-1, 1]) body.add(
        this.mesh(this.ball, dark, side * 0.43, 0.28, 0.01, 0.34, 0.1, 0.2),
        this.mesh(this.ball, white, side * 0.4, 0.58, 0.35, 0.13, 0.072, 0.19));
    }
    if (king) {
      body.add(this.mesh(this.crown, 0xf5c15b, 0, 1.58, 0));
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        body.add(this.mesh(this.gem, 0xffdd80, 0.27 * Math.cos(a), 1.76, 0.27 * Math.sin(a), 0.11, 0.17, 0.11));
      }
    }
    if (heldGun) body.add(this.mesh(this.box, 0xe9b84e, 0.46, 0.66, 0.46, 0.15, 0.15, 0.52));
    for (const part of body.children) part.castShadow = true;
    group.add(body, this.mesh(this.disk, 0x162436, 0, 0.021, 0, 0.73, 1, 0.73),
      this.mesh(this.ring, TEAM[team], 0, 0.028, 0, 0.75, 1, 0.75));
    if (local) group.add(this.mesh(this.ring, 0xffffff, 0, 0.03, 0, 0.9, 1, 0.9));
    if (replayLabel) {
      const label = this.label(replayLabel, 3.8, 0.95);
      label.position.y = king ? 2.65 : 2;
      group.add(label);
    }
    return group;
  }

  draw(state: State, scene: ReplayFrame, next: ReplayFrame, id: string, fraction: number,
    time: number, replay?: CaptureReplay, impact = false) {
    if (this.round !== state.round) this.rebuild(state);
    const at = scene.now + (next.now - scene.now) * fraction;
    const tilt = scene.tilt ?? next.tilt;
    const angle = tiltAmount(tilt, at) * 0.09;
    this.pivot.rotation.set((tilt?.downhill.y ?? 0) * angle, 0, -(tilt?.downhill.x ?? 0) * angle);
    this.used.clear();
    for (const player of scene.players) {
      if (player.respawnAt) continue;
      const target = next.players.find(candidate => candidate.id === player.id) ?? player;
      const blend = player.portalTrips === target.portalTrips ? fraction : 0;
      const x = player.x + (target.x - player.x) * blend, y = player.y + (target.y - player.y) * blend;
      const holder = state.players.find(candidate => candidate.id === player.id);
      const gun = !replay && holder?.inventory[0] === 'gun';
      const badge = replay?.kingId === player.id ? 'CAPTURED KING' : replay?.hunterId === player.id ? 'HUNTER' : '';
      const model = this.entity(`player:${player.id}:${player.king}:${gun}:${badge}`,
        () => this.animal(player.team, player.king, player.id === id, gun, badge));
      const level = levelAt(state.walkway, { x, y });
      const drop = player.drop;
      const progress = drop ? Math.max(0, Math.min(1, (at - drop.at) / WALKWAY.dropMs)) : 1;
      const extra = drop && level === drop.to ? (drop.from - drop.to) * (1 - progress ** 2) : 0;
      model.position.set(x, (level + extra) * TIER, y);
      model.scale.setScalar((player.king ? 1.16 : 1) * (player.strengthUntil > at ? 1.25 : 1));
      const body = model.getObjectByName('body')!;
      const dt = next.now - scene.now;
      const dx = (target.x - player.x) * Math.sign(dt), dy = (target.y - player.y) * Math.sign(dt);
      const moving = player.portalTrips === target.portalTrips && Math.hypot(dx, dy) > 0.015;
      const facing = holder?.facing;
      if (moving) body.rotation.y = Math.atan2(dx, dy);
      else if (!replay && facing) body.rotation.y = Math.atan2(facing.x, facing.y);
      body.position.y = moving ? Math.sin(time / 55 + x) * 0.07 : 0;
      const effect = player.recoilUntil > at ? 'recoil' : player.paceUntil > at ? player.pace : null;
      if (effect) {
        const aura = this.entity(`aura:${player.id}:${effect}`, () => this.mesh(this.ring,
          effect === 'recoil' ? 0xffeff0 : effect === 'slow' ? 0xc98dff : 0x6bfac6, 0, 0, 0));
        aura.position.copy(model.position);
        aura.position.y += 0.058;
        const radius = 0.94 + Math.sin(time / 110) * 0.06;
        aura.scale.set(radius, 1, radius);
      }
    }
    for (const { x, y, kind } of scene.pickups) {
      const pickup = this.entity(`item:${x}:${y}:${kind}`, () => {
        const group = new THREE.Group();
        const label = this.label(ITEM_LABEL[kind], 2.5, 0.9);
        label.position.y = 1.05;
        group.add(this.mesh(this.gem, ITEMS[kind].color, 0, 0.4, 0, 0.53, 0.62, 0.53), label);
        return group;
      });
      const marker = this.entity(`item-ring:${x}:${y}:${kind}`,
        () => this.mesh(this.ring, ITEMS[kind].color, x, 0.048, y, 0.88, 1, 0.88));
      marker.scale.x = marker.scale.z = 0.84 + Math.sin(time / 300 + x) * 0.06;
      pickup.position.set(x, 0.72 + Math.sin(time / 240 + x) * 0.18, y);
      const gem = pickup.children[0]!;
      gem.rotation.y = time / 520;
    }
    for (const trap of scene.traps) {
      const mesh = this.entity(`trap:${trap.team}:${trap.x}:${trap.y}`,
        () => this.mesh(this.ring, TEAM[trap.team], trap.x, 0.055, trap.y, 0.8, 1, 0.8));
      mesh.position.y = levelAt(state.walkway, trap) * TIER + 0.055;
    }
    if (scene.blackHole) {
      const hole = this.entity('black-hole', () => {
        const group = new THREE.Group();
        group.add(this.mesh(this.ring, 0xaa66ff, 0, 0.05, 0, SPACE.radius, 1, SPACE.radius),
          this.mesh(this.ring, 0xd3a0ff, 0, 0.055, 0, SPACE.coreRadius * 1.5, 1, SPACE.coreRadius * 1.5),
          this.mesh(this.ball, 0x050315, 0, 0.19, 0, SPACE.coreRadius, 0.36, SPACE.coreRadius));
        for (let i = 0; i < 12; i++) group.add(this.mesh(this.gem, i % 3 ? 0xa774ed : 0xffc7ff,
          0, 0.08, 0, 0.11, 0.09, 0.24));
        return group;
      });
      hole.position.set(scene.blackHole.x, 0, scene.blackHole.y);
      hole.children[1]!.scale.setScalar(SPACE.coreRadius * (1.45 + Math.sin(time / 170) * 0.15));
      for (let i = 3; i < hole.children.length; i++) {
        const mote = hole.children[i]!;
        const phase = ((time / 2300 + i / 12) % 1 + 1) % 1;
        const angle = -time / 430 + i * 2.4;
        const radius = SPACE.coreRadius + (SPACE.radius - SPACE.coreRadius) * (1 - phase);
        mote.position.set(radius * Math.cos(angle), 0.09, radius * Math.sin(angle));
        mote.rotation.y = -angle;
      }
    }
    if (!replay) {
      for (const [i, shot] of state.shots.entries()) {
        const delta = this.beamDirection.set(shot.to.x - shot.from.x, 0, shot.to.y - shot.from.y);
        const beam = this.entity(`beam:${i}`, () => this.mesh(this.box, 0xffbf4b, 0, 0, 0));
        beam.position.set((shot.to.x + shot.from.x) / 2, levelAt(state.walkway, shot.from) * TIER + 0.66,
          (shot.to.y + shot.from.y) / 2);
        beam.scale.set(0.085, 0.085, delta.length());
        beam.rotation.y = Math.atan2(delta.x, delta.z);
      }
      for (const [i, splash] of state.splashes.entries()) {
        const size = 0.4 + (Math.max(0, at - splash.at) / HOLES.splashMs) * 1.5;
        const ripple = this.entity(`splash:${i}`, () => this.mesh(this.ring, 0xbdfaff, 0, 0, 0));
        ripple.position.set(splash.x, 0.07, splash.y);
        ripple.scale.set(size, 1, size);
      }
    }
    if (replay && impact) {
      const { contact } = replay;
      const burst = this.entity('impact', () => this.mesh(this.gem, 0xffd686, contact.x,
        levelAt(state.walkway, contact) * TIER + 0.6, contact.y, 0.6, 0.6, 0.6));
      burst.rotation.y = time / 140;
    }
    for (const [key, object] of this.dynamic) if (!this.used.has(key)) {
      this.board.remove(object);
      this.dynamic.delete(key);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private clearRound() {
    for (const object of this.dynamic.values()) this.board.remove(object);
    this.dynamic.clear();
    for (const object of this.fixed.children) {
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (object instanceof THREE.Points) object.material.dispose();
    }
    this.fixed.clear();
    for (const geometry of this.roundGeometry.splice(0)) geometry.dispose();
  }

  dispose() {
    this.clearRound();
    for (const geometry of [this.box, this.ball, this.gem, this.ring, this.disk, this.crown, this.fin]) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const material of this.surfaces.values()) {
      material.map?.dispose();
      material.dispose();
    }
    this.sun.shadow.dispose();
    for (const material of this.labels.values()) {
      material.map?.dispose();
      material.dispose();
    }
    this.renderer.dispose();
  }
}
