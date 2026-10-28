/**
 * TrafficManager.js
 *
 * Spawns, animates, and recycles 5 distinct 3D highway rival & traffic vehicle models
 * with vibrant custom colours and floating random racer nameplates across 4 lanes,
 * guaranteeing fair navigable gaps and progressive difficulty.
 */

import * as THREE from 'three';
import { LANE_CENTERS } from './Road.js';
import {
  createNameplateSprite,
  updateNameplateSprite,
  pickRandomRivalName,
} from './Nameplate.js';

const VEHICLE_ARCHETYPES = [
  {
    type: 'sportster',
    badge: 'GT',
    halfWidth: 0.94,
    halfLength: 2.08,
    baseSpeedMps: 16.5,
    nameplateY: 1.72,
    colors: [
      { hex: 0xff2eb6, accent: '#ff70cf' },
      { hex: 0x00d4ff, accent: '#22e4ff' },
      { hex: 0x9d4edd, accent: '#d8b4fe' },
      { hex: 0x84cc16, accent: '#a3ff2e' },
      { hex: 0xff8c1a, accent: '#ffe224' },
    ],
  },
  {
    type: 'coupe',
    badge: 'RS',
    halfWidth: 0.94,
    halfLength: 2.02,
    baseSpeedMps: 14.8,
    nameplateY: 1.76,
    colors: [
      { hex: 0xff8c1a, accent: '#ffe224' },
      { hex: 0x06b6d4, accent: '#22e4ff' },
      { hex: 0xec4899, accent: '#ff70cf' },
      { hex: 0x10b981, accent: '#6ee7b7' },
      { hex: 0xfacc15, accent: '#fef08a' },
    ],
  },
  {
    type: 'sedan',
    badge: 'PRO',
    halfWidth: 0.92,
    halfLength: 2.1,
    baseSpeedMps: 13.0,
    nameplateY: 1.82,
    colors: [
      { hex: 0x3b82f6, accent: '#93c5fd' },
      { hex: 0xf43f5e, accent: '#fda4af' },
      { hex: 0xa855f7, accent: '#d8b4fe' },
      { hex: 0x14b8a6, accent: '#5eead4' },
      { hex: 0xeab308, accent: '#fde047' },
    ],
  },
  {
    type: 'suv',
    badge: '4X4',
    halfWidth: 1.0,
    halfLength: 2.22,
    baseSpeedMps: 11.4,
    nameplateY: 1.98,
    colors: [
      { hex: 0x06b6d4, accent: '#67e8f9' },
      { hex: 0xf97316, accent: '#fdba74' },
      { hex: 0xec4899, accent: '#f9a8d4' },
      { hex: 0x22c55e, accent: '#86efac' },
      { hex: 0x6366f1, accent: '#a5b4fc' },
    ],
  },
  {
    type: 'truck',
    badge: 'RIG',
    halfWidth: 1.12,
    halfLength: 3.35,
    baseSpeedMps: 9.2,
    nameplateY: 3.15,
    colors: [
      { hex: 0xff8c1a, accent: '#ffe224' },
      { hex: 0x22e4ff, accent: '#a5f3fc' },
      { hex: 0xff2eb6, accent: '#fbcfe8' },
      { hex: 0xa3ff2e, accent: '#d9f99d' },
    ],
  },
];

let _sharedAssets = null;
function getSharedTrafficAssets() {
  if (_sharedAssets) return _sharedAssets;

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2);

  _sharedAssets = {
    wheelGeo,
    tireMat: new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.86 }),
    rimMat: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.28 }),
    glassMat: new THREE.MeshStandardMaterial({
      color: 0x080e1a,
      roughness: 0.12,
      metalness: 0.5,
    }),
    trimMat: new THREE.MeshStandardMaterial({
      color: 0x151c28,
      roughness: 0.68,
      metalness: 0.25,
    }),
    stripeMat: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.4,
    }),
    tailLightMat: new THREE.MeshBasicMaterial({ color: 0xff2e3d }),
    headLightMat: new THREE.MeshBasicMaterial({ color: 0xfef3c7 }),
    amberMarkerMat: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
  };
  return _sharedAssets;
}

