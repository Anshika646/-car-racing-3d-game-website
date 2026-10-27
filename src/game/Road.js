/**
 * Road.js
 *
 * Endless 4-lane 3D Chroma Arcade Highway environment:
 * - 5 vibrant selectable worlds inspired by Chroma Confetti Drive Arena:
 *   1. Neon Chroma City (midnight)
 *   2. Sunny Modern City (city)
 *   3. Grand Prix Track (track)
 *   4. Golden Sunset Canyon (sunset)
 *   5. Candy Confetti Synthwave (cyber_dusk)
 * - High-anisotropy procedural asphalt with crisp neon/daylight edge lines
 * - Multi-color rainbow barrier reflectors, instanced lane markings & glowing studs
 * - Dynamic per-world colorful skyline towers, roadside trees & crystal boulders
 */

import * as THREE from 'three';

export const LANE_CENTERS = [-5.1, -1.7, 1.7, 5.1];

export const ATMOSPHERE_PRESETS = [
  {
    id: 'midnight',
    name: 'Neon Chroma City',
    swatch: '#ff2eb6',
    tag: 'Rainbow Night',
    isDaylight: false,
    skyHex: 0x110a2c,
    fogDensity: 0.0086,
    hemiSkyHex: 0x22e4ff,
    hemiGroundHex: 0x241042,
    hemiIntensity: 1.05,
    keyLightHex: 0xfff2d6,
    keyIntensity: 1.75,
    rimLightHex: 0xff2eb6,
    rimIntensity: 1.15,
    terrainHex: 0x160d33,
    roadTintHex: 0xffffff,
    barrierHex: 0x281b4d,
    railHex: 0xff2eb6,
    railGlowHex: 0xff2eb6,
    railGlowIntensity: 0.95,
    glowHex: 0x9d1768,
    bulbHex: 0xffe224,
    studHex: 0x22e4ff,
    dashEmissiveHex: 0x22e4ff,
    towerPalette: [0xff2eb6, 0x22e4ff, 0xa3ff2e, 0xffe224, 0x9d4edd, 0xff8c1a],
    treePalette: [0x10b981, 0x06b6d4, 0x8b5cf6, 0xec4899],
    reflectorPalette: [0xff8c1a, 0xffe224, 0xa3ff2e, 0x22e4ff, 0x9d4edd, 0xff2eb6],
  },
  {
    id: 'city',
    name: 'Sunny Modern City',
    swatch: '#38bdf8',
    tag: 'Bright Day',
    isDaylight: true,
    skyHex: 0x72c6ff,
    fogDensity: 0.0058,
    hemiSkyHex: 0xdbeafe,
    hemiGroundHex: 0x3b8c47,
    hemiIntensity: 1.25,
    keyLightHex: 0xfff8dc,
    keyIntensity: 2.15,
    rimLightHex: 0x38bdf8,
    rimIntensity: 0.75,
    terrainHex: 0x45a352,
    roadTintHex: 0xffffff,
    barrierHex: 0xe2e8f0,
    railHex: 0x38bdf8,
    railGlowHex: 0x000000,
    railGlowIntensity: 0,
    glowHex: 0xbae6fd,
    bulbHex: 0xfffbeb,
    studHex: 0xfacc15,
    dashEmissiveHex: 0xffffff,
    towerPalette: [0xf472b6, 0x38bdf8, 0xfbbf24, 0xa78bfa, 0x34d399, 0xfb923c],
    treePalette: [0x22c55e, 0x16a34a, 0x4ade80, 0x10b981],
    reflectorPalette: [0xef4444, 0xfacc15, 0x3b82f6, 0x10b981],
  },
  {
    id: 'track',
    name: 'Grand Prix Track',
    swatch: '#a3ff2e',
    tag: 'Race Festival',
    isDaylight: true,
    skyHex: 0x52b6ff,
    fogDensity: 0.0056,
    hemiSkyHex: 0xe0f2fe,
    hemiGroundHex: 0x2f9e44,
    hemiIntensity: 1.25,
    keyLightHex: 0xfff7d6,
    keyIntensity: 2.2,
    rimLightHex: 0xfacc15,
    rimIntensity: 0.8,
    terrainHex: 0x379c43,
    roadTintHex: 0xffffff,
    barrierHex: 0xf8fafc,
    railHex: 0xef4444,
    railGlowHex: 0xef4444,
    railGlowIntensity: 0.2,
    glowHex: 0x93c5fd,
    bulbHex: 0xfef08a,
    studHex: 0xef4444,
    dashEmissiveHex: 0xfef08a,
    towerPalette: [0xef4444, 0x2563eb, 0xfacc15, 0x10b981, 0xa855f7, 0xf97316],
    treePalette: [0x16a34a, 0x22c55e, 0x84cc16, 0x15803d],
    reflectorPalette: [0xef4444, 0xffffff, 0xef4444, 0xfacc15],
  },
  {
    id: 'sunset',
    name: 'Golden Sunset',
    swatch: '#ff8c1a',
    tag: 'Warm Canyon',
    isDaylight: false,
    skyHex: 0x421838,
    fogDensity: 0.0076,
    hemiSkyHex: 0xff9e5e,
    hemiGroundHex: 0x522126,
    hemiIntensity: 1.12,
    keyLightHex: 0xffdfb8,
    keyIntensity: 2.0,
    rimLightHex: 0xff2eb6,
    rimIntensity: 1.1,
    terrainHex: 0x8f4334,
    roadTintHex: 0xffeede,
    barrierHex: 0x5c2b3e,
    railHex: 0xff8c1a,
    railGlowHex: 0xff8c1a,
    railGlowIntensity: 0.65,
    glowHex: 0xff6b3d,
    bulbHex: 0xffe224,
    studHex: 0xff8c1a,
    dashEmissiveHex: 0xfbbf24,
    towerPalette: [0xff8c1a, 0xff2eb6, 0xfacc15, 0xf43f5e, 0xc084fc],
    treePalette: [0xd97706, 0xf59e0b, 0x15803d, 0xea580c],
    reflectorPalette: [0xff8c1a, 0xffe224, 0xff2eb6, 0x22e4ff],
  },
  {
    id: 'cyber_dusk',
    name: 'Candy Confetti',
    swatch: '#a855f7',
    tag: 'Chroma Pop',
    isDaylight: false,
    skyHex: 0x210b3a,
    fogDensity: 0.0082,
    hemiSkyHex: 0xf472b6,
    hemiGroundHex: 0x1e0e38,
    hemiIntensity: 1.15,
    keyLightHex: 0xf5d0fe,
    keyIntensity: 1.85,
    rimLightHex: 0x22e4ff,
    rimIntensity: 1.25,
    terrainHex: 0x261044,
    roadTintHex: 0xffffff,
    barrierHex: 0x381960,
    railHex: 0x22e4ff,
    railGlowHex: 0x22e4ff,
    railGlowIntensity: 0.95,
    glowHex: 0xd946ef,
    bulbHex: 0xa3ff2e,
    studHex: 0xff2eb6,
    dashEmissiveHex: 0xf472b6,
    towerPalette: [0xff2eb6, 0xa3ff2e, 0x22e4ff, 0xffe224, 0xc084fc, 0xff8c1a],
    treePalette: [0xec4899, 0x22d3ee, 0xa3e635, 0xa855f7],
    reflectorPalette: [0xff2eb6, 0xa3ff2e, 0x22e4ff, 0xffe224],
  },
];

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

