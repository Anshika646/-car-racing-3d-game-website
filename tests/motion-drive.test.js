// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeWheelGeometry,
  SteeringCalibration,
  GESTURE_STATUS,
} from '../src/controls/SteeringCalibration.js';
import { CameraController } from '../src/controls/CameraController.js';
import { HandTracker } from '../src/controls/HandTracker.js';
import { KeyboardController } from '../src/controls/KeyboardController.js';
import { Car, PLAYER_MAX_X, CAR_PAINT_PRESETS, CAR_MODEL_PRESETS } from '../src/game/Car.js';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DRIVER_NAME, RANDOM_RIVAL_NAMES } from '../src/game/Nameplate.js';
import { CollisionSystem } from '../src/game/CollisionSystem.js';
import { TrafficManager } from '../src/game/TrafficManager.js';
import {
  Game,
  GAME_STATE,
  BEST_SCORE_STORAGE_KEY,
  CAR_PAINT_STORAGE_KEY,
  CAR_MODEL_STORAGE_KEY,
  DRIVER_NAME_STORAGE_KEY,
  DRIVE_SETTINGS_STORAGE_KEY,
  ACCEL_CONTROL_MODES,
  SPEED_PRESETS,
  GEAR_PRESETS,
} from '../src/game/Game.js';

/**
 * Helper to synthesize a realistic 21-point MediaPipe hand landmark array
 * in raw (unmirrored) camera sensor coordinates [0..1].
 */
function createSyntheticHand(rawCenterX, rawCenterY, { openPalm = false } = {}) {
  const landmarks = [];
  for (let i = 0; i < 21; i++) {
    landmarks.push({ x: rawCenterX, y: rawCenterY, z: 0 });
  }
  // Wrist at bottom of palm
  landmarks[0] = { x: rawCenterX, y: rawCenterY + 0.05, z: 0 };
  // MCP knuckles
  landmarks[5] = { x: rawCenterX - 0.02, y: rawCenterY - 0.02, z: 0 };
  landmarks[9] = { x: rawCenterX, y: rawCenterY - 0.025, z: 0 };
  landmarks[13] = { x: rawCenterX + 0.015, y: rawCenterY - 0.02, z: 0 };
  landmarks[17] = { x: rawCenterX + 0.03, y: rawCenterY - 0.01, z: 0 };

  // PIP joints (6, 10, 14, 18) and fingertips (8, 12, 16, 20)
  const pipPairs = [
    [6, 8, -0.02],
    [10, 12, 0],
    [14, 16, 0.015],
    [18, 20, 0.03],
  ];
  for (const [pipIdx, tipIdx, xOff] of pipPairs) {
    landmarks[pipIdx] = { x: rawCenterX + xOff, y: rawCenterY - 0.05, z: 0 };
    landmarks[tipIdx] = {
      x: rawCenterX + xOff,
      // Open palm extends fingertips well above PIP; closed grip curls fingertips near wrist
      y: openPalm ? rawCenterY - 0.13 : rawCenterY + 0.01,
      z: 0,
    };
  }
  return landmarks;
}