function buildTrafficVehicleMesh(archetype, colorObj, initialName, isSoftwareGl) {
  const shared = getSharedTrafficAssets();
  const group = new THREE.Group();
  const wheels = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorObj.hex,
    metalness: archetype.type === 'truck' ? 0.42 : 0.76,
    roughness: archetype.type === 'truck' ? 0.42 : 0.2,
  });

  if (archetype.type === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.65, 1.85), bodyMat);
    cab.position.set(0, 1.05, -2.25);
    cab.castShadow = !isSoftwareGl;
    group.add(cab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.65, 0.12), shared.glassMat);
    windshield.position.set(0, 1.38, -3.14);
    group.add(windshield);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.22, 2.35, 4.55),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.28 }),
    );
    cargoBox.position.set(0, 1.52, 1.05);
    cargoBox.castShadow = !isSoftwareGl;
    group.add(cargoBox);

    // Side accent stripe along cargo trailer
    const sideBand = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.22, 4.4), bodyMat);
    sideBand.position.set(0, 1.35, 1.05);
    group.add(sideBand);

    const chassisRail = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 6.2), shared.trimMat);
    chassisRail.position.set(0, 0.38, 0);
    group.add(chassisRail);

    for (const tx of [-0.82, 0.82]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), shared.tailLightMat);
      tl.position.set(tx, 0.58, 3.34);
      group.add(tl);

      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.08), shared.amberMarkerMat);
      marker.position.set(tx, 2.6, 3.34);
      group.add(marker);
    }

    for (const wz of [-2.35, 1.15, 2.25]) {
      for (const wx of [-1.02, 1.02]) {
        const w = new THREE.Mesh(shared.wheelGeo, shared.tireMat);
        w.position.set(wx, 0.33, wz);
        wheels.push(w);
        group.add(w);
      }
    }
  } else if (archetype.type === 'sportster') {
    // Low-slung Rival GT Supercar with center racing stripe + elevated GT wing
    const length = archetype.halfLength * 2;
    const width = archetype.halfWidth * 2;

    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(width, 0.44, length), bodyMat);
    lowerBody.position.set(0, 0.48, 0);
    lowerBody.castShadow = !isSoftwareGl;
    group.add(lowerBody);

    const centerStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.02, length * 0.96),
      shared.stripeMat,
    );
    centerStripe.position.set(0, 0.71, 0);
    group.add(centerStripe);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.76, 0.36, 1.72),
      shared.glassMat,
    );
    canopy.position.set(0, 0.84, 0.08);
    group.add(canopy);

    // Elevated Rival GT Rear Wing
    for (const px of [-0.48, 0.48]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.2), shared.trimMat);
      pylon.position.set(px, 0.82, archetype.halfLength - 0.22);
      group.add(pylon);
    }
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.96, 0.05, 0.28),
      bodyMat,
    );
    wing.position.set(0, 0.95, archetype.halfLength - 0.2);
    group.add(wing);

    const fullTailBar = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.88, 0.09, 0.08),
      shared.tailLightMat,
    );
    fullTailBar.position.set(0, 0.58, archetype.halfLength + 0.02);
    group.add(fullTailBar);

    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), shared.headLightMat);
      hl.position.set(side * (archetype.halfWidth - 0.26), 0.52, -archetype.halfLength - 0.02);
      group.add(hl);
    }

    for (const wz of [-archetype.halfLength * 0.62, archetype.halfLength * 0.62]) {
      for (const wx of [-archetype.halfWidth + 0.05, archetype.halfWidth - 0.05]) {
        const w = new THREE.Mesh(shared.wheelGeo, shared.tireMat);
        w.position.set(wx, 0.32, wz);
        wheels.push(w);
        group.add(w);
      }
    }
  } else {
    // Composite Sedan / Coupe / SUV
    const isSuv = archetype.type === 'suv';
    const isCoupe = archetype.type === 'coupe';
    const hullHeight = isSuv ? 0.68 : 0.54;
    const cabinHeight = isSuv ? 0.58 : isCoupe ? 0.42 : 0.48;
    const cabinLength = isSuv ? 2.55 : isCoupe ? 1.85 : 2.15;
    const length = archetype.halfLength * 2;
    const width = archetype.halfWidth * 2;

    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(width, hullHeight, length),
      bodyMat,
    );
    lowerBody.position.set(0, 0.32 + hullHeight * 0.5, 0);
    lowerBody.castShadow = !isSoftwareGl;
    group.add(lowerBody);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.84, cabinHeight, cabinLength),
      shared.glassMat,
    );
    cabin.position.set(0, 0.32 + hullHeight + cabinHeight * 0.46, isSuv ? 0.25 : 0.12);
    group.add(cabin);

    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.8, 0.06, cabinLength * 0.86),
      bodyMat,
    );
    roofCap.position.set(0, 0.32 + hullHeight + cabinHeight * 0.94, isSuv ? 0.25 : 0.12);
    group.add(roofCap);

    if (isSuv) {
      for (const rx of [-0.66, 0.66]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 2.0), shared.trimMat);
        rail.position.set(rx, 1.62, 0.25);
        group.add(rail);
      }
    }

    if (isCoupe) {
      const spoiler = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.9, 0.07, 0.24),
        shared.trimMat,
      );
      spoiler.position.set(0, 0.96, archetype.halfLength - 0.18);
      group.add(spoiler);
    }

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(width * 0.98, 0.18, 0.15), shared.trimMat);
    bumper.position.set(0, 0.36, archetype.halfLength);
    group.add(bumper);

    for (const side of [-1, 1]) {
      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.12, 0.08),
        shared.tailLightMat,
      );
      tl.position.set(side * (archetype.halfWidth - 0.28), 0.64, archetype.halfLength + 0.02);
      group.add(tl);

      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.1, 0.08),
        shared.headLightMat,
      );
      hl.position.set(side * (archetype.halfWidth - 0.28), 0.58, -archetype.halfLength - 0.02);
      group.add(hl);
    }

    for (const wz of [-archetype.halfLength * 0.62, archetype.halfLength * 0.62]) {
      for (const wx of [-archetype.halfWidth + 0.06, archetype.halfWidth - 0.06]) {
        const w = new THREE.Mesh(shared.wheelGeo, shared.tireMat);
        w.position.set(wx, 0.32, wz);
        wheels.push(w);
        group.add(w);
      }
    }
  }

  // Floating 3D Rival Nameplate above roof
  const nameplate = createNameplateSprite({
    name: initialName,
    badge: archetype.badge,
    accentColor: colorObj.accent,
    isPlayer: false,
  });
  nameplate.position.set(0, archetype.nameplateY, 0);
  group.add(nameplate);

  return { group, wheels, bodyMat, nameplate };
}

