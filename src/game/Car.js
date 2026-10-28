/**
 * Car.js
 *
 * Modular multi-model 3D Garage & Player Vehicle system built procedurally with Three.js:
 * - 4 distinct selectable 3D vehicle models:
 *   1. Apex GT-R (Hyper Coupe)
 *   2. Vortex F1-X (Formula Open-Wheel Prototype)
 *   3. Titan V8 (Muscle Interceptor)
 *   4. Nomad Cyber-X (Armored Rally SUV)
 * - 8 selectable custom paint colours & material finishes (Metallic, Gloss, Pearl, Satin, Matte, Ceramic, Chrome)
 * - Live editable 3D floating driver nameplate sprite above the roof
 * - Articulated steering knuckles, spinning wheels, dynamic brake bar, Nitro afterburner flames & collision sparks
 */

import * as THREE from 'three';
import {
  createNameplateSprite,
  updateNameplateSprite,
  sanitizeDriverName,
  DEFAULT_DRIVER_NAME,
} from './Nameplate.js';

export const ROAD_HALF_WIDTH = 7.0;
export const CAR_HALF_WIDTH = 0.96;
export const CAR_HALF_LENGTH = 2.15;
export const PLAYER_MAX_X = ROAD_HALF_WIDTH - CAR_HALF_WIDTH - 0.35; // 5.69m safe inside barriers

export const CAR_MODEL_PRESETS = [
  {
    id: 'apex_gtr',
    name: 'Apex GT-R',
    category: 'Hyper Coupe',
    speedRating: 95,
    handlingRating: 93,
    nitroRating: 92,
    topSpeedFactor: 1.0,
    handlingFactor: 1.0,
    nitroPower: 1.0,
    nameplateY: 1.72,
  },
  {
    id: 'vortex_f1',
    name: 'Vortex F1-X',
    category: 'Formula Aero',
    speedRating: 98,
    handlingRating: 99,
    nitroRating: 95,
    topSpeedFactor: 1.05,
    handlingFactor: 1.14,
    nitroPower: 1.05,
    nameplateY: 1.58,
  },
  {
    id: 'titan_v8',
    name: 'Titan V8',
    category: 'Street Muscle',
    speedRating: 96,
    handlingRating: 88,
    nitroRating: 97,
    topSpeedFactor: 1.03,
    handlingFactor: 0.95,
    nitroPower: 1.1,
    nameplateY: 1.76,
  },
  {
    id: 'nomad_x',
    name: 'Nomad Cyber-X',
    category: 'Armored Rally',
    speedRating: 91,
    handlingRating: 90,
    nitroRating: 94,
    topSpeedFactor: 0.98,
    handlingFactor: 0.98,
    nitroPower: 1.06,
    nameplateY: 2.04,
  },
];

export const CAR_PAINT_PRESETS = [
  {
    id: 'cyan_metallic',
    name: 'Cyber Cyan',
    finishType: 'Liquid Metallic',
    swatch: '#22e4ff',
    bodyColor: 0x00b4d8,
    metalness: 0.78,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    trimColor: 0xa3ff2e,
    trimEmissive: 0x22e4ff,
    caliperColor: 0xffe224,
    rimColor: 0xe0f2fe,
    exhaustColor: 0x22e4ff,
    underglowColor: 0x22e4ff,
  },
  {
    id: 'rosso_gloss',
    name: 'Crimson Rosso',
    finishType: 'Racing Gloss',
    swatch: '#ff2442',
    bodyColor: 0xe11d48,
    metalness: 0.48,
    roughness: 0.13,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    trimColor: 0xffe224,
    trimEmissive: 0xff8c1a,
    caliperColor: 0xffe224,
    rimColor: 0xf8fafc,
    exhaustColor: 0xff8c1a,
    underglowColor: 0xff2eb6,
  },
  {
    id: 'solar_pearl',
    name: 'Solar Gold',
    finishType: 'Pearlescent',
    swatch: '#ff8c1a',
    bodyColor: 0xff8c1a,
    metalness: 0.65,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.07,
    trimColor: 0xffe224,
    trimEmissive: 0xff8c1a,
    caliperColor: 0xff2eb6,
    rimColor: 0x1e1b4b,
    exhaustColor: 0xffe224,
    underglowColor: 0xffe224,
  },
  {
    id: 'emerald_satin',
    name: 'Neon Lime',
    finishType: 'Satin Metallic',
    swatch: '#a3ff2e',
    bodyColor: 0x22c55e,
    metalness: 0.68,
    roughness: 0.24,
    clearcoat: 0.75,
    clearcoatRoughness: 0.16,
    trimColor: 0xa3ff2e,
    trimEmissive: 0x4ade80,
    caliperColor: 0xffe224,
    rimColor: 0xecfccb,
    exhaustColor: 0xa3ff2e,
    underglowColor: 0xa3ff2e,
  },
  {
    id: 'stealth_matte',
    name: 'Matte Black',
    finishType: 'Matte Carbon',
    swatch: '#475569',
    bodyColor: 0x181828,
    metalness: 0.34,
    roughness: 0.54,
    clearcoat: 0.2,
    clearcoatRoughness: 0.42,
    trimColor: 0x22e4ff,
    trimEmissive: 0xff2eb6,
    caliperColor: 0x22e4ff,
    rimColor: 0x475569,
    exhaustColor: 0xff2eb6,
    underglowColor: 0x9d4edd,
  },
  {
    id: 'pearl_ceramic',
    name: 'Glacier White',
    finishType: 'Ceramic Gloss',
    swatch: '#f8fafc',
    bodyColor: 0xf1f5f9,
    metalness: 0.3,
    roughness: 0.11,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    trimColor: 0xff2eb6,
    trimEmissive: 0xff2eb6,
    caliperColor: 0xff2eb6,
    rimColor: 0x1e1b4b,
    exhaustColor: 0x22e4ff,
    underglowColor: 0x22e4ff,
  },
  {
    id: 'ultraviolet_chrome',
    name: 'Ultraviolet',
    finishType: 'Mirror Chrome',
    swatch: '#9d4edd',
    bodyColor: 0x7c3aed,
    metalness: 0.88,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    trimColor: 0x22e4ff,
    trimEmissive: 0xc084fc,
    caliperColor: 0xa3ff2e,
    rimColor: 0xf3e8ff,
    exhaustColor: 0xff2eb6,
    underglowColor: 0xc084fc,
  },
  {
    id: 'rosegold_pearl',
    name: 'Candy Pink',
    finishType: 'Satin Pearl',
    swatch: '#ff2eb6',
    bodyColor: 0xec4899,
    metalness: 0.68,
    roughness: 0.18,
    clearcoat: 0.96,
    clearcoatRoughness: 0.07,
    trimColor: 0xffe224,
    trimEmissive: 0xff2eb6,
    caliperColor: 0x22e4ff,
    rimColor: 0xfff1f2,
    exhaustColor: 0xff2eb6,
    underglowColor: 0xff2eb6,
  },
];

