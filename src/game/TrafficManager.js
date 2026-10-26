/**
 * TrafficManager.js
 *
 * Spawns, animates, and recycles multi-part 3D highway traffic vehicles
 * across 4 lanes with guaranteed fair navigable gaps and progressive difficulty.
 */

import * as THREE from 'three';
import { LANE_CENTERS } from './Road.js';

const VEHICLE_ARCHETYPES = [
  {
    type: 'sedan',
    halfWidth: 0.92,
    halfLength: 2.08,
    baseSpeedMps: 20,
    colors: [0x334155, 0x94a3b8, 0x1e3a5f, 0x3f3f46],
  },
  {
    type: 'coupe',
    halfWidth: 0.94,
    halfLength: 2.02,
    baseSpeedMps: 25,
    colors: [0xd97706, 0x0284c7, 0xe11d48, 0x0d9488],
  },
  {
    type: 'suv',
    halfWidth: 1.0,
    halfLength: 2.22,
    baseSpeedMps: 18,
    colors: [0x1f2937, 0x475569, 0xcbd5e1, 0x27272a],
  },
  {
    type: 'truck',
    halfWidth: 1.12,
    halfLength: 3.35,
    baseSpeedMps: 14,
    colors: [0xdbeafe, 0x64748b, 0xf59e0b],
  },
];

// Shared geometries/materials across pooled traffic vehicles for draw-call & memory efficiency
let _sharedAssets = null;
function getSharedTrafficAssets() {
  if (_sharedAssets) return _sharedAssets;

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2);

  _sharedAssets = {
    wheelGeo,
    tireMat: new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.86 }),
    glassMat: new THREE.MeshStandardMaterial({
      color: 0x090f1a,
      roughness: 0.14,
      metalness: 0.45,
    }),
    trimMat: new THREE.MeshStandardMaterial({
      color: 0x181f2c,
      roughness: 0.7,
      metalness: 0.2,
    }),
    tailLightMat: new THREE.MeshBasicMaterial({ color: 0xff2e3d }),
    headLightMat: new THREE.MeshBasicMaterial({ color: 0xfef3c7 }),
    amberMarkerMat: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
  };
  return _sharedAssets;
}

