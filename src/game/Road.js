/**
 * Road.js
 *
 * Endless 4-lane 3D highway environment:
 * - High-anisotropy procedural asphalt surface with tire-wear shading & white edge lines
 * - Instanced dashed lane markings & reflective road studs
 * - Concrete Jersey barriers with alternating cyan/amber reflector chevrons
 * - Cantilevered highway streetlights with luminaire glow heads
 * - Composite multi-part roadside pine groves & boulders (InstancedMesh)
 * - Distant illuminated skyline silhouette & natural horizon terrain
 */

import * as THREE from 'three';

export const LANE_CENTERS = [-5.1, -1.7, 1.7, 5.1];

export const ATMOSPHERE_PRESETS = [
  {
    id: 'midnight',
    name: 'Midnight Express',
    skyHex: 0x060b14,
    hemiSkyHex: 0x38bdf8,
    hemiGroundHex: 0x0b101d,
    keyLightHex: 0xfff3db,
    rimLightHex: 0x06b6d4,
    terrainHex: 0x070c14,
    glowHex: 0x0b2538,
    bulbHex: 0xfde68a,
    studHex: 0x22d3ee,
  },
  {
    id: 'sunset',
    name: 'Golden Sunset',
    skyHex: 0x1c0f1b,
    hemiSkyHex: 0xfb923c,
    hemiGroundHex: 0x180d14,
    keyLightHex: 0xffedd5,
    rimLightHex: 0xf43f5e,
    terrainHex: 0x160c14,
    glowHex: 0x7c2d12,
    bulbHex: 0xfef08a,
    studHex: 0xf59e0b,
  },
  {
    id: 'cyber_dusk',
    name: 'Cyber Horizon',
    skyHex: 0x09061a,
    hemiSkyHex: 0xc084fc,
    hemiGroundHex: 0x090718,
    keyLightHex: 0xe0e7ff,
    rimLightHex: 0xe879f9,
    terrainHex: 0x090719,
    glowHex: 0x3b0764,
    bulbHex: 0x67e8f9,
    studHex: 0xe879f9,
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

  // Deep charcoal asphalt base
  ctx.fillStyle = '#141923';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle lane tire-wear shading across 4 lanes
  const laneCentersPx = [82, 194, 318, 430];
  for (const cx of laneCentersPx) {
    const grad = ctx.createLinearGradient(cx - 46, 0, cx + 46, 0);
    grad.addColorStop(0, 'rgba(20, 25, 35, 0)');
    grad.addColorStop(0.28, 'rgba(10, 13, 19, 0.42)');
    grad.addColorStop(0.5, 'rgba(24, 30, 42, 0.15)');
    grad.addColorStop(0.72, 'rgba(10, 13, 19, 0.42)');
    grad.addColorStop(1, 'rgba(20, 25, 35, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 46, 0, 92, 512);
  }

  // Fine mineral aggregate speckle
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const lum = 18 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${lum}, ${lum + 4}, ${lum + 10})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Crisp continuous outer shoulder lines (amber left, crisp white right/both)
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(22, 0, 7, 512);
  ctx.fillRect(483, 0, 7, 512);

  // Subtle cyan shoulder rumble accent outside main fog line
  ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
  ctx.fillRect(12, 0, 4, 512);
  ctx.fillRect(496, 0, 4, 512);

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

  ctx.fillStyle = '#080e1a';
  ctx.fillRect(0, 0, 128, 256);

  for (let row = 6; row < 246; row += 10) {
    for (let col = 8; col < 120; col += 12) {
      const r = Math.random();
      if (r < 0.36) {
        ctx.fillStyle = r < 0.08 ? '#f59e0b' : r < 0.22 ? '#22d3ee' : '#94a3b8';
        ctx.fillRect(col, row, 6, 4);
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
  }

  _buildTerrainAndRoad() {
    // Extended outdoor terrain ground so scene never looks boxed-in
    const terrainGeo = new THREE.PlaneGeometry(240, this.roadLength);
    terrainGeo.rotateX(-Math.PI / 2);
    this.terrainMat = new THREE.MeshStandardMaterial({
      color: 0x070c14,
      roughness: 0.96,
      metalness: 0.04,
    });
    const terrain = new THREE.Mesh(terrainGeo, this.terrainMat);
    terrain.position.set(0, -0.04, -80);
    terrain.receiveShadow = !this.isSoftwareGl;
    this.group.add(terrain);

    // Main 4-lane highway + paved shoulders (15.2m wide)
    this.asphaltTex = createAsphaltTexture(this.maxAnisotropy);
    const roadGeo = new THREE.PlaneGeometry(15.2, this.roadLength);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.asphaltTex,
      color: this.asphaltTex ? 0xffffff : 0x161c28,
      roughness: 0.68,
      metalness: 0.14,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, 0, -80);
    roadMesh.receiveShadow = !this.isSoftwareGl;
    this.group.add(roadMesh);
  }

  _buildLaneMarkings() {
    // 3 interior lane dividers at x = -3.4, 0, +3.4
    this.dividerX = [-3.4, 0, 3.4];
    this.dashSpacing = 9.0;
    this.dashRows = Math.ceil(this.roadLength / this.dashSpacing);
    const totalDashes = this.dividerX.length * this.dashRows;

    const dashGeo = new THREE.PlaneGeometry(0.16, 3.4);
    dashGeo.rotateX(-Math.PI / 2);
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.18,
      roughness: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, totalDashes);
    this.dashMesh.frustumCulled = false;

    // Reflective cat's-eye studs between dashes
    const studGeo = new THREE.BoxGeometry(0.14, 0.04, 0.18);
    this.studMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    this.studMesh = new THREE.InstancedMesh(studGeo, this.studMat, totalDashes);
    this.studMesh.frustumCulled = false;

    this._updateLaneMarkings(0);
    this.group.add(this.dashMesh);
    this.group.add(this.studMesh);
  }

  _buildBarriers() {
    // Continuous concrete Jersey barriers flanking both sides of the highway
    const barrierGeo = new THREE.BoxGeometry(0.55, 0.82, this.roadLength);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x1e2636,
      roughness: 0.78,
      metalness: 0.18,
    });

    for (const bx of [-7.75, 7.75]) {
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(bx, 0.41, -80);
      barrier.receiveShadow = !this.isSoftwareGl;
      this.group.add(barrier);

      // Top metallic guardrail rail
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.09, this.roadLength),
        new THREE.MeshStandardMaterial({
          color: 0x475569,
          metalness: 0.72,
          roughness: 0.3,
        }),
      );
      rail.position.set(bx, 0.87, -80);
      this.group.add(rail);
    }

    // Scrolling reflector markers mounted along barriers so forward speed reads crystal-clearly
    this.reflectorSpacing = 8.0;
    this.reflectorRows = Math.ceil(this.roadLength / this.reflectorSpacing);
    const refGeo = new THREE.BoxGeometry(0.08, 0.18, 0.42);
    const refMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.reflectorMesh = new THREE.InstancedMesh(refGeo, refMat, this.reflectorRows * 2);
    this.reflectorMesh.frustumCulled = false;

    for (let i = 0; i < this.reflectorRows * 2; i++) {
      const isAmber = Math.floor(i / 2) % 2 === 0;
      _color.setHex(isAmber ? 0xf59e0b : 0x22d3ee);
      this.reflectorMesh.setColorAt(i, _color);
    }
    this.reflectorMesh.instanceColor.needsUpdate = true;
    this._updateReflectors(0);
    this.group.add(this.reflectorMesh);
  }

  _buildStreetlights() {
    this.lightSpacing = 28.0;
    this.lightRows = Math.ceil(this.roadLength / this.lightSpacing);
    const count = this.lightRows * 2;

    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6.8, 8);
    const armGeo = new THREE.BoxGeometry(2.3, 0.1, 0.12);
    const bulbGeo = new THREE.BoxGeometry(0.65, 0.08, 0.28);

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x293548,
      metalness: 0.75,
      roughness: 0.32,
    });
    this.bulbMat = new THREE.MeshBasicMaterial({
      color: 0xfde68a,
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
    const lowerCrownGeo = new THREE.ConeGeometry(1.45, 3.6, 7);
    const upperCrownGeo = new THREE.ConeGeometry(1.05, 2.8, 7);
    const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x2b1f18,
      roughness: 0.9,
      metalness: 0.05,
    });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.06,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.88,
      metalness: 0.12,
    });

    this.trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, this.sceneryCount);
    this.lowerCrownInst = new THREE.InstancedMesh(lowerCrownGeo, foliageMat, this.sceneryCount);
    this.upperCrownInst = new THREE.InstancedMesh(upperCrownGeo, foliageMat, this.sceneryCount);
    this.rockInst = new THREE.InstancedMesh(rockGeo, rockMat, 28);

    this.trunkInst.frustumCulled = false;
    this.lowerCrownInst.frustumCulled = false;
    this.upperCrownInst.frustumCulled = false;
    this.rockInst.frustumCulled = false;

    // Deterministic seeded-like scatter on left & right shoulders beyond barriers
    for (let i = 0; i < this.sceneryCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (10.5 + ((i * 7.3) % 28));
      const baseZ = (i / this.sceneryCount) * this.roadLength;
      const scale = 0.85 + ((i * 13) % 35) / 100;
      this.sceneryItems.push({ x, baseZ, scale, rotY: i * 1.1 });

      // Subtle per-instance nocturnal pine tint variation
      const hue = 0.45 + ((i % 5) - 2) * 0.015;
      const light = 0.14 + (i % 4) * 0.025;
      _color.setHSL(hue, 0.42, light);
      this.lowerCrownInst.setColorAt(i, _color);
      _color.setHSL(hue, 0.46, light + 0.03);
      this.upperCrownInst.setColorAt(i, _color);
    }
    this.lowerCrownInst.instanceColor.needsUpdate = true;
    this.upperCrownInst.instanceColor.needsUpdate = true;

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

    this._updateScenery(0);
    this.group.add(this.trunkInst, this.lowerCrownInst, this.upperCrownInst, this.rockInst);
  }

  _buildDistantHorizon() {
    // Distant metropolitan skyline + mountain ridge anchored at the horizon
    const winTex = createSkylineWindowTexture();
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    const towerMat = new THREE.MeshStandardMaterial({
      map: winTex,
      color: 0xcbd5e1,
      emissive: 0x0e2a38,
      emissiveIntensity: 0.55,
      roughness: 0.5,
      metalness: 0.4,
    });

    const towerCount = 34;
    const skylineInst = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
    for (let i = 0; i < towerCount; i++) {
      const spreadX = (i - towerCount / 2) * 6.8 + ((i % 3) - 1) * 1.4;
      // Leave a subtle notch right over the highway vanishing point for dramatic composition
      const distFromCenter = Math.abs(spreadX);
      const height =
        distFromCenter < 10
          ? 8 + (i % 4) * 3.5
          : 14 + ((i * 17) % 28);
      const width = 3.8 + (i % 3) * 1.4;
      const depth = 4.0 + (i % 2) * 2.0;

      _dummy.position.set(spreadX, height * 0.5 - 1.0, -192 - (i % 4) * 4);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(width, height, depth);
      _dummy.updateMatrix();
      skylineInst.setMatrixAt(i, _dummy.matrix);
    }
    skylineInst.instanceMatrix.needsUpdate = true;
    skylineInst.computeBoundingSphere();
    this.group.add(skylineInst);

    // Subtle twilight horizon glow band behind skyline
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x0b2538,
      transparent: true,
      opacity: 0.55,
      fog: false,
    });
    const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(340, 46), this.glowMat);
    glowPlane.position.set(0, 16, -205);
    this.group.add(glowPlane);
  }

  _buildSpeedStreaks() {
    this.streakCount = 36;
    this.streakItems = [];
    const streakGeo = new THREE.BoxGeometry(0.035, 0.035, 5.8);
    this.streakMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.speedStreaksInst = new THREE.InstancedMesh(streakGeo, this.streakMat, this.streakCount);
    this.speedStreaksInst.frustumCulled = false;
    this.speedStreaksInst.visible = false;

    for (let i = 0; i < this.streakCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (6.2 + (i % 5) * 0.95);
      const y = 0.8 + (i % 6) * 0.65;
      const baseZ = (i / this.streakCount) * 90;
      this.streakItems.push({ x, y, baseZ, lenScale: 0.75 + (i % 4) * 0.3 });
    }
    this.group.add(this.speedStreaksInst);
  }

  setAtmosphere(themeId) {
    const preset =
      ATMOSPHERE_PRESETS.find((t) => t.id === themeId) || ATMOSPHERE_PRESETS[0];
    this.atmosphere = preset.id;
    this.terrainMat?.color.setHex(preset.terrainHex);
    this.glowMat?.color.setHex(preset.glowHex);
    this.bulbMat?.color.setHex(preset.bulbHex);
    this.studMat?.color.setHex(preset.studHex);
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
    const speedRatio = THREE.MathUtils.clamp((speedMps - 44) / 28, 0, 1);
    const targetOpacity = isBoosting ? 0.52 : speedRatio * 0.22;
    if (targetOpacity < 0.02) {
      this.speedStreaksInst.visible = false;
      return;
    }

    this.speedStreaksInst.visible = true;
    this.streakMat.opacity = targetOpacity;
    this.streakMat.color.setHex(isBoosting ? 0xe879f9 : 0x67e8f9);

    const streakSpan = 90;
    const fastScroll = (scroll * 2.2) % streakSpan;
    const stretch = isBoosting ? 1.85 : 1.0 + speedRatio * 0.5;

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
      // Repeat is 14 tiles over 230m -> 1 tile = 16.428m
      this.asphaltTex.offset.y -= deltaDist / (this.roadLength / 14);
    }

    this._updateLaneMarkings(this.scrollOffset);
    this._updateReflectors(this.scrollOffset);
    this._updateStreetlights(this.scrollOffset);
    this._updateScenery(this.scrollOffset);
    this._updateSpeedStreaks(this.scrollOffset, speedMps, isBoosting);
  }
}
