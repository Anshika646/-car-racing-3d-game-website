/**
 * Car.js
 *
 * Detailed multi-part 3D GT Supercar built procedurally with Three.js:
 * - Sculpted beveled lower chassis (ExtrudeGeometry)
 * - Aerodynamic smoked-glass canopy (ExtrudeGeometry)
 * - Matte carbon front splitter, side skirts & rear diffuser
 * - Twin brushed-titanium exhausts with throttle glow
 * - Dual-pylon GT rear wing with cyan endplate accents
 * - LED matrix headlights + road light pools & dynamic horizon brake bar
 * - 4 multi-part articulated wheels (tire, 5-spoke rim, amber caliper)
 * - Soft radial contact shadow & collision spark burst pool
 */

import * as THREE from 'three';

export const ROAD_HALF_WIDTH = 7.0;
export const CAR_HALF_WIDTH = 0.96;
export const CAR_HALF_LENGTH = 2.15;
export const PLAYER_MAX_X = ROAD_HALF_WIDTH - CAR_HALF_WIDTH - 0.35; // 5.69m safe inside barriers

export const CAR_PAINT_PRESETS = [
  {
    id: 'cyan_metallic',
    name: 'Cyber Cyan',
    finishType: 'Liquid Metallic',
    swatch: '#06b6d4',
    bodyColor: 0x0d3550,
    metalness: 0.85,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    trimColor: 0x22d3ee,
    trimEmissive: 0x0891b2,
    caliperColor: 0xf59e0b,
    rimColor: 0xdbeafe,
    exhaustColor: 0x22d3ee,
  },
  {
    id: 'rosso_gloss',
    name: 'Crimson Rosso',
    finishType: 'Racing Gloss',
    swatch: '#ef4444',
    bodyColor: 0xb91c1c,
    metalness: 0.52,
    roughness: 0.13,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    trimColor: 0xfbbf24,
    trimEmissive: 0xd97706,
    caliperColor: 0xfacc15,
    rimColor: 0xf1f5f9,
    exhaustColor: 0xf97316,
  },
  {
    id: 'solar_pearl',
    name: 'Solar Papaya',
    finishType: 'Pearlescent',
    swatch: '#f59e0b',
    bodyColor: 0xd97706,
    metalness: 0.72,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.07,
    trimColor: 0xfef08a,
    trimEmissive: 0xf59e0b,
    caliperColor: 0xef4444,
    rimColor: 0x1e293b,
    exhaustColor: 0xfbbf24,
  },
  {
    id: 'emerald_satin',
    name: 'Viper Emerald',
    finishType: 'Satin Metallic',
    swatch: '#10b981',
    bodyColor: 0x047857,
    metalness: 0.78,
    roughness: 0.28,
    clearcoat: 0.65,
    clearcoatRoughness: 0.2,
    trimColor: 0x34d399,
    trimEmissive: 0x059669,
    caliperColor: 0xfbbf24,
    rimColor: 0xd1fae5,
    exhaustColor: 0x34d399,
  },
  {
    id: 'stealth_matte',
    name: 'Phantom Stealth',
    finishType: 'Matte Carbon',
    swatch: '#475569',
    bodyColor: 0x111827,
    metalness: 0.34,
    roughness: 0.54,
    clearcoat: 0.2,
    clearcoatRoughness: 0.42,
    trimColor: 0x38bdf8,
    trimEmissive: 0x0284c7,
    caliperColor: 0x22d3ee,
    rimColor: 0x334155,
    exhaustColor: 0x38bdf8,
  },
  {
    id: 'pearl_ceramic',
    name: 'Glacier White',
    finishType: 'Ceramic Gloss',
    swatch: '#f8fafc',
    bodyColor: 0xe2e8f0,
    metalness: 0.35,
    roughness: 0.11,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    trimColor: 0xf43f5e,
    trimEmissive: 0xe11d48,
    caliperColor: 0xf43f5e,
    rimColor: 0x1e293b,
    exhaustColor: 0x38bdf8,
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
    this.root.add(this.chassisGroup);

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
    this.sparks = [];
    this.paintPresetId = options.paintPresetId || CAR_PAINT_PRESETS[0].id;

    this._buildMaterials();
    this._buildBody();
    this._buildWheels();
    this._buildGroundEffects();
    this._buildSparkSystem();
    this.setPaintPreset(this.paintPresetId);
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
    return preset;
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
  }

  _buildBody() {
    // 1. Sculpted Aerodynamic Lower Hull (ExtrudeGeometry side silhouette -> rotated along X)
    const sideProfile = new THREE.Shape();
    sideProfile.moveTo(-2.12, 0.24);
    sideProfile.lineTo(-2.02, 0.52); // Nose slope
    sideProfile.lineTo(-1.15, 0.68); // Hood
    sideProfile.lineTo(1.25, 0.74);  // Rear deck
    sideProfile.lineTo(2.08, 0.66);  // Tail Kammback
    sideProfile.lineTo(2.12, 0.28);  // Rear diffuser height
    sideProfile.lineTo(-2.12, 0.24);

    const hullGeo = new THREE.ExtrudeGeometry(sideProfile, {
      depth: 1.72,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.07,
      bevelSegments: 3,
    });
    hullGeo.center();
    // Rotate so length runs along Z (-Z is forward, +Z is rear facing camera)
    hullGeo.rotateY(Math.PI / 2);

    const hullMesh = new THREE.Mesh(hullGeo, this.bodyPaintMat);
    hullMesh.position.set(0, 0.49, 0);
    hullMesh.castShadow = !this.isSoftwareGl;
    hullMesh.receiveShadow = !this.isSoftwareGl;
    this.chassisGroup.add(hullMesh);

    // 2. Tapered Smoked-Glass GT Canopy
    const cabinProfile = new THREE.Shape();
    cabinProfile.moveTo(-0.95, 0);
    cabinProfile.lineTo(-0.32, 0.44); // Windshield rake
    cabinProfile.lineTo(0.45, 0.45);  // Roofline
    cabinProfile.lineTo(1.28, 0.06);  // Fastback rear glass
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

    // Roof Spine Accent
    const spineMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.04, 1.3),
      this.accentTrimMat,
    );
    spineMesh.position.set(0, 1.13, 0.22);
    this.chassisGroup.add(spineMesh);

    // 3. Front Carbon Aero Splitter & Side Skirts
    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(1.94, 0.07, 0.48),
      this.carbonMat,
    );
    splitter.position.set(0, 0.21, -1.96);
    this.chassisGroup.add(splitter);

    const skirtGeo = new THREE.BoxGeometry(1.96, 0.08, 2.55);
    const skirts = new THREE.Mesh(skirtGeo, this.carbonMat);
    skirts.position.set(0, 0.22, 0.05);
    this.chassisGroup.add(skirts);

    // Cyan Aero Pin-Stripes along side skirts
    const stripeGeo = new THREE.BoxGeometry(1.98, 0.025, 2.45);
    const sideStripes = new THREE.Mesh(stripeGeo, this.accentTrimMat);
    sideStripes.position.set(0, 0.255, 0.05);
    this.chassisGroup.add(sideStripes);

    // 4. Rear Diffuser + Twin Titanium Exhausts
    const diffuser = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.22, 0.34),
      this.carbonMat,
    );
    diffuser.position.set(0, 0.28, 2.04);
    this.chassisGroup.add(diffuser);

    const exhaustGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.24, 14);
    exhaustGeo.rotateX(Math.PI / 2);
    const glowGeo = new THREE.CircleGeometry(0.062, 12);

    for (const side of [-0.42, 0.42]) {
      const pipe = new THREE.Mesh(exhaustGeo, this.rimMat);
      pipe.position.set(side, 0.29, 2.16);
      this.chassisGroup.add(pipe);

      const flame = new THREE.Mesh(glowGeo, this.exhaustGlowMat);
      flame.position.set(side, 0.29, 2.285);
      this.chassisGroup.add(flame);
    }

    // 5. Elevated GT Rear Wing (Pylons + Airfoil + Endplates)
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

    // 6. Dual Matrix Headlights (-Z front)
    const hlGeo = new THREE.BoxGeometry(0.38, 0.07, 0.12);
    for (const hx of [-0.64, 0.64]) {
      const hl = new THREE.Mesh(hlGeo, this.headlightMat);
      hl.position.set(hx, 0.48, -2.08);
      hl.rotation.y = hx < 0 ? 0.14 : -0.14;
      this.chassisGroup.add(hl);
    }

    // 7. Horizon LED Taillight Bar + Brake Segments (+Z rear facing camera)
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

    // 8. Side Mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.22, 0.07, 0.12);
    for (const mx of [-0.96, 0.96]) {
      const mirror = new THREE.Mesh(mirrorGeo, this.bodyPaintMat);
      mirror.position.set(mx, 0.78, -0.45);
      this.chassisGroup.add(mirror);
    }
  }

  _buildWheels() {
    const wheelConfigs = [
      { x: -0.92, y: 0.34, z: -1.32, isFront: true, side: -1 },
      { x: 0.92, y: 0.34, z: -1.32, isFront: true, side: 1 },
      { x: -0.94, y: 0.36, z: 1.32, isFront: false, side: -1 },
      { x: 0.94, y: 0.36, z: 1.32, isFront: false, side: 1 },
    ];

    const tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 22);
    tireGeo.rotateZ(Math.PI / 2);

    const rimHubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.29, 16);
    rimHubGeo.rotateZ(Math.PI / 2);

    const spokeGeo = new THREE.BoxGeometry(0.3, 0.045, 0.41);
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

      // Non-spinning brake caliper attached to steering knuckle
      const caliper = new THREE.Mesh(caliperGeo, this.caliperMat);
      caliper.position.set(cfg.side * 0.08, 0.05, 0.12);
      steerPivot.add(caliper);

      steerPivot.add(spinGroup);
      if (!cfg.isFront) {
        steerPivot.scale.set(1.06, 1.05, 1.05);
      } else {
        this.frontWheelPivots.push(steerPivot);
      }

      this.wheelSpinGroups.push(spinGroup);
      this.root.add(steerPivot);
    }
  }

  _buildGroundEffects() {
    // Contact shadow grounded right under the car so it never looks floating
    const shadowTex = createContactShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      color: shadowTex ? 0xffffff : 0x000000,
      transparent: true,
      opacity: shadowTex ? 0.9 : 0.45,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 5.1), shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, 0.02, 0.05);
    this.root.add(shadowPlane);

    // Projected headlight road glow cones ahead of the car
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
        beam.position.set(bx, 0.03, -7.6);
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
   * body roll/pitch, brake light intensity, and collision sparks.
   */
  update(dt, { steer = 0, speedMps = 0, isAccelerating = false, isBraking = false } = {}) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt));
    const clampedSteer = Math.max(-1, Math.min(1, steer));
    this.steerInput = clampedSteer;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - safeDt);
      // Subtle hull flicker during recovery window
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
      this._updateSparks(safeDt);
      return;
    }

    // Smooth, progressive lateral velocity with soft highway-edge cushion
    const speedFactor = Math.min(1.16, 0.56 + speedMps / 56);
    const maxLateralSpeed = 14.2 * speedFactor;
    let targetVx = clampedSteer * maxLateralSpeed;

    // Gently cushion outward speed in the final 0.45m near barriers so it never slams harshly
    const edgeDistLeft = this.x - -PLAYER_MAX_X;
    const edgeDistRight = PLAYER_MAX_X - this.x;
    if (targetVx < 0 && edgeDistLeft < 0.45) {
      targetVx *= Math.max(0, edgeDistLeft / 0.45);
    } else if (targetVx > 0 && edgeDistRight < 0.45) {
      targetVx *= Math.max(0, edgeDistRight / 0.45);
    }

    this.lateralVelocity = THREE.MathUtils.damp(this.lateralVelocity, targetVx, 13.5, safeDt);
    this.x += this.lateralVelocity * safeDt;

    // Enforce strict road boundaries so the car can never leave the highway
    if (this.x < -PLAYER_MAX_X) {
      this.x = -PLAYER_MAX_X;
      if (this.lateralVelocity < 0) this.lateralVelocity = 0;
    } else if (this.x > PLAYER_MAX_X) {
      this.x = PLAYER_MAX_X;
      if (this.lateralVelocity > 0) this.lateralVelocity = 0;
    }

    this.root.position.x = this.x;

    // Smooth yaw into turns + chassis body roll & pitch squat/dive
    const normalizedVx = this.lateralVelocity / 14.2;
    const targetYaw = -normalizedVx * 0.145;
    const targetRoll = -normalizedVx * 0.075;
    const targetPitch = isBraking ? -0.028 : isAccelerating ? 0.015 : 0;

    this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, targetYaw, 11.5, safeDt);
    this.chassisGroup.rotation.z = THREE.MathUtils.damp(
      this.chassisGroup.rotation.z,
      targetRoll,
      10.5,
      safeDt,
    );
    this.chassisGroup.rotation.x = THREE.MathUtils.damp(
      this.chassisGroup.rotation.x,
      targetPitch,
      9.0,
      safeDt,
    );

    // Subtle high-frequency road suspension micro-bump proportional to speed
    this.suspensionPhase += safeDt * (8 + speedMps * 0.45);
    const bumpAmplitude = Math.min(0.014, speedMps * 0.00028);
    this.chassisGroup.position.y =
      Math.sin(this.suspensionPhase) * bumpAmplitude +
      Math.cos(this.suspensionPhase * 2.3) * (bumpAmplitude * 0.4);

    // Rotate front wheel knuckles & spin all 4 wheels according to forward speed
    const targetWheelSteer = -clampedSteer * 0.42;
    for (let i = 0; i < this.frontWheelPivots.length; i++) {
      this.frontWheelPivots[i].rotation.y = THREE.MathUtils.damp(
        this.frontWheelPivots[i].rotation.y,
        targetWheelSteer,
        14,
        safeDt,
      );
    }

    const wheelRadius = 0.34;
    this.wheelSpinAngle -= (speedMps * safeDt) / wheelRadius;
    for (let i = 0; i < this.wheelSpinGroups.length; i++) {
      this.wheelSpinGroups[i].rotation.x = this.wheelSpinAngle;
    }

    // Dynamic brake light & exhaust glow response
    this.taillightMat.emissiveIntensity = isBraking ? 4.4 : 1.75;
    this.exhaustGlowMat.opacity = isAccelerating && speedMps > 24 ? 0.72 : 0.0;

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