function buildTrafficVehicleMesh(archetype, paintHex, isSoftwareGl) {
  const shared = getSharedTrafficAssets();
  const group = new THREE.Group();
  const wheels = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: paintHex,
    metalness: archetype.type === 'truck' ? 0.35 : 0.72,
    roughness: archetype.type === 'truck' ? 0.48 : 0.24,
  });

  if (archetype.type === 'truck') {
    // Cab (-Z front) + Elevated Cargo Box (+Z rear) + Underride Bumper + 6 Wheels
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.65, 1.85), bodyMat);
    cab.position.set(0, 1.05, -2.25);
    cab.castShadow = !isSoftwareGl;
    group.add(cab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.65, 0.12), shared.glassMat);
    windshield.position.set(0, 1.38, -3.14);
    group.add(windshield);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.22, 2.35, 4.55),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.58, metalness: 0.25 }),
    );
    cargoBox.position.set(0, 1.52, 1.05);
    cargoBox.castShadow = !isSoftwareGl;
    group.add(cargoBox);

    const chassisRail = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 6.2), shared.trimMat);
    chassisRail.position.set(0, 0.38, 0);
    group.add(chassisRail);

    // Rear taillights & top amber clearance markers facing player (+Z)
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

    if (isCoupe) {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.06, 0.24), shared.trimMat);
      spoiler.position.set(0, 0.96, archetype.halfLength - 0.18);
      group.add(spoiler);
    }

    // Rear bumper & crisp red taillights (+Z facing camera)
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

  return { group, wheels };
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

    this._prewarmPool(18);
  }

  _prewarmPool(count) {
    for (let i = 0; i < count; i++) {
      const arch = VEHICLE_ARCHETYPES[i % VEHICLE_ARCHETYPES.length];
      const color = arch.colors[i % arch.colors.length];
      const built = buildTrafficVehicleMesh(arch, color, this.isSoftwareGl);
      built.group.visible = false;
      this.root.add(built.group);
      this.pool.push({
        id: this.nextId++,
        archetype: arch,
        mesh: built.group,
        wheels: built.wheels,
        laneIndex: 0,
        x: 0,
        z: -200,
        speedMps: arch.baseSpeedMps,
        halfWidth: arch.halfWidth,
        halfLength: arch.halfLength,
        nearMissAwarded: false,
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
  spawnWave(difficulty = 1) {
    const laneIndices = [0, 1, 2, 3];
    // Shuffle lanes
    for (let i = laneIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = laneIndices[i];
      laneIndices[i] = laneIndices[j];
      laneIndices[j] = tmp;
    }

    // Choose wave count: 1, 2, or up to 3 (always leaving >= 1 lane open!)
    const roll = Math.random();
    let desiredCount = 1;
    if (difficulty >= 4 && roll > 0.55) {
      desiredCount = 3;
    } else if (difficulty >= 2 && roll > 0.3) {
      desiredCount = 2;
    } else if (roll > 0.65) {
      desiredCount = 2;
    }

    // Reserve laneIndices[0] as guaranteed open lane; spawn in remaining lanes with staggered Z
    const candidateLanes = laneIndices.slice(1, 1 + desiredCount);
    const baseSpawnZ = -182;

    for (let i = 0; i < candidateLanes.length; i++) {
      const laneIdx = candidateLanes[i];
      // Stagger multi-car waves longitudinally so patterns feel organic and readable
      const staggerZ = i * -11.5 - Math.random() * 5;
      const z = baseSpawnZ + staggerZ;

      if (!this._isLaneClearAtZ(laneIdx, z, 24)) continue;

      const vehicle = this._acquireVehicle();
      if (!vehicle) break;

      const speedBoost = (difficulty - 1) * 1.4;
      vehicle.laneIndex = laneIdx;
      vehicle.x = LANE_CENTERS[laneIdx];
      vehicle.z = z;
      vehicle.speedMps = vehicle.archetype.baseSpeedMps + speedBoost + (Math.random() - 0.5) * 2.5;
      vehicle.nearMissAwarded = false;
      vehicle.collided = false;

      vehicle.mesh.position.set(vehicle.x, 0, vehicle.z);
      vehicle.mesh.visible = true;
      this.activeVehicles.push(vehicle);
    }
  }

  update(dt, playerSpeedMps, distanceMeters = 0) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt));

    // Smoothly ramp difficulty tier every 650m (up to Tier 8)
    this.difficultyLevel = Math.min(8, 1 + Math.floor(distanceMeters / 650));

    // Advance spawn timer faster as player drives faster & difficulty climbs
    if (playerSpeedMps > 8) {
      this.spawnTimer -= safeDt * (0.75 + playerSpeedMps / 42);
      if (this.spawnTimer <= 0) {
        this.spawnWave(this.difficultyLevel);
        const minInterval = Math.max(0.68, 1.55 - this.difficultyLevel * 0.11);
        this.spawnTimer = minInterval + Math.random() * 0.45;
      }
    }

    for (let i = this.activeVehicles.length - 1; i >= 0; i--) {
      const v = this.activeVehicles[i];
      // Traffic drives forward (-Z) at v.speedMps while world scrolls toward player (+Z) at playerSpeedMps
      const relativeSpeed = playerSpeedMps - v.speedMps;
      v.z += relativeSpeed * safeDt;
      v.mesh.position.set(v.x, 0, v.z);

      // Spin traffic wheels proportional to their own forward speed
      const spinDelta = -(v.speedMps * safeDt) / 0.32;
      for (let w = 0; w < v.wheels.length; w++) {
        v.wheels[w].rotation.x += spinDelta;
      }

      // Recycle once well behind camera (+28m) or pushed too far ahead (-230m)
      if (v.z > 28 || v.z < -230) {
        v.mesh.visible = false;
        this.activeVehicles.splice(i, 1);
        this.pool.push(v);
      }
    }
  }
}