export class TrafficManager {
  constructor(options = {}) {
    this.isSoftwareGl = Boolean(options.isSoftwareGl);
    this.root = new THREE.Group();

    this.activeVehicles = [];
    this.pool = [];
    this.spawnTimer = 0.8;
    this.difficultyLevel = 1;
    this.nextId = 1;

    this._prewarmPool(20);
  }

  _prewarmPool(count) {
    for (let i = 0; i < count; i++) {
      const arch = VEHICLE_ARCHETYPES[i % VEHICLE_ARCHETYPES.length];
      const colorObj = arch.colors[i % arch.colors.length];
      const driverName = pickRandomRivalName();
      const built = buildTrafficVehicleMesh(arch, colorObj, driverName, this.isSoftwareGl);
      built.group.visible = false;
      this.root.add(built.group);
      this.pool.push({
        id: this.nextId++,
        archetype: arch,
        mesh: built.group,
        wheels: built.wheels,
        bodyMat: built.bodyMat,
        nameplate: built.nameplate,
        driverName,
        laneIndex: 0,
        x: 0,
        z: -200,
        speedMps: arch.baseSpeedMps,
        halfWidth: arch.halfWidth,
        halfLength: arch.halfLength,
        nearMissAwarded: false,
        overtakenAwarded: false,
        collided: false,
      });
    }
  }

  reset() {
    while (this.activeVehicles.length > 0) {
      const v = this.activeVehicles.pop();
      v.mesh.visible = false;
      this.pool.push(v);
    }
    this.spawnTimer = 0.75;
    this.difficultyLevel = 1;
  }

  _acquireVehicle(preferredType = null) {
    if (this.pool.length === 0) return null;
    let idx = 0;
    if (preferredType) {
      const found = this.pool.findIndex((p) => p.archetype.type === preferredType);
      if (found >= 0) idx = found;
    } else {
      idx = Math.floor(Math.random() * this.pool.length);
    }
    const [vehicle] = this.pool.splice(idx, 1);
    return vehicle;
  }

  _isLaneClearAtZ(laneIndex, spawnZ, minClearance = 20) {
    for (let i = 0; i < this.activeVehicles.length; i++) {
      const v = this.activeVehicles[i];
      if (v.laneIndex === laneIndex && Math.abs(v.z - spawnZ) < minClearance) {
        return false;
      }
    }
    return true;
  }