function createAsphaltTexture(maxAnisotropy = 4) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Crisp slate-indigo arcade asphalt base
  ctx.fillStyle = '#1c1b2e';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle lane polish across 4 lanes
  const laneCentersPx = [82, 194, 318, 430];
  for (const cx of laneCentersPx) {
    const grad = ctx.createLinearGradient(cx - 46, 0, cx + 46, 0);
    grad.addColorStop(0, 'rgba(28, 27, 46, 0)');
    grad.addColorStop(0.28, 'rgba(14, 13, 26, 0.36)');
    grad.addColorStop(0.5, 'rgba(46, 42, 74, 0.18)');
    grad.addColorStop(0.72, 'rgba(14, 13, 26, 0.36)');
    grad.addColorStop(1, 'rgba(28, 27, 46, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 46, 0, 92, 512);
  }

  // Fine mineral aggregate speckle
  for (let i = 0; i < 5500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const lum = 26 + Math.floor(Math.random() * 26);
    ctx.fillStyle = `rgb(${lum}, ${lum + 2}, ${lum + 14})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Crisp bright outer shoulder lines + chroma neon trim stripes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(22, 0, 7, 512);
  ctx.fillRect(483, 0, 7, 512);

  // Colorful neon pink & cyan outer curb stripes
  ctx.fillStyle = '#ff2eb6';
  ctx.fillRect(11, 0, 6, 512);
  ctx.fillStyle = '#22e4ff';
  ctx.fillRect(495, 0, 6, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSkylineWindowTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#241d3d';
  ctx.fillRect(0, 0, 128, 256);

  const windowColors = ['#ffe224', '#22e4ff', '#ff2eb6', '#a3ff2e', '#ffffff'];
  for (let row = 8; row < 246; row += 10) {
    for (let col = 8; col < 120; col += 12) {
      const r = Math.random();
      if (r < 0.48) {
        ctx.fillStyle = windowColors[Math.floor(Math.random() * windowColors.length)];
        ctx.fillRect(col, row, 6, 5);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Road {
  constructor(options = {}) {
    this.isSoftwareGl = Boolean(options.isSoftwareGl);
    this.maxAnisotropy = options.maxAnisotropy || 4;
    this.quality = options.quality || 'high';
    this.atmosphere = ATMOSPHERE_PRESETS[0].id;

    this.group = new THREE.Group();
    this.scrollOffset = 0;

    this.roadLength = 230;
    this.zMin = -195;
    this.zMax = 35;

    this._buildTerrainAndRoad();
    this._buildLaneMarkings();
    this._buildBarriers();
    this._buildStreetlights();
    this._buildSceneryTreesAndRocks();
    this._buildDistantHorizon();
    this._buildSpeedStreaks();
    this.setAtmosphere(this.atmosphere);
  }

  _buildTerrainAndRoad() {
    const terrainGeo = new THREE.PlaneGeometry(260, this.roadLength);
    terrainGeo.rotateX(-Math.PI / 2);
    this.terrainMat = new THREE.MeshStandardMaterial({
      color: 0x160d33,
      roughness: 0.92,
      metalness: 0.05,
    });
    const terrain = new THREE.Mesh(terrainGeo, this.terrainMat);
    terrain.position.set(0, -0.04, -80);
    terrain.receiveShadow = !this.isSoftwareGl;
    this.group.add(terrain);

    this.asphaltTex = createAsphaltTexture(this.maxAnisotropy);
    const roadGeo = new THREE.PlaneGeometry(15.2, this.roadLength);
    roadGeo.rotateX(-Math.PI / 2);
    this.roadMat = new THREE.MeshStandardMaterial({
      map: this.asphaltTex,
      color: 0xffffff,
      roughness: 0.64,
      metalness: 0.16,
    });
    const roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    roadMesh.position.set(0, 0, -80);
    roadMesh.receiveShadow = !this.isSoftwareGl;
    this.group.add(roadMesh);
  }

  _buildLaneMarkings() {
    this.dividerX = [-3.4, 0, 3.4];
    this.dashSpacing = 9.0;
    this.dashRows = Math.ceil(this.roadLength / this.dashSpacing);
    const totalDashes = this.dividerX.length * this.dashRows;

    const dashGeo = new THREE.PlaneGeometry(0.18, 3.5);
    dashGeo.rotateX(-Math.PI / 2);
    this.dashMat = new THREE.MeshStandardMaterial({
      color: 0xffe224,
      emissive: 0x22e4ff,
      emissiveIntensity: 0.32,
      roughness: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.dashMesh = new THREE.InstancedMesh(dashGeo, this.dashMat, totalDashes);
    this.dashMesh.frustumCulled = false;

    const studGeo = new THREE.BoxGeometry(0.16, 0.05, 0.22);
    this.studMat = new THREE.MeshBasicMaterial({ color: 0x22e4ff });
    this.studMesh = new THREE.InstancedMesh(studGeo, this.studMat, totalDashes);
    this.studMesh.frustumCulled = false;

    this._updateLaneMarkings(0);
    this.group.add(this.dashMesh);
    this.group.add(this.studMesh);
  }

  _buildBarriers() {
    const barrierGeo = new THREE.BoxGeometry(0.55, 0.82, this.roadLength);
    this.barrierMat = new THREE.MeshStandardMaterial({
      color: 0x281b4d,
      roughness: 0.65,
      metalness: 0.22,
    });

    this.railMat = new THREE.MeshStandardMaterial({
      color: 0xff2eb6,
      emissive: 0xff2eb6,
      emissiveIntensity: 0.95,
      metalness: 0.55,
      roughness: 0.25,
    });

    for (const bx of [-7.75, 7.75]) {
      const barrier = new THREE.Mesh(barrierGeo, this.barrierMat);
      barrier.position.set(bx, 0.41, -80);
      barrier.receiveShadow = !this.isSoftwareGl;
      this.group.add(barrier);

      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.11, this.roadLength),
        this.railMat,
      );
      rail.position.set(bx, 0.88, -80);
      this.group.add(rail);
    }

    this.reflectorSpacing = 7.5;
    this.reflectorRows = Math.ceil(this.roadLength / this.reflectorSpacing);
    const refGeo = new THREE.BoxGeometry(0.1, 0.22, 0.48);
    const refMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.reflectorMesh = new THREE.InstancedMesh(refGeo, refMat, this.reflectorRows * 2);
    this.reflectorMesh.frustumCulled = false;

    this._colorizeReflectors(ATMOSPHERE_PRESETS[0].reflectorPalette);
    this._updateReflectors(0);
    this.group.add(this.reflectorMesh);
  }

  _colorizeReflectors(palette) {
    if (!this.reflectorMesh || !Array.isArray(palette) || palette.length === 0) return;
    const total = this.reflectorRows * 2;
    for (let i = 0; i < total; i++) {
      const hex = palette[Math.floor(i / 2) % palette.length];
      _color.setHex(hex);
      this.reflectorMesh.setColorAt(i, _color);
    }
    if (this.reflectorMesh.instanceColor) {
      this.reflectorMesh.instanceColor.needsUpdate = true;
    }
  }

  _buildStreetlights() {
    this.lightSpacing = 28.0;
    this.lightRows = Math.ceil(this.roadLength / this.lightSpacing);
    const count = this.lightRows * 2;

    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6.8, 8);
    const armGeo = new THREE.BoxGeometry(2.3, 0.1, 0.12);
    const bulbGeo = new THREE.BoxGeometry(0.72, 0.1, 0.32);

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.72,
      roughness: 0.3,
    });
    this.bulbMat = new THREE.MeshBasicMaterial({
      color: 0xffe224,
    });

    this.poleInst = new THREE.InstancedMesh(poleGeo, poleMat, count);
    this.armInst = new THREE.InstancedMesh(armGeo, poleMat, count);
    this.bulbInst = new THREE.InstancedMesh(bulbGeo, this.bulbMat, count);
    this.poleInst.frustumCulled = false;
    this.armInst.frustumCulled = false;
    this.bulbInst.frustumCulled = false;

    this._updateStreetlights(0);
    this.group.add(this.poleInst, this.armInst, this.bulbInst);
  }

  _buildSceneryTreesAndRocks() {
    this.sceneryCount = 64;
    this.sceneryItems = [];

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.8, 7);
    const lowerCrownGeo = new THREE.ConeGeometry(1.48, 3.6, 7);
    const upperCrownGeo = new THREE.ConeGeometry(1.08, 2.8, 7);
    const rockGeo = new THREE.DodecahedronGeometry(1.25, 0);

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5b3a29,
      roughness: 0.88,
      metalness: 0.05,
    });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.08,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.75,
      metalness: 0.18,
    });

    this.trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, this.sceneryCount);
    this.lowerCrownInst = new THREE.InstancedMesh(lowerCrownGeo, foliageMat, this.sceneryCount);
    this.upperCrownInst = new THREE.InstancedMesh(upperCrownGeo, foliageMat, this.sceneryCount);
    this.rockInst = new THREE.InstancedMesh(rockGeo, rockMat, 28);

    this.trunkInst.frustumCulled = false;
    this.lowerCrownInst.frustumCulled = false;
    this.upperCrownInst.frustumCulled = false;
    this.rockInst.frustumCulled = false;

    for (let i = 0; i < this.sceneryCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (10.5 + ((i * 7.3) % 28));
      const baseZ = (i / this.sceneryCount) * this.roadLength;
      const scale = 0.85 + ((i * 13) % 35) / 100;
      this.sceneryItems.push({ x, baseZ, scale, rotY: i * 1.1 });
    }

    this.rockItems = [];
    for (let r = 0; r < 28; r++) {
      const side = r % 2 === 0 ? -1 : 1;
      this.rockItems.push({
        x: side * (11.5 + ((r * 11.7) % 34)),
        baseZ: (r / 28) * this.roadLength,
        sx: 0.9 + (r % 4) * 0.35,
        sy: 0.55 + (r % 3) * 0.25,
        sz: 0.9 + ((r + 2) % 4) * 0.3,
        rotY: r * 0.85,
      });
    }

    this._colorizeScenery(ATMOSPHERE_PRESETS[0]);
    this._updateScenery(0);
    this.group.add(this.trunkInst, this.lowerCrownInst, this.upperCrownInst, this.rockInst);
  }

  _colorizeScenery(preset) {
    const treePalette = preset.treePalette || [0x22c55e];
    for (let i = 0; i < this.sceneryCount; i++) {
      const baseHex = treePalette[i % treePalette.length];
      _color.setHex(baseHex);
      this.lowerCrownInst.setColorAt(i, _color);
      _color.offsetHSL(0.02, 0.05, 0.08);
      this.upperCrownInst.setColorAt(i, _color);
    }
    if (this.lowerCrownInst.instanceColor) this.lowerCrownInst.instanceColor.needsUpdate = true;
    if (this.upperCrownInst.instanceColor) this.upperCrownInst.instanceColor.needsUpdate = true;

    const rockPalette = preset.isDaylight
      ? [0x94a3b8, 0xcbd5e1, 0x64748b]
      : preset.towerPalette || [0x9d4edd, 0x22e4ff, 0xff2eb6];
    for (let r = 0; r < 28; r++) {
      _color.setHex(rockPalette[r % rockPalette.length]);
      if (!preset.isDaylight) {
        _color.multiplyScalar(0.65);
      }
      this.rockInst.setColorAt(r, _color);
    }
    if (this.rockInst.instanceColor) this.rockInst.instanceColor.needsUpdate = true;
  }

  _buildDistantHorizon() {
    const winTex = createSkylineWindowTexture();
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    this.towerMat = new THREE.MeshStandardMaterial({
      map: winTex,
      color: 0xffffff,
      emissive: 0x3b1254,
      emissiveIntensity: 0.45,
      roughness: 0.42,
      metalness: 0.3,
    });

    this.towerCount = 38;
    this.skylineInst = new THREE.InstancedMesh(towerGeo, this.towerMat, this.towerCount);
    for (let i = 0; i < this.towerCount; i++) {
      const spreadX = (i - this.towerCount / 2) * 6.4 + ((i % 3) - 1) * 1.4;
      const distFromCenter = Math.abs(spreadX);
      const height =
        distFromCenter < 10
          ? 8 + (i % 4) * 3.5
          : 15 + ((i * 17) % 32);
      const width = 3.8 + (i % 3) * 1.5;
      const depth = 4.0 + (i % 2) * 2.0;

      _dummy.position.set(spreadX, height * 0.5 - 1.0, -190 - (i % 4) * 4);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(width, height, depth);
      _dummy.updateMatrix();
      this.skylineInst.setMatrixAt(i, _dummy.matrix);
    }
    this.skylineInst.instanceMatrix.needsUpdate = true;
    this.skylineInst.computeBoundingSphere();
    this._colorizeSkyline(ATMOSPHERE_PRESETS[0]);
    this.group.add(this.skylineInst);

    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x9d1768,
      transparent: true,
      opacity: 0.48,
      fog: false,
    });
    const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(360, 52), this.glowMat);
    glowPlane.position.set(0, 18, -205);
    this.group.add(glowPlane);
  }

  _colorizeSkyline(preset) {
    if (!this.skylineInst) return;
    const palette = preset.towerPalette || [0x22e4ff, 0xff2eb6, 0xa3ff2e, 0xffe224];
    for (let i = 0; i < this.towerCount; i++) {
      _color.setHex(palette[i % palette.length]);
      this.skylineInst.setColorAt(i, _color);
    }
    if (this.skylineInst.instanceColor) {
      this.skylineInst.instanceColor.needsUpdate = true;
    }
    if (this.towerMat) {
      this.towerMat.emissive.setHex(preset.isDaylight ? 0x1e293b : 0x3b1254);
      this.towerMat.emissiveIntensity = preset.isDaylight ? 0.08 : 0.48;
    }
  }

  _buildSpeedStreaks() {
    this.streakCount = 40;
    this.streakItems = [];
    const streakGeo = new THREE.BoxGeometry(0.05, 0.05, 6.2);
    this.streakMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.speedStreaksInst = new THREE.InstancedMesh(streakGeo, this.streakMat, this.streakCount);
    this.speedStreaksInst.frustumCulled = false;
    this.speedStreaksInst.visible = false;

    const chromaColors = [0xff8c1a, 0xffe224, 0xa3ff2e, 0x22e4ff, 0x9d4edd, 0xff2eb6];
    for (let i = 0; i < this.streakCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (6.0 + (i % 5) * 0.95);
      const y = 0.75 + (i % 6) * 0.65;
      const baseZ = (i / this.streakCount) * 90;
      this.streakItems.push({ x, y, baseZ, lenScale: 0.75 + (i % 4) * 0.32 });
      _color.setHex(chromaColors[i % chromaColors.length]);
      this.speedStreaksInst.setColorAt(i, _color);
    }
    if (this.speedStreaksInst.instanceColor) {
      this.speedStreaksInst.instanceColor.needsUpdate = true;
    }
    this.group.add(this.speedStreaksInst);
  }

  setAtmosphere(themeId) {
    const preset =
      ATMOSPHERE_PRESETS.find((t) => t.id === themeId) || ATMOSPHERE_PRESETS[0];
    this.atmosphere = preset.id;
    this.terrainMat?.color.setHex(preset.terrainHex);
    this.roadMat?.color.setHex(preset.roadTintHex || 0xffffff);
    this.barrierMat?.color.setHex(preset.barrierHex);
    if (this.railMat) {
      this.railMat.color.setHex(preset.railHex);
      this.railMat.emissive.setHex(preset.railGlowHex);
      this.railMat.emissiveIntensity = preset.railGlowIntensity;
    }
    if (this.dashMat) {
      this.dashMat.color.setHex(preset.isDaylight ? 0xffffff : 0xffe224);
      this.dashMat.emissive.setHex(preset.dashEmissiveHex);
      this.dashMat.emissiveIntensity = preset.isDaylight ? 0.1 : 0.35;
    }
    if (this.glowMat) {
      this.glowMat.color.setHex(preset.glowHex);
      this.glowMat.opacity = preset.isDaylight ? 0.25 : 0.48;
    }
    this.bulbMat?.color.setHex(preset.bulbHex);
    this.studMat?.color.setHex(preset.studHex);

    this._colorizeReflectors(preset.reflectorPalette);
    this._colorizeScenery(preset);
    this._colorizeSkyline(preset);
    return preset;
  }

  setQuality(quality) {
    this.quality = quality;
    const showExtraScenery = quality !== 'low';
    this.upperCrownInst.visible = showExtraScenery;
    this.rockInst.visible = showExtraScenery;
    this.studMesh.visible = showExtraScenery;
  }

  _wrapZ(baseZ, scroll) {
    const wrapped = (baseZ + scroll) % this.roadLength;
    return this.zMin + (wrapped < 0 ? wrapped + this.roadLength : wrapped);
  }

  _updateLaneMarkings(scroll) {
    let idx = 0;
    for (let c = 0; c < this.dividerX.length; c++) {
      const lx = this.dividerX[c];
      for (let r = 0; r < this.dashRows; r++) {
        const z = this._wrapZ(r * this.dashSpacing, scroll);
        _dummy.position.set(lx, 0.015, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.dashMesh.setMatrixAt(idx, _dummy.matrix);

        const studZ = this._wrapZ(r * this.dashSpacing + this.dashSpacing * 0.5, scroll);
        _dummy.position.set(lx, 0.025, studZ);
        _dummy.updateMatrix();
        this.studMesh.setMatrixAt(idx, _dummy.matrix);
        idx++;
      }
    }
    this.dashMesh.instanceMatrix.needsUpdate = true;
    this.studMesh.instanceMatrix.needsUpdate = true;
  }

  _updateReflectors(scroll) {
    let idx = 0;
    for (let r = 0; r < this.reflectorRows; r++) {
      const z = this._wrapZ(r * this.reflectorSpacing, scroll);
      for (const rx of [-7.44, 7.44]) {
        _dummy.position.set(rx, 0.62, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.reflectorMesh.setMatrixAt(idx++, _dummy.matrix);
      }
    }
    this.reflectorMesh.instanceMatrix.needsUpdate = true;
  }

  _updateStreetlights(scroll) {
    let idx = 0;
    for (let r = 0; r < this.lightRows; r++) {
      const z = this._wrapZ(r * this.lightSpacing, scroll);
      for (const side of [-1, 1]) {
        const poleX = side * 8.55;
        _dummy.position.set(poleX, 3.4, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.poleInst.setMatrixAt(idx, _dummy.matrix);

        _dummy.position.set(poleX - side * 1.05, 6.75, z);
        _dummy.updateMatrix();
        this.armInst.setMatrixAt(idx, _dummy.matrix);

        _dummy.position.set(poleX - side * 1.95, 6.68, z);
        _dummy.updateMatrix();
        this.bulbInst.setMatrixAt(idx, _dummy.matrix);

        idx++;
      }
    }
    this.poleInst.instanceMatrix.needsUpdate = true;
    this.armInst.instanceMatrix.needsUpdate = true;
    this.bulbInst.instanceMatrix.needsUpdate = true;
  }

  _updateScenery(scroll) {
    for (let i = 0; i < this.sceneryItems.length; i++) {
      const item = this.sceneryItems[i];
      const z = this._wrapZ(item.baseZ, scroll);
      const s = item.scale;

      _dummy.position.set(item.x, 0.85 * s, z);
      _dummy.rotation.set(0, item.rotY, 0);
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      this.trunkInst.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(item.x, 2.75 * s, z);
      _dummy.updateMatrix();
      this.lowerCrownInst.setMatrixAt(i, _dummy.matrix);

      if (this.upperCrownInst.visible) {
        _dummy.position.set(item.x, 4.35 * s, z);
        _dummy.updateMatrix();
        this.upperCrownInst.setMatrixAt(i, _dummy.matrix);
      }
    }
    this.trunkInst.instanceMatrix.needsUpdate = true;
    this.lowerCrownInst.instanceMatrix.needsUpdate = true;
    if (this.upperCrownInst.visible) {
      this.upperCrownInst.instanceMatrix.needsUpdate = true;
    }

    if (this.rockInst.visible) {
      for (let r = 0; r < this.rockItems.length; r++) {
        const rk = this.rockItems[r];
        const z = this._wrapZ(rk.baseZ, scroll);
        _dummy.position.set(rk.x, rk.sy * 0.4, z);
        _dummy.rotation.set(0.2, rk.rotY, 0.1);
        _dummy.scale.set(rk.sx, rk.sy, rk.sz);
        _dummy.updateMatrix();
        this.rockInst.setMatrixAt(r, _dummy.matrix);
      }
      this.rockInst.instanceMatrix.needsUpdate = true;
    }
  }

  _updateSpeedStreaks(scroll, speedMps, isBoosting) {
    if (!this.speedStreaksInst || this.quality === 'low') {
      if (this.speedStreaksInst) this.speedStreaksInst.visible = false;
      return;
    }
    const speedRatio = THREE.MathUtils.clamp((speedMps - 38) / 28, 0, 1);
    const targetOpacity = isBoosting ? 0.72 : speedRatio * 0.32;
    if (targetOpacity < 0.02) {
      this.speedStreaksInst.visible = false;
      return;
    }

    this.speedStreaksInst.visible = true;
    this.streakMat.opacity = targetOpacity;

    const streakSpan = 90;
    const fastScroll = (scroll * 2.3) % streakSpan;
    const stretch = isBoosting ? 2.1 : 1.0 + speedRatio * 0.6;

    for (let i = 0; i < this.streakItems.length; i++) {
      const st = this.streakItems[i];
      const wrapped = (st.baseZ + fastScroll) % streakSpan;
      const z = -72 + (wrapped < 0 ? wrapped + streakSpan : wrapped);
      _dummy.position.set(st.x, st.y, z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, st.lenScale * stretch);
      _dummy.updateMatrix();
      this.speedStreaksInst.setMatrixAt(i, _dummy.matrix);
    }
    this.speedStreaksInst.instanceMatrix.needsUpdate = true;
  }

  update(dt, speedMps = 0, isBoosting = false) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt));
    const deltaDist = speedMps * safeDt;
    this.scrollOffset = (this.scrollOffset + deltaDist) % this.roadLength;

    if (this.asphaltTex) {
      this.asphaltTex.offset.y -= deltaDist / (this.roadLength / 14);
    }

    this._updateLaneMarkings(this.scrollOffset);
    this._updateReflectors(this.scrollOffset);
    this._updateStreetlights(this.scrollOffset);
    this._updateScenery(this.scrollOffset);
    this._updateSpeedStreaks(this.scrollOffset, speedMps, isBoosting);
  }
}