describe('MOTION DRIVE 3D — Automated Verification Suite', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts without requesting webcam access on boot', () => {
    const getUserMediaSpy = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaSpy },
      configurable: true,
    });

    const game = new Game({ headless: true });
    expect(game.state).toBe(GAME_STATE.TITLE);
    expect(getUserMediaSpy).not.toHaveBeenCalled();
    game.dispose();
  });

  it('supports full keyboard controls (left, right, accelerate, brake, pause, restart)', () => {
    let pausedCount = 0;
    let restartCount = 0;
    const kb = new KeyboardController({
      onEscape: () => pausedCount++,
      onRestart: () => restartCount++,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
    let state = kb.update(0.1);
    expect(state.steer).toBeLessThan(-0.4);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    for (let i = 0; i < 6; i++) state = kb.update(0.05);
    expect(state.steer).toBeGreaterThan(0.5);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    state = kb.update(0.016);
    expect(state.accelerate).toBe(true);
    expect(state.brake).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    expect(pausedCount).toBe(1);
    expect(restartCount).toBe(1);

    // Mobile Touch Controls integration
    kb.reset();
    kb.setTouchInput('left', true);
    kb.setTouchInput('boost', true);
    state = kb.update(0.1);
    expect(state.steer).toBeLessThan(-0.4);
    expect(state.boost).toBe(true);
    kb.setTouchInput('left', false);
    kb.setTouchInput('brake', true);
    state = kb.update(0.016);
    expect(state.brake).toBe(true);

    kb.setTouchInput('brake', false);
    kb.setTouchInput('accelerate', true);
    state = kb.update(0.016);
    expect(state.accelerate).toBe(true);

    kb.dispose();
  });

  it('requests camera permission only on explicit requestCamera() call and handles denial gracefully', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const deniedError = new Error('User denied camera');
    deniedError.name = 'NotAllowedError';
    const getUserMediaMock = vi.fn().mockRejectedValue(deniedError);

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      configurable: true,
    });

    const cam = new CameraController();
    expect(getUserMediaMock).not.toHaveBeenCalled();

    await expect(cam.requestCamera([])).rejects.toMatchObject({
      title: 'Camera Permission Denied',
    });
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(cam.isActive).toBe(false);
    cam.dispose();
  });

  it('stops all MediaStreamTracks cleanly when exiting camera mode', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const stopTrackSpy = vi.fn();
    const fakeStream = {
      getVideoTracks: () => [{ readyState: 'live', stop: stopTrackSpy }],
      getTracks: () => [{ readyState: 'live', stop: stopTrackSpy }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
      configurable: true,
    });

    const cam = new CameraController();
    await cam.requestCamera([]);
    expect(cam.isActive).toBe(true);

    cam.stopCamera();
    expect(stopTrackSpy).toHaveBeenCalledTimes(1);
    expect(cam.isActive).toBe(false);
    cam.dispose();
  });

  it('detects both hands, calibrates neutral, and steers LEFT/RIGHT accurately with mirror compensation', () => {
    const cal = new SteeringCalibration(window.localStorage);

    // Physical LEFT hand sits on raw sensor RIGHT (rawX = 0.72)
    // Physical RIGHT hand sits on raw sensor LEFT (rawX = 0.28)
    const neutralLeftHand = createSyntheticHand(0.72, 0.50);
    const neutralRightHand = createSyntheticHand(0.28, 0.50);
    const neutralGeo = computeWheelGeometry([neutralLeftHand, neutralRightHand]);

    expect(neutralGeo.hasBothHands).toBe(true);
    expect(neutralGeo.handCount).toBe(2);
    expect(Math.abs(neutralGeo.rawAngleDeg)).toBeLessThan(1.0);

    // Hold neutral for 1.2s to auto-calibrate
    let holdResult = null;
    for (let i = 0; i < 15; i++) {
      holdResult = cal.feedCalibrationSample(neutralGeo, 0.1);
      if (holdResult.completedJustNow) break;
    }
    expect(cal.settings.isCalibrated).toBe(true);

    // Turn imaginary wheel COUNTER-CLOCKWISE (STEER LEFT):
    // Physical left hand (rawX=0.72) goes DOWN (y=0.64), physical right hand (rawX=0.28) goes UP (y=0.36)
    const steerLeftGeo = computeWheelGeometry([
      createSyntheticHand(0.72, 0.64),
      createSyntheticHand(0.28, 0.36),
    ]);

    let leftEval = null;
    for (let i = 0; i < 12; i++) {
      leftEval = cal.evaluate(steerLeftGeo, 0.032);
    }
    expect(leftEval.steer).toBeLessThan(-0.35);
    expect(leftEval.status).toBe(GESTURE_STATUS.STEER_LEFT);

    // Turn imaginary wheel CLOCKWISE (STEER RIGHT):
    // Physical left hand (rawX=0.72) goes UP (y=0.36), physical right hand (rawX=0.28) goes DOWN (y=0.64)
    const steerRightGeo = computeWheelGeometry([
      createSyntheticHand(0.72, 0.36),
      createSyntheticHand(0.28, 0.64),
    ]);

    let rightEval = null;
    for (let i = 0; i < 16; i++) {
      rightEval = cal.evaluate(steerRightGeo, 0.032);
    }
    expect(rightEval.steer).toBeGreaterThan(0.35);
    expect(rightEval.status).toBe(GESTURE_STATUS.STEER_RIGHT);
  });

  it('decays steering safely back toward neutral (0) when tracking is lost', () => {
    const cal = new SteeringCalibration(window.localStorage);
    cal.captureNeutral(0);

    // Steer hard right first
    const rightGeo = computeWheelGeometry([
      createSyntheticHand(0.72, 0.32),
      createSyntheticHand(0.28, 0.68),
    ]);
    for (let i = 0; i < 10; i++) cal.evaluate(rightGeo, 0.032);
    expect(cal.smoothedSteer).toBeGreaterThan(0.4);

    // Hands leave camera frame -> must decay smoothly to 0 and warn TRACKING LOST
    const lostGeo = computeWheelGeometry([], []);
    let lostEval = null;
    for (let i = 0; i < 30; i++) {
      lostEval = cal.evaluate(lostGeo, 0.05);
    }
    expect(Math.abs(lostEval.steer)).toBeLessThan(0.02);
    expect(lostEval.trackingLost).toBe(true);
    expect(lostEval.status).toBe(GESTURE_STATUS.TRACKING_LOST);
  });

  it('detects closed-grip gas, open-palm braking (2-hand & 1-hand), and 0-hand coasting in default grip_gas_palm_brake mode', () => {
    const cal = new SteeringCalibration(window.localStorage);
    expect(cal.settings.pedalMode).toBe('grip_gas_palm_brake');
    cal.captureNeutral(0);

    // 2-hand closed grip -> accelerates
    const closedTwoHandsGeo = computeWheelGeometry([
      createSyntheticHand(0.72, 0.5, { openPalm: false }),
      createSyntheticHand(0.28, 0.5, { openPalm: false }),
    ]);
    const gasTwoRes = cal.evaluate(closedTwoHandsGeo, 0.032);
    expect(gasTwoRes.throttle).toBe(true);
    expect(gasTwoRes.brake).toBe(false);
    expect(gasTwoRes.pedalGesture).toBe('GAS');

    // 2-hand open palms -> brakes
    const openPalmsGeo = computeWheelGeometry([
      createSyntheticHand(0.72, 0.5, { openPalm: true }),
      createSyntheticHand(0.28, 0.5, { openPalm: true }),
    ]);
    expect(openPalmsGeo.openPalmCount).toBe(2);
    const brakeTwoRes = cal.evaluate(openPalmsGeo, 0.032);
    expect(brakeTwoRes.brake).toBe(true);
    expect(brakeTwoRes.throttle).toBe(false);
    expect(brakeTwoRes.pedalGesture).toBe('BRAKE');

    // 1-hand closed grip -> accelerates, 1-hand open palm -> brakes
    const closedOneHandGeo = computeWheelGeometry([
      createSyntheticHand(0.5, 0.5, { openPalm: false }),
    ]);
    const gasOneRes = cal.evaluate(closedOneHandGeo, 0.032);
    expect(gasOneRes.throttle).toBe(true);
    expect(gasOneRes.brake).toBe(false);

    const openOneHandGeo = computeWheelGeometry([
      createSyntheticHand(0.5, 0.5, { openPalm: true }),
    ]);
    const brakeOneRes = cal.evaluate(openOneHandGeo, 0.032);
    expect(brakeOneRes.brake).toBe(true);
    expect(brakeOneRes.throttle).toBe(false);

    // 0 hands (tracking lost) -> coasts safely (neither gas nor brake)
    const zeroHandsGeo = computeWheelGeometry([]);
    const coastRes = cal.evaluate(zeroHandsGeo, 0.032);
    expect(coastRes.throttle).toBe(false);
    expect(coastRes.brake).toBe(false);
    expect(coastRes.pedalGesture).toBe('COAST');
  });

  it('clamps the player car strictly inside highway boundaries', () => {
    const car = new Car({ isSoftwareGl: true });

    // Full left lock for 5 seconds
    for (let i = 0; i < 100; i++) {
      car.update(0.05, { steer: -1, speedMps: 45 });
    }
    expect(car.x).toBeGreaterThanOrEqual(-PLAYER_MAX_X);
    expect(car.x).toBeCloseTo(-PLAYER_MAX_X, 2);

    // Full right lock for 5 seconds
    for (let i = 0; i < 100; i++) {
      car.update(0.05, { steer: 1, speedMps: 45 });
    }
    expect(car.x).toBeLessThanOrEqual(PLAYER_MAX_X);
    expect(car.x).toBeCloseTo(PLAYER_MAX_X, 2);
  });

  it('guarantees at least one open lane per spawned traffic wave', () => {
    const traffic = new TrafficManager({ isSoftwareGl: true });
    for (let wave = 0; wave < 25; wave++) {
      traffic.reset();
      traffic.spawnWave(8); // Maximum difficulty tier
      const occupiedLanes = new Set(traffic.activeVehicles.map((v) => v.laneIndex));
      expect(occupiedLanes.size).toBeLessThanOrEqual(3); // Out of 4 lanes, >= 1 is always open
    }
  });

  it('triggers shield damage on non-fatal hits, transitions to GAMEOVER on fatal crash, updates best score, and resets cleanly', () => {
    const game = new Game({ headless: true });
    game.beginRaceCountdown();
    game.state = GAME_STATE.RACING;

    // Advance 2.5 seconds of clean player-accelerated driving from standing 0 km/h start -> score & distance increase
    for (let i = 0; i < 50; i++) {
      game.stepSimulation(0.05, { steer: 0, accelerate: true, brake: false });
    }
    expect(game.distanceMeters).toBeGreaterThan(50);
    expect(game.score).toBeGreaterThan(30);

    // Place 3 sequential unavoidable traffic collisions to deplete 3 hull bars
    for (let hit = 1; hit <= 3; hit++) {
      game.car.invulnerableTimer = 0;
      const obstacle = {
        id: 900 + hit,
        x: game.car.x,
        z: game.car.z,
        speedMps: 0,
        halfWidth: 1.0,
        halfLength: 2.1,
        mesh: { position: { set: () => {} }, visible: true },
        wheels: [],
        collided: false,
        nearMissAwarded: false,
      };
      game.traffic.activeVehicles = [obstacle];
      game.stepSimulation(0.032, { steer: 0 });
    }

    expect(game.collisionSystem.health).toBe(0);
    expect(game.state).toBe(GAME_STATE.CRASHING);

    // Advance crash spin animation until GAMEOVER finalizes
    for (let i = 0; i < 30; i++) {
      game.stepSimulation(0.05);
    }
    expect(game.state).toBe(GAME_STATE.GAMEOVER);
    expect(game.bestScore).toBeGreaterThan(0);
    expect(Number(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY))).toBe(game.bestScore);

    // Restart resets current race metrics while preserving personal best
    const savedBest = game.bestScore;
    game.beginRaceCountdown();
    expect(game.score).toBe(0);
    expect(game.distanceMeters).toBe(0);
    expect(game.collisionSystem.health).toBe(3);
    expect(game.car.x).toBe(0);
    expect(game.bestScore).toBe(savedBest);

    game.dispose();
  });

  it('handles browser resize safely and does not crash when MediaPipe fails to load', async () => {
    const brokenTracker = new HandTracker({
      visionModuleLoader: async () => {
        throw new Error('Simulated offline network failure');
      },
    });

    await expect(brokenTracker.initialize()).rejects.toMatchObject({
      title: 'Hand Tracking Unavailable',
    });
    expect(brokenTracker.isReady).toBe(false);

    // Resize updates camera aspect & renderer dimensions safely
    const game = new Game({ headless: true });
    const updateProjSpy = vi.fn();
    const setSizeSpy = vi.fn();
    const setPixelRatioSpy = vi.fn();
    game.camera = { aspect: 1, updateProjectionMatrix: updateProjSpy };
    game.renderer = { setSize: setSizeSpy, setPixelRatio: setPixelRatioSpy };

    game.handleResize(1920, 1080);
    expect(game.camera.aspect).toBeCloseTo(1920 / 1080, 4);
    expect(updateProjSpy).toHaveBeenCalledTimes(1);
    expect(setSizeSpy).toHaveBeenCalledWith(1920, 1080);

    game.dispose();
  });

  it('switches car colour & finish presets dynamically and persists selection in localStorage', () => {
    const game = new Game({ headless: true });
    expect(CAR_PAINT_PRESETS.length).toBeGreaterThanOrEqual(6);

    game.setCarPaint('rosso_gloss');
    expect(game.carPaint).toBe('rosso_gloss');
    expect(game.car.paintPresetId).toBe('rosso_gloss');
    expect(window.localStorage.getItem(CAR_PAINT_STORAGE_KEY)).toBe('rosso_gloss');

    game.setCarPaint('stealth_matte');
    expect(game.car.bodyPaintMat.clearcoat).toBeLessThan(0.5);

    game.dispose();
  });

  it('switches between all 4 distinct 3D car models and persists selection in localStorage', () => {
    const game = new Game({ headless: true });
    expect(CAR_MODEL_PRESETS.length).toBe(4);

    for (const model of CAR_MODEL_PRESETS) {
      game.setCarModel(model.id);
      expect(game.carModel).toBe(model.id);
      expect(game.car.modelPresetId).toBe(model.id);
      expect(game.car.wheelSpinGroups.length).toBe(4);
      expect(window.localStorage.getItem(CAR_MODEL_STORAGE_KEY)).toBe(model.id);
    }

    game.dispose();
  });

  it('updates floating 3D driver nameplate above player car and assigns random names to highway rivals', () => {
    const game = new Game({ headless: true });
    expect(DEFAULT_DRIVER_NAME).toBe('T56');
    expect(game.driverName).toBe('T56');

    game.setDriverName('T56_GT');
    expect(game.driverName).toBe('T56_GT');
    expect(game.car.driverName).toBe('T56_GT');
    expect(game.car.nameplate.userData.driverName).toBe('T56_GT');
    expect(window.localStorage.getItem(DRIVER_NAME_STORAGE_KEY)).toBe('T56_GT');

    // Spawn highway rivals and verify random floating gamer names are assigned
    game.traffic.reset();
    game.traffic.spawnWave(6);
    expect(game.traffic.activeVehicles.length).toBeGreaterThanOrEqual(1);
    for (const rival of game.traffic.activeVehicles) {
      expect(typeof rival.driverName).toBe('string');
      expect(rival.driverName.length).toBeGreaterThan(2);
      expect(RANDOM_RIVAL_NAMES).toContain(rival.driverName);
      expect(rival.nameplate.userData.driverName).toBe(rival.driverName);
    }

    game.dispose();
  });

  it('engages Hyper Nitro Boost for higher top speed and cycles camera views & track atmospheres', () => {
    const game = new Game({ headless: true });
    game.beginRaceCountdown();
    game.state = GAME_STATE.RACING;
    game.traffic.activeVehicles = [];

    const initialNitro = game.nitroCharge;
    for (let i = 0; i < 20; i++) {
      game.traffic.activeVehicles = [];
      game.stepSimulation(0.05, { steer: 0, accelerate: true, brake: false, boost: true });
    }
    expect(game.nitroCharge).toBeLessThan(initialNitro);
    expect(game.speedMps).toBeGreaterThan(36);

    const initialCam = game.cameraView;
    const nextCam = game.cycleCameraView();
    expect(nextCam).not.toBe(initialCam);

    game.setAtmosphere('sunset');
    expect(game.atmosphere).toBe('sunset');

    game.dispose();
  });

  it('supports seamless 1-hand camera calibration and steering (for phone selfie or single-hand grip)', () => {
    const cal = new SteeringCalibration(window.localStorage);

    // Center single hand at rawX = 0.50 -> mirroredX = 0.50
    const centerOneHand = computeWheelGeometry([createSyntheticHand(0.5, 0.5)]);
    expect(centerOneHand.handCount).toBe(1);

    for (let i = 0; i < 15; i++) {
      const res = cal.feedCalibrationSample(centerOneHand, 0.1);
      if (res.completedJustNow) break;
    }
    expect(cal.settings.isCalibrated).toBe(true);

    // Move hand physically LEFT (rawX = 0.72 -> mirroredX = 0.28)
    const leftOneHand = computeWheelGeometry([createSyntheticHand(0.72, 0.5)]);
    let leftRes = null;
    for (let i = 0; i < 12; i++) {
      leftRes = cal.evaluate(leftOneHand, 0.032);
    }
    expect(leftRes.trackingLost).toBe(false);
    expect(leftRes.steer).toBeLessThan(-0.25);
    expect(leftRes.status).toBe(GESTURE_STATUS.STEER_LEFT);

    // Move hand physically RIGHT (rawX = 0.28 -> mirroredX = 0.72)
    const rightOneHand = computeWheelGeometry([createSyntheticHand(0.28, 0.5)]);
    let rightRes = null;
    for (let i = 0; i < 14; i++) {
      rightRes = cal.evaluate(rightOneHand, 0.032);
    }
    expect(rightRes.trackingLost).toBe(false);
    expect(rightRes.steer).toBeGreaterThan(0.25);
    expect(rightRes.status).toBe(GESTURE_STATUS.STEER_RIGHT);
  });

  it('provides honest 0–180 km/h Speed Control, 6-Position Gearbox (Keys 0–5), Manual Gas speed cap, and full-stop braking', () => {
    const game = new Game({ headless: true });
    expect(ACCEL_CONTROL_MODES.length).toBe(3);
    expect(SPEED_PRESETS.length).toBe(4);
    expect(GEAR_PRESETS.length).toBe(6);

    // Defaults to Speed Dial + Pedals at 75 km/h (Gear 2 · Smooth)
    const defaultSummary = game.getDriveSpeedSummary();
    expect(defaultSummary.accelMode).toBe('smooth_auto');
    expect(defaultSummary.targetKmh).toBe(75);
    expect(defaultSummary.activeGear).toBe(2);

    // Direct 0–180 km/h Speed Slider & Gear shortcuts (Keys 0–5)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
    expect(game.driveSettings.targetKmh).toBe(45);
    expect(game.getDriveSpeedSummary().activeGear).toBe(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4' }));
    expect(game.driveSettings.targetKmh).toBe(140);
    expect(game.getDriveSpeedSummary().activeGear).toBe(4);

    // Keyboard [+] / [-] and [E] / [Q] step target speed by ±10 km/h, [X] / [0] shifts to STOP (0 km/h)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Equal' }));
    expect(game.driveSettings.targetKmh).toBe(150);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Minus' }));
    expect(game.driveSettings.targetKmh).toBe(140);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    expect(game.driveSettings.targetKmh).toBe(130);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    expect(game.driveSettings.targetKmh).toBe(140);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
    expect(game.driveSettings.targetKmh).toBe(0);
    expect(game.getDriveSpeedSummary().activeGear).toBe(0);

    // Persisted in localStorage
    const chillSummary = game.applySpeedPreset('chill');
    expect(chillSummary.targetKmh).toBe(45);
    const stored = JSON.parse(window.localStorage.getItem(DRIVE_SETTINGS_STORAGE_KEY));
    expect(stored.targetKmh).toBe(45);

    // [M] cycles through all 3 throttle styles cleanly
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    expect(game.driveSettings.accelMode).toBe('manual_throttle');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    expect(game.driveSettings.accelMode).toBe('constant_cruise');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    expect(game.driveSettings.accelMode).toBe('smooth_auto');

    // Speed Dial + Pedals in Camera Mode: holding 2-hand wheel grip cruises honestly at exact targetKmh (60 km/h) without overspeeding
    const closedGripGeo = computeWheelGeometry([
      createSyntheticHand(0.72, 0.5, { openPalm: false }),
      createSyntheticHand(0.28, 0.5, { openPalm: false }),
    ]);
    game.calibration.captureNeutral(0);
    game.handTracker.detect = () => closedGripGeo;
    game.handTracker.renderOverlay = () => {};
    game.controlMode = 'camera';
    game.setTargetSpeedKmh(60);
    game.beginRaceCountdown();
    game.state = GAME_STATE.RACING;
    game.traffic.activeVehicles = [];
    for (let i = 0; i < 80; i++) {
      game.traffic.activeVehicles = [];
      game.stepSimulation(0.05);
    }
    expect(Math.round(game.speedMps * 3.6)).toBe(60);

    // Shifting to Gear 0 (0 km/h) glides smoothly to a complete stop
    game.setGear(0);
    for (let i = 0; i < 80; i++) {
      game.traffic.activeVehicles = [];
      game.stepSimulation(0.05, { steer: 0, accelerate: false, brake: false, boost: false });
    }
    expect(game.speedMps).toBe(0);

    // Manual Gas Pedal: starts at 0 km/h, stays at 0 when Gas is released, caps cleanly at chosen targetKmh (54 km/h) when Gas is held, and coasts back to 0 km/h
    game.controlMode = 'keyboard';
    game.setDriveSettings({
      accelMode: 'manual_throttle',
      targetKmh: 54,
      accelRate: 1.0,
      throttleLevel: 0,
    });
    game.beginRaceCountdown();
    game.state = GAME_STATE.RACING;
    game.traffic.activeVehicles = [];
    expect(game.speedMps).toBe(0);

    for (let i = 0; i < 10; i++) {
      game.traffic.activeVehicles = [];
      game.stepSimulation(0.05, { steer: 0, accelerate: false, brake: false, boost: false });
    }
    expect(game.speedMps).toBe(0);

    for (let i = 0; i < 60; i++) {
      game.traffic.activeVehicles = [];
      game.stepSimulation(0.05, { steer: 0, accelerate: true, brake: false, boost: false });
    }
    expect(Math.round(game.speedMps * 3.6)).toBe(54);

    for (let i = 0; i < 80; i++) {
      game.traffic.activeVehicles = [];
      game.stepSimulation(0.05, { steer: 0, accelerate: false, brake: false, boost: false });
    }
    expect(game.speedMps).toBe(0);

    // Holding Brake stops crisply to 0 km/h even in Locked Cruise mode
    game.setDriveSettings({ accelMode: 'constant_cruise', targetKmh: 90, accelRate: 1.0 });
    for (let i = 0; i < 50; i++) {
      game.traffic.activeVehicles = [];
      game.stepSimulation(0.05, { steer: 0, accelerate: false, brake: false, boost: false });
    }
    expect(Math.round(game.speedMps * 3.6)).toBe(90);

    for (let i = 0; i < 50; i++) {
      game.traffic.activeVehicles = [];
      game.stepSimulation(0.05, { steer: 0, accelerate: false, brake: true, boost: false });
    }
    expect(game.speedMps).toBe(0);

    game.dispose();
  });

  it('supports Two-Page Website navigation (#garage <-> #race) and showroom camera angles', () => {
    const game = new Game({ headless: true });
    expect(game.activePage).toBe('garage');
    expect(game.showroomAngle).toBe('orbit');

    expect(game.setShowroomAngle('side')).toBe('side');
    expect(game.showroomAngle).toBe('side');

    expect(game.navigateToPage('race')).toBe('race');
    expect(game.activePage).toBe('race');

    expect(game.navigateToPage('garage')).toBe('garage');
    expect(game.activePage).toBe('garage');
    expect(game.state).toBe(GAME_STATE.TITLE);

    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('data-page-section="garage"');
    expect(html).toContain('data-page-section="race"');
    expect(html).toContain('id="site-navbar"');

    game.dispose();
  });

  it('uses exclusively T56 credits across index.html and README.md', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const readme = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf8');

    expect(html).toContain('T56');
    expect(html).toContain('Credits: <strong class="text-[#ffe224]">T56</strong>');
    expect(html).not.toMatch(/Made by/i);
    expect(readme).toContain('**Credits:** T56');
    expect(readme).not.toMatch(/Made by/i);
  });
});