  /**
   * Spawns structured highway traffic formations while strictly guaranteeing
   * at least 1 unobstructed lane so every wave is 100% fair and navigable.
   */
  spawnWave(difficulty = 1, speedScale = 1.0) {
    const clampedScale = Math.max(0.45, Math.min(1.5, speedScale));
    const laneIndices = [0, 1, 2, 3];
    for (let i = laneIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = laneIndices[i];
      laneIndices[i] = laneIndices[j];
      laneIndices[j] = tmp;
    }

    const roll = Math.random();
    let desiredCount = 1;
    if (difficulty >= 5 && roll > 0.62) {
      desiredCount = 3;
    } else if (difficulty >= 2 && roll > 0.36) {
      desiredCount = 2;
    } else if (roll > 0.72) {
      desiredCount = 2;
    }

    const activeNames = new Set(this.activeVehicles.map((v) => v.driverName));
    const candidateLanes = laneIndices.slice(1, 1 + desiredCount);
    const baseSpawnZ = -182;

    for (let i = 0; i < candidateLanes.length; i++) {
      const laneIdx = candidateLanes[i];
      const staggerZ = i * -13.0 - Math.random() * 6;
      const z = baseSpawnZ + staggerZ;

      if (!this._isLaneClearAtZ(laneIdx, z, 26)) continue;

      const vehicle = this._acquireVehicle();
      if (!vehicle) break;

      // Pick fresh vibrant paint + unique random racer name on each spawn
      const palette = vehicle.archetype.colors;
      const pickedColor = palette[Math.floor(Math.random() * palette.length)];
      if (vehicle.bodyMat) {
        vehicle.bodyMat.color.setHex(pickedColor.hex);
      }

      const freshName = pickRandomRivalName(activeNames);
      activeNames.add(freshName);
      vehicle.driverName = freshName;
      updateNameplateSprite(vehicle.nameplate, {
        name: freshName,
        badge: vehicle.archetype.badge,
        accentColor: pickedColor.accent,
        isPlayer: false,
      });

      const speedBoost = (difficulty - 1) * 0.75;
      vehicle.laneIndex = laneIdx;
      vehicle.x = LANE_CENTERS[laneIdx];
      vehicle.z = z;
      vehicle.speedMps = Math.max(
        4.0,
        (vehicle.archetype.baseSpeedMps + speedBoost + (Math.random() - 0.5) * 1.8) *
          clampedScale,
      );
      vehicle.nearMissAwarded = false;
      vehicle.overtakenAwarded = false;
      vehicle.collided = false;

      vehicle.mesh.position.set(vehicle.x, 0, vehicle.z);
      vehicle.mesh.visible = true;
      if (vehicle.nameplate) {
        vehicle.nameplate.visible = false; // Shown smoothly once within ~95m
      }
      this.activeVehicles.push(vehicle);
    }
  }

  update(dt, playerSpeedMps, distanceMeters = 0, speedScale = 1.0) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt));

    this.difficultyLevel = Math.min(8, 1 + Math.floor(distanceMeters / 750));

    if (playerSpeedMps > 5.5) {
      this.spawnTimer -= safeDt * (0.48 + playerSpeedMps / 46);
      if (this.spawnTimer <= 0) {
        this.spawnWave(this.difficultyLevel, speedScale);
        const minInterval = Math.max(0.92, 1.82 - this.difficultyLevel * 0.1);
        this.spawnTimer = minInterval + Math.random() * 0.5;
      }
    }

    for (let i = this.activeVehicles.length - 1; i >= 0; i--) {
      const v = this.activeVehicles[i];
      const relativeSpeed = playerSpeedMps - v.speedMps;
      v.z += relativeSpeed * safeDt;
      v.mesh.position.set(v.x, 0, v.z);

      // Show rival gamer-tag nameplate cleanly when within readable racing range (-95m..+8m)
      if (v.nameplate) {
        v.nameplate.visible = v.z > -95 && v.z < 8;
      }

      const spinDelta = -(v.speedMps * safeDt) / 0.32;
      for (let w = 0; w < v.wheels.length; w++) {
        v.wheels[w].rotation.x += spinDelta;
      }

      if (v.z > 28 || v.z < -230) {
        v.mesh.visible = false;
        this.activeVehicles.splice(i, 1);
        this.pool.push(v);
      }
    }
  }
}