const _sparkDummy = new THREE.Object3D();

function createContactShadowTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(64, 128, 12, 64, 128, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.save();
  ctx.scale(1, 1.9);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 67, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHeadlightPoolTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(64, 256, 64, 0);
  grad.addColorStop(0, 'rgba(165, 243, 252, 0.36)');
  grad.addColorStop(0.45, 'rgba(34, 211, 238, 0.14)');
  grad.addColorStop(1, 'rgba(6, 182, 212, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(42, 256);
  ctx.lineTo(86, 256);
  ctx.lineTo(124, 0);
  ctx.lineTo(4, 0);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Car {
  constructor(options = {}) {
    this.isSoftwareGl = Boolean(options.isSoftwareGl);

    this.root = new THREE.Group();
    this.chassisGroup = new THREE.Group();
    this.wheelsContainer = new THREE.Group();
    this.root.add(this.chassisGroup);
    this.root.add(this.wheelsContainer);

    // Kinematic state
    this.x = 0;
    this.z = 0;
    this.lateralVelocity = 0;
    this.steerInput = 0;
    this.wheelSpinAngle = 0;
    this.suspensionPhase = 0;
    this.invulnerableTimer = 0;
    this.isCrashed = false;
    this.crashSpinRate = 0;
    this.crashTimer = 0;

    this.frontWheelPivots = [];
    this.wheelSpinGroups = [];
    this.nitroPlumes = [];
    this.sparks = [];

    this.modelPresetId = options.modelPresetId || CAR_MODEL_PRESETS[0].id;
    this.paintPresetId = options.paintPresetId || CAR_PAINT_PRESETS[0].id;
    this.driverName = sanitizeDriverName(options.driverName || DEFAULT_DRIVER_NAME);

    this._buildMaterials();
    this._buildGroundEffects();
    this._buildSparkSystem();

    // Floating 3D Driver Nameplate right above the car roof
    this.nameplate = createNameplateSprite({
      name: this.driverName,
      badge: 'YOU',
      accentColor: '#22d3ee',
      isPlayer: true,
    });
    this.root.add(this.nameplate);

    this.setModelPreset(this.modelPresetId);
    this.setPaintPreset(this.paintPresetId);
  }

  getActiveModelPreset() {
    return (
      CAR_MODEL_PRESETS.find((m) => m.id === this.modelPresetId) || CAR_MODEL_PRESETS[0]
    );
  }

  getActivePaintPreset() {
    return (
      CAR_PAINT_PRESETS.find((p) => p.id === this.paintPresetId) || CAR_PAINT_PRESETS[0]
    );
  }

  setDriverName(rawName) {
    this.driverName = sanitizeDriverName(rawName, DEFAULT_DRIVER_NAME);
    const paint = this.getActivePaintPreset();
    updateNameplateSprite(this.nameplate, {
      name: this.driverName,
      badge: 'YOU',
      accentColor: paint.swatch,
      isPlayer: true,
    });
    return this.driverName;
  }

  setNameplateVisible(visible) {
    if (this.nameplate) {
      this.nameplate.visible = Boolean(visible);
    }
  }

  setPaintPreset(presetId) {
    const preset =
      CAR_PAINT_PRESETS.find((p) => p.id === presetId) || CAR_PAINT_PRESETS[0];
    this.paintPresetId = preset.id;

    if (this.bodyPaintMat) {
      this.bodyPaintMat.color.setHex(preset.bodyColor);
      this.bodyPaintMat.metalness = preset.metalness;
      this.bodyPaintMat.roughness = preset.roughness;
      this.bodyPaintMat.clearcoat = preset.clearcoat;
      this.bodyPaintMat.clearcoatRoughness = preset.clearcoatRoughness;
      this.bodyPaintMat.needsUpdate = true;
    }
    if (this.accentTrimMat) {
      this.accentTrimMat.color.setHex(preset.trimColor);
      this.accentTrimMat.emissive.setHex(preset.trimEmissive);
    }
    if (this.caliperMat) {
      this.caliperMat.color.setHex(preset.caliperColor);
    }
    if (this.rimMat) {
      this.rimMat.color.setHex(preset.rimColor);
    }
    if (this.exhaustGlowMat) {
      this.exhaustGlowMat.color.setHex(preset.exhaustColor);
    }
    if (this.underglowMat) {
      this.underglowMat.color.setHex(preset.underglowColor || preset.trimColor);
    }
    if (this.underglowLight) {
      this.underglowLight.color.setHex(preset.underglowColor || preset.trimColor);
    }
    if (this.nameplate) {
      updateNameplateSprite(this.nameplate, {
        name: this.driverName,
        badge: 'YOU',
        accentColor: preset.swatch,
        isPlayer: true,
      });
    }
    return preset;
  }

  setModelPreset(modelId) {
    const model =
      CAR_MODEL_PRESETS.find((m) => m.id === modelId) || CAR_MODEL_PRESETS[0];
    this.modelPresetId = model.id;

    this._clearGroupGeometries(this.chassisGroup);
    this._clearGroupGeometries(this.wheelsContainer);
    this.frontWheelPivots = [];
    this.wheelSpinGroups = [];
    this.nitroPlumes = [];

    if (model.id === 'vortex_f1') {
      this._buildFormulaBody();
      this._buildWheels({
        radius: 0.36,
        width: 0.35,
        frontX: 0.95,
        rearX: 0.98,
        frontZ: -1.42,
        rearZ: 1.38,
        openWheel: true,
      });
    } else if (model.id === 'titan_v8') {
      this._buildMuscleBody();
      this._buildWheels({
        radius: 0.35,
        width: 0.3,
        frontX: 0.93,
        rearX: 0.96,
        frontZ: -1.34,
        rearZ: 1.34,
        openWheel: false,
      });
    } else if (model.id === 'nomad_x') {
      this._buildRallySuvBody();
      this._buildWheels({
        radius: 0.4,
        width: 0.32,
        frontX: 0.96,
        rearX: 0.96,
        frontZ: -1.32,
        rearZ: 1.32,
        openWheel: false,
      });
    } else {
      this._buildHyperCoupeBody();
      this._buildWheels({
        radius: 0.34,
        width: 0.28,
        frontX: 0.92,
        rearX: 0.94,
        frontZ: -1.32,
        rearZ: 1.32,
        openWheel: false,
      });
    }

    if (this.nameplate) {
      this.nameplate.position.set(0, model.nameplateY, 0.1);
    }

    return model;
  }

  _clearGroupGeometries(group) {
    const geometries = new Set();
    group.traverse((child) => {
      if (child.isMesh && child.geometry) {
        geometries.add(child.geometry);
      }
    });
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    geometries.forEach((geo) => geo.dispose());
  }

  _buildMaterials() {
    this.bodyPaintMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e2235,
      metalness: 0.82,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });

    this.accentTrimMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.55,
      metalness: 0.5,
      roughness: 0.25,
    });

    this.carbonMat = new THREE.MeshStandardMaterial({
      color: 0x11151c,
      metalness: 0.28,
      roughness: 0.72,
    });

    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x060b14,
      metalness: 0.15,
      roughness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
    });

    this.tireMat = new THREE.MeshStandardMaterial({
      color: 0x121417,
      metalness: 0.08,
      roughness: 0.86,
    });

    this.rimMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0.9,
      roughness: 0.2,
    });

    this.caliperMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.45,
      roughness: 0.35,
    });

    this.headlightMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x67e8f9,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });

    this.taillightMat = new THREE.MeshStandardMaterial({
      color: 0xff2a3a,
      emissive: 0xef4444,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    this.exhaustGlowMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.0,
    });

    this.nitroFlameMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  _addExhaustPair(positionsX, y, z) {
    const exhaustGeo = new THREE.CylinderGeometry(0.072, 0.082, 0.24, 14);
    exhaustGeo.rotateX(Math.PI / 2);
    const glowGeo = new THREE.CircleGeometry(0.06, 12);
    const plumeGeo = new THREE.ConeGeometry(0.085, 0.95, 12);
    plumeGeo.rotateX(Math.PI / 2);

    for (const sideX of positionsX) {
      const pipe = new THREE.Mesh(exhaustGeo, this.rimMat);
      pipe.position.set(sideX, y, z);
      this.chassisGroup.add(pipe);

      const flame = new THREE.Mesh(glowGeo, this.exhaustGlowMat);
      flame.position.set(sideX, y, z + 0.125);
      this.chassisGroup.add(flame);

      const nitroCone = new THREE.Mesh(plumeGeo, this.nitroFlameMat);
      nitroCone.position.set(sideX, y, z + 0.56);
      this.nitroPlumes.push(nitroCone);
      this.chassisGroup.add(nitroCone);
    }
  }

  /**
   * Model 1: Apex GT-R (Sleek Widebody Hyper Coupe)
   */
  _buildHyperCoupeBody() {
    const sideProfile = new THREE.Shape();
    sideProfile.moveTo(-2.12, 0.24);
    sideProfile.lineTo(-2.02, 0.52);
    sideProfile.lineTo(-1.15, 0.68);
    sideProfile.lineTo(1.25, 0.74);
    sideProfile.lineTo(2.08, 0.66);
    sideProfile.lineTo(2.12, 0.28);
    sideProfile.lineTo(-2.12, 0.24);

    const hullGeo = new THREE.ExtrudeGeometry(sideProfile, {
      depth: 1.72,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.07,
      bevelSegments: 3,
    });
    hullGeo.center();
    hullGeo.rotateY(Math.PI / 2);

    const hullMesh = new THREE.Mesh(hullGeo, this.bodyPaintMat);
    hullMesh.position.set(0, 0.49, 0);
    hullMesh.castShadow = !this.isSoftwareGl;
    hullMesh.receiveShadow = !this.isSoftwareGl;
    this.chassisGroup.add(hullMesh);

    const cabinProfile = new THREE.Shape();
    cabinProfile.moveTo(-0.95, 0);
    cabinProfile.lineTo(-0.32, 0.44);
    cabinProfile.lineTo(0.45, 0.45);
    cabinProfile.lineTo(1.28, 0.06);
    cabinProfile.lineTo(-0.95, 0);

    const cabinGeo = new THREE.ExtrudeGeometry(cabinProfile, {
      depth: 1.32,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    cabinGeo.center();
    cabinGeo.rotateY(Math.PI / 2);

    const cabinMesh = new THREE.Mesh(cabinGeo, this.glassMat);
    cabinMesh.position.set(0, 0.89, 0.14);
    cabinMesh.castShadow = !this.isSoftwareGl;
    this.chassisGroup.add(cabinMesh);

    const spineMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.04, 1.3),
      this.accentTrimMat,
    );
    spineMesh.position.set(0, 1.13, 0.22);
    this.chassisGroup.add(spineMesh);

    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(1.94, 0.07, 0.48),
      this.carbonMat,
    );
    splitter.position.set(0, 0.21, -1.96);
    this.chassisGroup.add(splitter);

    const skirts = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 0.08, 2.55),
      this.carbonMat,
    );
    skirts.position.set(0, 0.22, 0.05);
    this.chassisGroup.add(skirts);

    const sideStripes = new THREE.Mesh(
      new THREE.BoxGeometry(1.98, 0.025, 2.45),
      this.accentTrimMat,
    );
    sideStripes.position.set(0, 0.255, 0.05);
    this.chassisGroup.add(sideStripes);

    const diffuser = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.22, 0.34),
      this.carbonMat,
    );
    diffuser.position.set(0, 0.28, 2.04);
    this.chassisGroup.add(diffuser);

    this._addExhaustPair([-0.42, 0.42], 0.29, 2.16);

    const wingGroup = new THREE.Group();
    const pylonGeo = new THREE.BoxGeometry(0.05, 0.28, 0.26);
    for (const px of [-0.52, 0.52]) {
      const pylon = new THREE.Mesh(pylonGeo, this.carbonMat);
      pylon.position.set(px, 0.86, 1.88);
      pylon.rotation.x = 0.2;
      wingGroup.add(pylon);
    }
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 0.045, 0.32),
      this.bodyPaintMat,
    );
    blade.position.set(0, 1.0, 1.94);
    blade.rotation.x = 0.09;
    wingGroup.add(blade);

    const endplateGeo = new THREE.BoxGeometry(0.035, 0.16, 0.38);
    for (const ex of [-0.94, 0.94]) {
      const ep = new THREE.Mesh(endplateGeo, this.accentTrimMat);
      ep.position.set(ex, 1.0, 1.94);
      wingGroup.add(ep);
    }
    this.chassisGroup.add(wingGroup);

    const hlGeo = new THREE.BoxGeometry(0.38, 0.07, 0.12);
    for (const hx of [-0.64, 0.64]) {
      const hl = new THREE.Mesh(hlGeo, this.headlightMat);
      hl.position.set(hx, 0.48, -2.08);
      hl.rotation.y = hx < 0 ? 0.14 : -0.14;
      this.chassisGroup.add(hl);
    }

    const tailBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.68, 0.075, 0.08),
      this.taillightMat,
    );
    tailBar.position.set(0, 0.62, 2.13);
    this.chassisGroup.add(tailBar);

    for (const tx of [-0.66, 0.66]) {
      const pod = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.12, 0.09),
        this.taillightMat,
      );
      pod.position.set(tx, 0.58, 2.12);
      this.chassisGroup.add(pod);
    }

    const mirrorGeo = new THREE.BoxGeometry(0.22, 0.07, 0.12);
    for (const mx of [-0.96, 0.96]) {
      const mirror = new THREE.Mesh(mirrorGeo, this.bodyPaintMat);
      mirror.position.set(mx, 0.78, -0.45);
      this.chassisGroup.add(mirror);
    }
  }

  /**
   * Model 2: Vortex F1-X (Open-Wheel Formula / Track Hyper-Prototype)
   */
  _buildFormulaBody() {
    // Central tapered monocoque fuselage + needle nose
    const mono = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.38, 3.85),
      this.bodyPaintMat,
    );
    mono.position.set(0, 0.42, -0.1);
    mono.castShadow = !this.isSoftwareGl;
    this.chassisGroup.add(mono);

    const noseCone = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 1.15),
      this.bodyPaintMat,
    );
    noseCone.position.set(0, 0.31, -1.78);
    noseCone.rotation.x = 0.08;
    this.chassisGroup.add(noseCone);

    // Wide Multi-Element Front Aero Wing
    const frontWingMain = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 0.05, 0.42),
      this.carbonMat,
    );
    frontWingMain.position.set(0, 0.2, -2.14);
    this.chassisGroup.add(frontWingMain);

    const frontFlap = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.035, 0.22),
      this.accentTrimMat,
    );
    frontFlap.position.set(0, 0.25, -2.02);
    frontFlap.rotation.x = -0.14;
    this.chassisGroup.add(frontFlap);

    for (const fwx of [-0.98, 0.98]) {
      const fwEnd = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.18, 0.5),
        this.bodyPaintMat,
      );
      fwEnd.position.set(fwx, 0.27, -2.12);
      this.chassisGroup.add(fwEnd);
    }

    // Sculpted Sidepods + Carbon Floor Plank
    const floorPlank = new THREE.Mesh(
      new THREE.BoxGeometry(1.68, 0.05, 2.75),
      this.carbonMat,
    );
    floorPlank.position.set(0, 0.2, 0.12);
    this.chassisGroup.add(floorPlank);

    for (const spx of [-0.58, 0.58]) {
      const pod = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.36, 1.95),
        this.bodyPaintMat,
      );
      pod.position.set(spx, 0.42, 0.22);
      pod.castShadow = !this.isSoftwareGl;
      this.chassisGroup.add(pod);

      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.04, 1.88),
        this.accentTrimMat,
      );
      stripe.position.set(spx, 0.58, 0.22);
      this.chassisGroup.add(stripe);

      // Suspension wishbone arms connecting open wheels
      for (const wz of [-1.42, 1.38]) {
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.035, 0.08),
          this.carbonMat,
        );
        arm.position.set(spx * 1.05, 0.36, wz);
        this.chassisGroup.add(arm);
      }
    }

    // Airbox Shark-Fin + Cockpit Halo + Driver Helmet
    const airbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.42, 1.25),
      this.bodyPaintMat,
    );
    airbox.position.set(0, 0.78, 0.65);
    this.chassisGroup.add(airbox);

    const sharkFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.34, 1.15),
      this.accentTrimMat,
    );
    sharkFin.position.set(0, 0.94, 1.25);
    this.chassisGroup.add(sharkFin);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 14, 12),
      this.accentTrimMat,
    );
    helmet.position.set(0, 0.72, -0.05);
    this.chassisGroup.add(helmet);

    const haloArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.31, 0.032, 8, 18, Math.PI),
      this.carbonMat,
    );
    haloArch.rotation.x = Math.PI / 2 - 0.18;
    haloArch.rotation.z = Math.PI;
    haloArch.position.set(0, 0.78, -0.08);
    this.chassisGroup.add(haloArch);

    // Tall F1 Dual-Element Rear Wing + Rain FIA Strobe Light
    const rearWingMain = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.055, 0.36),
      this.bodyPaintMat,
    );
    rearWingMain.position.set(0, 1.04, 1.98);
    rearWingMain.rotation.x = 0.14;
    this.chassisGroup.add(rearWingMain);

    for (const rwx of [-0.82, 0.82]) {
      const rwEnd = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.44, 0.44),
        this.carbonMat,
      );
      rwEnd.position.set(rwx, 0.9, 1.98);
      this.chassisGroup.add(rwEnd);

      const rwLed = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.28, 0.06),
        this.taillightMat,
      );
      rwLed.position.set(rwx, 0.92, 2.2);
      this.chassisGroup.add(rwLed);
    }

    const fiaLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.08),
      this.taillightMat,
    );
    fiaLight.position.set(0, 0.38, 2.12);
    this.chassisGroup.add(fiaLight);

    for (const hx of [-0.42, 0.42]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.06, 0.1),
        this.headlightMat,
      );
      hl.position.set(hx, 0.34, -1.95);
      this.chassisGroup.add(hl);
    }

    this._addExhaustPair([-0.14, 0.14], 0.52, 2.02);
  }

  /**
   * Model 3: Titan V8 (Aggressive Street Muscle Interceptor)
   */
  _buildMuscleBody() {
    // Broad chiseled muscle lower body
    const lowerHull = new THREE.Mesh(
      new THREE.BoxGeometry(1.94, 0.54, 4.32),
      this.bodyPaintMat,
    );
    lowerHull.position.set(0, 0.52, 0);
    lowerHull.castShadow = !this.isSoftwareGl;
    lowerHull.receiveShadow = !this.isSoftwareGl;
    this.chassisGroup.add(lowerHull);

    // Muscular rear fender haunches
    for (const fx of [-0.96, 0.96]) {
      const haunch = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.42, 1.65),
        this.bodyPaintMat,
      );
      haunch.position.set(fx, 0.58, 1.12);
      this.chassisGroup.add(haunch);
    }

    // Twin racing hood & roof stripes
    for (const sx of [-0.22, 0.22]) {
      const hoodStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.02, 4.26),
        this.accentTrimMat,
      );
      hoodStripe.position.set(sx, 0.8, 0);
      this.chassisGroup.add(hoodStripe);
    }

    // Supercharger V8 Hood Blower Intake Scoop
    const blowerBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.16, 0.88),
      this.carbonMat,
    );
    blowerBase.position.set(0, 0.86, -1.05);
    this.chassisGroup.add(blowerBase);

    const blowerIntake = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.1, 0.24),
      this.rimMat,
    );
    blowerIntake.position.set(0, 0.92, -1.46);
    this.chassisGroup.add(blowerIntake);

    // Fastback Muscle Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 0.42, 1.98),
      this.glassMat,
    );
    cabin.position.set(0, 0.96, 0.28);
    this.chassisGroup.add(cabin);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.46, 0.06, 1.45),
      this.bodyPaintMat,
    );
    roof.position.set(0, 1.18, 0.2);
    this.chassisGroup.add(roof);

    // Aggressive Ducktail Spoiler
    const ducktail = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.18, 0.22),
      this.carbonMat,
    );
    ducktail.position.set(0, 0.86, 2.08);
    ducktail.rotation.x = -0.28;
    this.chassisGroup.add(ducktail);

    // Deep Muscle Front Chin & Grille + Quad Halo Headlights
    const chin = new THREE.Mesh(
      new THREE.BoxGeometry(1.98, 0.1, 0.36),
      this.carbonMat,
    );
    chin.position.set(0, 0.23, -2.08);
    this.chassisGroup.add(chin);

    for (const hx of [-0.72, -0.46, 0.46, 0.72]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.1),
        this.headlightMat,
      );
      hl.position.set(hx, 0.56, -2.15);
      this.chassisGroup.add(hl);
    }

    // Classic Triple-Bar Muscle Taillights
    for (const tx of [-0.74, -0.52, -0.3, 0.3, 0.52, 0.74]) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.2, 0.09),
        this.taillightMat,
      );
      bar.position.set(tx, 0.58, 2.15);
      this.chassisGroup.add(bar);
    }

    this._addExhaustPair([-0.62, -0.44, 0.44, 0.62], 0.28, 2.14);
  }

  /**
   * Model 4: Nomad Cyber-X (Armored Cyber-Rally Performance SUV)
   */
  _buildRallySuvBody() {
    // High-clearance faceted armored lower body
    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.98, 0.64, 4.24),
      this.bodyPaintMat,
    );
    lowerBody.position.set(0, 0.66, 0);
    lowerBody.castShadow = !this.isSoftwareGl;
    lowerBody.receiveShadow = !this.isSoftwareGl;
    this.chassisGroup.add(lowerBody);

    // Matte Carbon Fender Arches & Armored Rocker Panels
    const rockers = new THREE.Mesh(
      new THREE.BoxGeometry(2.04, 0.18, 3.65),
      this.carbonMat,
    );
    rockers.position.set(0, 0.38, 0);
    this.chassisGroup.add(rockers);

    // Angular Armored Cabin Canopy
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.68, 0.52, 2.38),
      this.glassMat,
    );
    cabin.position.set(0, 1.18, 0.18);
    this.chassisGroup.add(cabin);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.08, 2.18),
      this.bodyPaintMat,
    );
    roof.position.set(0, 1.46, 0.2);
    this.chassisGroup.add(roof);

    // Roof Expedition Rack + Quad Rally LED Light Bar
    const lightBarPod = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 0.1, 0.16),
      this.carbonMat,
    );
    lightBarPod.position.set(0, 1.55, -0.78);
    this.chassisGroup.add(lightBarPod);

    const roofLed = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.065, 0.08),
      this.headlightMat,
    );
    roofLed.position.set(0, 1.55, -0.85);
    this.chassisGroup.add(roofLed);

    for (const rx of [-0.74, 0.74]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.07, 1.95),
        this.accentTrimMat,
      );
      rail.position.set(rx, 1.53, 0.24);
      this.chassisGroup.add(rail);
    }

    // Front Bull-Bar + Full-Width Cyber LED Visor
    const bullBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.82, 0.32, 0.24),
      this.carbonMat,
    );
    bullBar.position.set(0, 0.48, -2.14);
    this.chassisGroup.add(bullBar);

    const frontVisor = new THREE.Mesh(
      new THREE.BoxGeometry(1.86, 0.09, 0.08),
      this.headlightMat,
    );
    frontVisor.position.set(0, 0.82, -2.12);
    this.chassisGroup.add(frontVisor);

    // Full-Width Cyber Rear Taillight Strip + Rear Skid Plate
    const rearStrip = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 0.11, 0.09),
      this.taillightMat,
    );
    rearStrip.position.set(0, 0.88, 2.12);
    this.chassisGroup.add(rearStrip);

    const skidPlate = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.24, 0.22),
      this.rimMat,
    );
    skidPlate.position.set(0, 0.38, 2.08);
    this.chassisGroup.add(skidPlate);

    this._addExhaustPair([-0.55, 0.55], 0.36, 2.14);
  }

  _buildWheels({
    radius = 0.34,
    width = 0.28,
    frontX = 0.92,
    rearX = 0.94,
    frontZ = -1.32,
    rearZ = 1.32,
  } = {}) {
    this.wheelRadius = radius;
    const wheelConfigs = [
      { x: -frontX, y: radius, z: frontZ, isFront: true, side: -1 },
      { x: frontX, y: radius, z: frontZ, isFront: true, side: 1 },
      { x: -rearX, y: radius + 0.01, z: rearZ, isFront: false, side: -1 },
      { x: rearX, y: radius + 0.01, z: rearZ, isFront: false, side: 1 },
    ];

    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 22);
    tireGeo.rotateZ(Math.PI / 2);

    const rimHubGeo = new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, width + 0.01, 16);
    rimHubGeo.rotateZ(Math.PI / 2);

    const spokeGeo = new THREE.BoxGeometry(width + 0.02, 0.045, radius * 1.2);
    const caliperGeo = new THREE.BoxGeometry(0.14, 0.16, 0.12);

    for (const cfg of wheelConfigs) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(cfg.x, cfg.y, cfg.z);

      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, this.tireMat);
      tire.castShadow = !this.isSoftwareGl;
      spinGroup.add(tire);

      const rim = new THREE.Mesh(rimHubGeo, this.rimMat);
      spinGroup.add(rim);

      for (let s = 0; s < 3; s++) {
        const spoke = new THREE.Mesh(spokeGeo, this.rimMat);
        spoke.rotation.x = (s * Math.PI) / 3;
        spinGroup.add(spoke);
      }

      const caliper = new THREE.Mesh(caliperGeo, this.caliperMat);
      caliper.position.set(cfg.side * 0.08, 0.05, 0.12);
      steerPivot.add(caliper);

      steerPivot.add(spinGroup);
      if (!cfg.isFront) {
        steerPivot.scale.set(1.06, 1.04, 1.04);
      } else {
        this.frontWheelPivots.push(steerPivot);
      }

      this.wheelSpinGroups.push(spinGroup);
      this.wheelsContainer.add(steerPivot);
    }
  }

  _buildGroundEffects() {
    const shadowTex = createContactShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      color: shadowTex ? 0xffffff : 0x000000,
      transparent: true,
      opacity: shadowTex ? 0.72 : 0.4,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 5.1), shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, 0.02, 0.05);
    this.root.add(shadowPlane);

    // Neon Arcade Underglow beneath the chassis
    this.underglowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      color: 0x22e4ff,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const underglowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 4.75), this.underglowMat);
    underglowPlane.rotation.x = -Math.PI / 2;
    underglowPlane.position.set(0, 0.032, 0.02);
    this.root.add(underglowPlane);

    if (!this.isSoftwareGl) {
      this.underglowLight = new THREE.PointLight(0x22e4ff, 3.6, 5.2, 2);
      this.underglowLight.position.set(0, 0.26, 0);
      this.root.add(this.underglowLight);
    }

    const hlTex = createHeadlightPoolTexture();
    if (hlTex) {
      const beamMat = new THREE.MeshBasicMaterial({
        map: hlTex,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      for (const bx of [-0.62, 0.62]) {
        const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 11.0), beamMat);
        beam.rotation.x = -Math.PI / 2;
        beam.position.set(bx, 0.035, -7.6);
        this.root.add(beam);
      }
    }
  }

  _buildSparkSystem() {
    const count = 24;
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.32);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, count);
    this.sparkMesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      this.sparks.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
      });
      _sparkDummy.position.set(0, -10, 0);
      _sparkDummy.scale.setScalar(0.001);
      _sparkDummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _sparkDummy.matrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  attachSparksToScene(scene) {
    if (scene && this.sparkMesh) {
      scene.add(this.sparkMesh);
    }
  }

  triggerCollisionSparks(impactX = this.x, impactZ = this.z - 1.2) {
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      sp.active = true;
      sp.x = impactX + (Math.random() - 0.5) * 1.1;
      sp.y = 0.45 + Math.random() * 0.5;
      sp.z = impactZ + (Math.random() - 0.5) * 1.2;
      sp.vx = (Math.random() - 0.5) * 11;
      sp.vy = 2.5 + Math.random() * 5.5;
      sp.vz = 3 + Math.random() * 9;
      sp.life = 0.45 + Math.random() * 0.35;
    }
  }

  triggerDamageShield(duration = 1.35) {
    this.invulnerableTimer = duration;
    this.triggerCollisionSparks();
  }

  triggerFatalCrash(direction = 1) {
    this.isCrashed = true;
    this.crashTimer = 0;
    this.crashSpinRate = (direction >= 0 ? 1 : -1) * 5.2;
    this.triggerCollisionSparks();
  }

  reset() {
    this.x = 0;
    this.z = 0;
    this.lateralVelocity = 0;
    this.steerInput = 0;
    this.invulnerableTimer = 0;
    this.isCrashed = false;
    this.crashSpinRate = 0;
    this.crashTimer = 0;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.chassisGroup.position.set(0, 0, 0);
    this.chassisGroup.rotation.set(0, 0, 0);
    this.chassisGroup.visible = true;
    if (this.nitroFlameMat) this.nitroFlameMat.opacity = 0;

    for (let i = 0; i < this.sparks.length; i++) {
      this.sparks[i].active = false;
      _sparkDummy.position.set(0, -10, 0);
      _sparkDummy.scale.setScalar(0.001);
      _sparkDummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _sparkDummy.matrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Updates car lateral position, road clamping, wheel spin, front steering knuckles,
   * body roll/pitch, brake light intensity, Nitro exhaust plasma, and collision sparks.
   */
  update(
    dt,
    {
      steer = 0,
      speedMps = 0,
      isAccelerating = false,
      isBraking = false,
      isBoosting = false,
    } = {},
  ) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt));
    const clampedSteer = Math.max(-1, Math.min(1, steer));
    this.steerInput = clampedSteer;
    const model = this.getActiveModelPreset();

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - safeDt);
      this.chassisGroup.visible = Math.floor(this.invulnerableTimer * 18) % 2 === 0;
    } else {
      this.chassisGroup.visible = true;
    }

    if (this.isCrashed) {
      this.crashTimer += safeDt;
      const decay = Math.exp(-2.4 * safeDt);
      this.crashSpinRate *= decay;
      this.root.rotation.y += this.crashSpinRate * safeDt;
      this.x = Math.max(-PLAYER_MAX_X, Math.min(PLAYER_MAX_X, this.x + this.lateralVelocity * safeDt));
      this.lateralVelocity *= decay;
      this.root.position.x = this.x;
      if (this.nitroFlameMat) this.nitroFlameMat.opacity = 0;
      this._updateSparks(safeDt);
      return;
    }

    // Crisp, manageable lateral velocity scaled smoothly across both low and standard speeds
    const speedFactor = Math.min(1.12, 0.62 + speedMps / 56);
    const maxLateralSpeed = 14.8 * speedFactor * (model.handlingFactor || 1.0);
    let targetVx = clampedSteer * maxLateralSpeed;

    // Gently cushion outward speed in the final 0.42m near barriers
    const edgeDistLeft = this.x - -PLAYER_MAX_X;
    const edgeDistRight = PLAYER_MAX_X - this.x;
    if (targetVx < 0 && edgeDistLeft < 0.42) {
      targetVx *= Math.max(0, edgeDistLeft / 0.42);
    } else if (targetVx > 0 && edgeDistRight < 0.42) {
      targetVx *= Math.max(0, edgeDistRight / 0.42);
    }

    this.lateralVelocity = THREE.MathUtils.damp(this.lateralVelocity, targetVx, 19.5, safeDt);
    this.x += this.lateralVelocity * safeDt;

    if (this.x < -PLAYER_MAX_X) {
      this.x = -PLAYER_MAX_X;
      if (this.lateralVelocity < 0) this.lateralVelocity = 0;
    } else if (this.x > PLAYER_MAX_X) {
      this.x = PLAYER_MAX_X;
      if (this.lateralVelocity > 0) this.lateralVelocity = 0;
    }

    this.root.position.x = this.x;

    // Responsive yaw into turns + chassis body roll & pitch squat/dive
    const normalizedVx = this.lateralVelocity / 16.5;
    const targetYaw = -normalizedVx * 0.165;
    const targetRoll = -normalizedVx * 0.085;
    const targetPitch = isBraking ? -0.028 : isBoosting ? 0.026 : isAccelerating ? 0.015 : 0;

    this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, targetYaw, 15.0, safeDt);
    this.chassisGroup.rotation.z = THREE.MathUtils.damp(
      this.chassisGroup.rotation.z,
      targetRoll,
      13.5,
      safeDt,
    );
    this.chassisGroup.rotation.x = THREE.MathUtils.damp(
      this.chassisGroup.rotation.x,
      targetPitch,
      10.0,
      safeDt,
    );

    // Subtle high-frequency road suspension micro-bump
    this.suspensionPhase += safeDt * (8 + speedMps * 0.45);
    const bumpAmplitude = Math.min(0.014, speedMps * 0.00028);
    this.chassisGroup.position.y =
      Math.sin(this.suspensionPhase) * bumpAmplitude +
      Math.cos(this.suspensionPhase * 2.3) * (bumpAmplitude * 0.4);

    // Rotate front wheel knuckles & spin all 4 wheels
    const targetWheelSteer = -clampedSteer * 0.42;
    for (let i = 0; i < this.frontWheelPivots.length; i++) {
      this.frontWheelPivots[i].rotation.y = THREE.MathUtils.damp(
        this.frontWheelPivots[i].rotation.y,
        targetWheelSteer,
        14,
        safeDt,
      );
    }

    const wheelRadius = this.wheelRadius || 0.34;
    this.wheelSpinAngle -= (speedMps * safeDt) / wheelRadius;
    for (let i = 0; i < this.wheelSpinGroups.length; i++) {
      this.wheelSpinGroups[i].rotation.x = this.wheelSpinAngle;
    }

    // Dynamic brake light, exhaust glow & Nitro plasma afterburners
    this.taillightMat.emissiveIntensity = isBraking ? 4.4 : 1.75;
    this.exhaustGlowMat.opacity =
      isBoosting ? 0.95 : isAccelerating && speedMps > 15 ? 0.72 : 0.0;

    if (this.nitroFlameMat) {
      if (isBoosting) {
        const flicker = 0.78 + Math.sin(this.suspensionPhase * 3.8) * 0.18;
        this.nitroFlameMat.opacity = flicker;
        for (let p = 0; p < this.nitroPlumes.length; p++) {
          this.nitroPlumes[p].scale.set(1, 0.85 + Math.random() * 0.45, 1);
        }
      } else {
        this.nitroFlameMat.opacity = 0;
      }
    }

    this._updateSparks(safeDt);
  }

  _updateSparks(dt) {
    let dirty = false;
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      if (!sp.active) continue;
      dirty = true;
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.active = false;
        _sparkDummy.position.set(0, -10, 0);
        _sparkDummy.scale.setScalar(0.001);
      } else {
        sp.vy -= 14 * dt;
        sp.x += sp.vx * dt;
        sp.y = Math.max(0.05, sp.y + sp.vy * dt);
        sp.z += sp.vz * dt;
        _sparkDummy.position.set(sp.x, sp.y, sp.z);
        _sparkDummy.rotation.set(0, Math.atan2(sp.vx, sp.vz), 0);
        _sparkDummy.scale.setScalar(Math.max(0.2, sp.life * 1.4));
      }
      _sparkDummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _sparkDummy.matrix);
    }
    if (dirty) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
    }
  }

  getBounds() {
    return {
      x: this.x,
      z: this.z,
      halfWidth: CAR_HALF_WIDTH,
      halfLength: CAR_HALF_LENGTH,
    };
  }
}
