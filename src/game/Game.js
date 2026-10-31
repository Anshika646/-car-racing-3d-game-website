/**
 * Game.js
 *
 * Core orchestrator for MOTION DRIVE 3D:
 * - Three.js WebGLRenderer, RoomEnvironment PBR reflections, dynamic atmosphere lighting
 * - 4 selectable 3D Car Models + 8 Paint Finishes + Live Editable 3D Floating Driver Nameplate
 * - Named Highway Rival Traffic with random gamer tags, Overtake Combo Streaks & Hyper Nitro Boost
 * - 3 Camera Views (Chase / Action Close / Hood)
 * - Real-time MediaPipe webcam hand-wheel steering + smooth Keyboard fallback
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Car, CAR_MODEL_PRESETS, CAR_PAINT_PRESETS } from './Car.js';
import { Road, ATMOSPHERE_PRESETS } from './Road.js';
import { TrafficManager } from './TrafficManager.js';
import { CollisionSystem } from './CollisionSystem.js';
import { AudioSystem } from './AudioSystem.js';
import {
  sanitizeDriverName,
  DEFAULT_DRIVER_NAME,
  RANDOM_RIVAL_NAMES,
} from './Nameplate.js';
import { CameraController } from '../controls/CameraController.js';
import { HandTracker } from '../controls/HandTracker.js';
import { SteeringCalibration, GESTURE_STATUS } from '../controls/SteeringCalibration.js';
import { KeyboardController } from '../controls/KeyboardController.js';
import { HUD } from '../ui/HUD.js';
import { Menu } from '../ui/Menu.js';
import { GameOver } from '../ui/GameOver.js';

export const BEST_SCORE_STORAGE_KEY = 'motion_drive_3d_best_score_v1';
export const QUALITY_STORAGE_KEY = 'motion_drive_3d_quality_v1';
export const CAR_PAINT_STORAGE_KEY = 'motion_drive_3d_car_paint_v1';
export const CAR_MODEL_STORAGE_KEY = 'motion_drive_3d_car_model_v1';
export const DRIVER_NAME_STORAGE_KEY = 'motion_drive_3d_driver_name_v1';
export const ATMOSPHERE_STORAGE_KEY = 'motion_drive_3d_atmosphere_v1';
export const DRIVE_SETTINGS_STORAGE_KEY = 'motion_drive_3d_drive_settings_v3';

export const GEAR_PRESETS = [
  { gear: 0, label: 'STOP', shortLabel: '0', targetKmh: 0, speedScale: 0.45 },
  { gear: 1, label: 'Gear 1 · Chill', shortLabel: 'G1', targetKmh: 45, speedScale: 0.55 },
  { gear: 2, label: 'Gear 2 · Smooth', shortLabel: 'G2', targetKmh: 75, speedScale: 0.85 },
  { gear: 3, label: 'Gear 3 · Cruise', shortLabel: 'G3', targetKmh: 105, speedScale: 1.0 },
  { gear: 4, label: 'Gear 4 · Fast', shortLabel: 'G4', targetKmh: 140, speedScale: 1.2 },
  { gear: 5, label: 'Gear 5 · Hyper', shortLabel: 'G5', targetKmh: 180, speedScale: 1.4 },
];

export const ACCEL_CONTROL_MODES = [
  {
    id: 'smooth_auto',
    name: 'Speed Dial + Pedals',
    shortName: 'Speed Dial',
    description:
      'Cruises smoothly at your chosen KM/H speed — shift Gears 0–5, drag the Speed Slider, hold W to pass faster, or press S / Open Palm to brake to 0 km/h.',
  },
  {
    id: 'manual_throttle',
    name: 'Manual Gas Pedal',
    shortName: 'Manual Gas',
    description:
      'Stays at 0 km/h until you hold W / GAS / Hand Grip, accelerating smoothly up to your chosen Speed Limit and coasting to a stop when released.',
  },
  {
    id: 'constant_cruise',
    name: 'Locked Cruise Speed',
    shortName: 'Locked',
    description:
      'Locks vehicle speed at your exact KM/H setting so you focus 100% on steering (Brake still stops to 0 km/h anytime).',
  },
];

export const SPEED_PRESETS = [
  { id: 'chill', name: 'Chill', targetKmh: 45, speedScale: 0.55, accelRate: 0.6 },
  { id: 'smooth', name: 'Smooth', targetKmh: 75, speedScale: 0.85, accelRate: 0.85 },
  { id: 'arcade', name: 'Arcade', targetKmh: 110, speedScale: 1.05, accelRate: 1.1 },
  { id: 'pro', name: 'Pro', targetKmh: 155, speedScale: 1.35, accelRate: 1.35 },
];

export const DEFAULT_DRIVE_SETTINGS = {
  accelMode: 'smooth_auto',
  targetKmh: 75,
  speedScale: 0.85,
  accelRate: 0.85,
  throttleLevel: 0,
};

export const CAMERA_VIEWS = ['chase', 'close', 'hood'];

export const GAME_STATE = {
  TITLE: 'TITLE',
  CALIBRATING: 'CALIBRATING',
  COUNTDOWN: 'COUNTDOWN',
  RACING: 'RACING',
  PAUSED: 'PAUSED',
  CRASHING: 'CRASHING',
  GAMEOVER: 'GAMEOVER',
};

const _lookTarget = new THREE.Vector3();

function detectSoftwareWebGL() {
  if (typeof document === 'undefined') return true;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class Game {
  constructor(options = {}) {
    this.container =
      options.container ||
      (typeof document !== 'undefined' ? document.getElementById('canvas-container') : null);
    this.storage = options.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    this.headless = Boolean(options.headless);

    this.state = GAME_STATE.TITLE;
    this.activePage =
      typeof window !== 'undefined' && window.location?.hash === '#race' ? 'race' : 'garage';
    this.showroomAngle = 'orbit'; // 'orbit' | 'front' | 'side' | 'rear'
    this.controlMode = 'keyboard'; // 'camera' | 'keyboard'
    this.cameraView = 'chase'; // 'chase' | 'close' | 'hood'
    this.quality = this._loadQuality();
    this.carModel = this._loadCarModel();
    this.carPaint = this._loadCarPaint();
    this.driverName = this._loadDriverName();
    this.atmosphere = this._loadAtmosphere();
    this.driveSettings = this._loadDriveSettings();
    this.bestScore = this._loadBestScore();

    // Gameplay metrics
    this.score = 0;
    this.distanceMeters = 0;
    this.speedMps = 14;
    this.topSpeedKmh = 0;
    this.nearMisses = 0;
    this.overtakes = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboDecayTimer = 0;
    this.nitroCharge = 100;
    this.isBoosting = false;
    this.hudGasPressed = false;
    this.hudBrakePressed = false;
    this.hudNitroPressed = false;
    this.countdownTimer = 0;
    this.lastCountdownDigit = -1;
    this.cameraShake = 0;
    this.calibrationReturnState = GAME_STATE.TITLE;

    // Subsystems
    this.calibration = new SteeringCalibration(this.storage);
    this.cameraController = options.cameraController || new CameraController();
    this.handTracker = options.handTracker || new HandTracker();
    this.collisionSystem = new CollisionSystem({ maxHealth: 3 });
    this.audio = new AudioSystem(this.storage);

    this.keyboard = new KeyboardController({
      onEscape: () => this.handleEscapeKey(),
      onRestart: () => this.handleRestartShortcut(),
      onToggleHud: () => {
        if (this.state === GAME_STATE.RACING || this.state === GAME_STATE.COUNTDOWN) {
          this.hud?.toggleDock();
        }
      },
      onCycleCamera: () => {
        if (this.state === GAME_STATE.RACING || this.state === GAME_STATE.COUNTDOWN) {
          this.cycleCameraView();
        }
      },
      onAdjustSpeed: (delta) => {
        this.adjustTargetSpeedKmh(delta > 0 ? 10 : -10);
      },
      onCycleAccelMode: () => {
        this.cycleAccelMode();
      },
      onAdjustThrottle: (delta) => {
        this.adjustTargetSpeedKmh(delta > 0 ? 10 : -10);
      },
      onZeroThrottle: () => {
        this.setGear(0);
      },
      onSelectGear: (gearNum) => {
        this.setGear(gearNum);
      },
    });

    this.frameId = 0;
    this.isDisposed = false;
    this.isSoftwareGl = false;

    // Camera rig smoothing state
    this.camPos = new THREE.Vector3(-2.4, 2.2, 5.8);
    this.camLook = new THREE.Vector3(-1.2, 0.85, -5.5);
    this.camBank = 0;
    this.smoothedDt = 1 / 60;

    if (typeof window !== 'undefined' && !this.headless) {
      this._onHashChange = () => {
        const hashPage = window.location.hash === '#race' ? 'race' : 'garage';
        if (hashPage !== this.activePage) {
          this.navigateToPage(hashPage, { updateHash: false });
        }
      };
      window.addEventListener('hashchange', this._onHashChange);
    }

    if (!this.headless) {
      this._initUI();
      this._initThree();
    } else {
      this.car = new Car({
        isSoftwareGl: true,
        modelPresetId: this.carModel,
        paintPresetId: this.carPaint,
        driverName: this.driverName,
      });
      this.road = new Road({ isSoftwareGl: true, quality: 'low' });
      this.road.setAtmosphere(this.atmosphere);
      this.traffic = new TrafficManager({ isSoftwareGl: true });
    }
  }

  _loadBestScore() {
    if (!this.storage) return 0;
    try {
      const val = Number(this.storage.getItem(BEST_SCORE_STORAGE_KEY));
      return Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
    } catch {
      return 0;
    }
  }

  _saveBestScore(score) {
    const rounded = Math.floor(score);
    if (rounded > this.bestScore) {
      this.bestScore = rounded;
      if (this.storage) {
        try {
          this.storage.setItem(BEST_SCORE_STORAGE_KEY, String(this.bestScore));
        } catch {
          // Ignore quota errors
        }
      }
      return true;
    }
    return false;
  }

  _loadQuality() {
    if (!this.storage) return 'high';
    try {
      const saved = this.storage.getItem(QUALITY_STORAGE_KEY);
      if (saved === 'high' || saved === 'medium' || saved === 'low') return saved;
    } catch {
      // Ignore
    }
    return 'high';
  }

  setQuality(quality) {
    if (!['high', 'medium', 'low'].includes(quality)) return;
    this.quality = quality;
    if (this.storage) {
      try {
        this.storage.setItem(QUALITY_STORAGE_KEY, quality);
      } catch {
        // Ignore
      }
    }

    if (this.renderer && !this.isSoftwareGl) {
      const pixelRatioCap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
      this.renderer.shadowMap.enabled = quality === 'high';
      if (this.keyLight) {
        this.keyLight.castShadow = quality === 'high';
      }
    }

    this.road?.setQuality(quality);
    this.menu?.setQualityState(quality);
  }

  _loadCarModel() {
    if (!this.storage) return CAR_MODEL_PRESETS[0].id;
    try {
      const saved = this.storage.getItem(CAR_MODEL_STORAGE_KEY);
      if (saved && CAR_MODEL_PRESETS.some((m) => m.id === saved)) return saved;
    } catch {
      // Ignore
    }
    return CAR_MODEL_PRESETS[0].id;
  }

  setCarModel(modelId) {
    const valid = CAR_MODEL_PRESETS.find((m) => m.id === modelId) || CAR_MODEL_PRESETS[0];
    this.carModel = valid.id;
    if (this.storage) {
      try {
        this.storage.setItem(CAR_MODEL_STORAGE_KEY, valid.id);
      } catch {
        // Ignore
      }
    }
    this.car?.setModelPreset(valid.id);
    this.menu?.setCarModelState(valid.id);
  }

  _loadCarPaint() {
    if (!this.storage) return CAR_PAINT_PRESETS[0].id;
    try {
      const saved = this.storage.getItem(CAR_PAINT_STORAGE_KEY);
      if (saved && CAR_PAINT_PRESETS.some((p) => p.id === saved)) {
        return saved;
      }
    } catch {
      // Ignore
    }
    return CAR_PAINT_PRESETS[0].id;
  }

  setCarPaint(presetId) {
    const valid = CAR_PAINT_PRESETS.find((p) => p.id === presetId) || CAR_PAINT_PRESETS[0];
    this.carPaint = valid.id;
    if (this.storage) {
      try {
        this.storage.setItem(CAR_PAINT_STORAGE_KEY, valid.id);
      } catch {
        // Ignore
      }
    }
    this.car?.setPaintPreset(valid.id);
    this.menu?.setCarPaintState(valid.id);
  }

  _loadDriverName() {
    if (!this.storage) return DEFAULT_DRIVER_NAME;
    try {
      const saved = this.storage.getItem(DRIVER_NAME_STORAGE_KEY);
      if (saved) return sanitizeDriverName(saved, DEFAULT_DRIVER_NAME);
    } catch {
      // Ignore
    }
    return DEFAULT_DRIVER_NAME;
  }

  setDriverName(rawName, source = null) {
    const cleaned = sanitizeDriverName(rawName, DEFAULT_DRIVER_NAME);
    this.driverName = cleaned;
    if (this.storage) {
      try {
        this.storage.setItem(DRIVER_NAME_STORAGE_KEY, cleaned);
      } catch {
        // Ignore
      }
    }
    this.car?.setDriverName(cleaned);
    this.menu?.setDriverNameState(cleaned, source);
    return cleaned;
  }

  randomizeDriverName() {
    const pick =
      RANDOM_RIVAL_NAMES[Math.floor(Math.random() * RANDOM_RIVAL_NAMES.length)].toUpperCase();
    return this.setDriverName(pick, null);
  }

  _loadAtmosphere() {
    if (!this.storage) return ATMOSPHERE_PRESETS[0].id;
    try {
      const saved = this.storage.getItem(ATMOSPHERE_STORAGE_KEY);
      if (saved && ATMOSPHERE_PRESETS.some((t) => t.id === saved)) return saved;
    } catch {
      // Ignore
    }
    return ATMOSPHERE_PRESETS[0].id;
  }

  setAtmosphere(themeId) {
    const preset =
      ATMOSPHERE_PRESETS.find((t) => t.id === themeId) || ATMOSPHERE_PRESETS[0];
    this.atmosphere = preset.id;
    if (this.storage) {
      try {
        this.storage.setItem(ATMOSPHERE_STORAGE_KEY, preset.id);
      } catch {
        // Ignore
      }
    }

    this.road?.setAtmosphere(preset.id);
    if (this.scene) {
      this.scene.background = new THREE.Color(preset.skyHex);
      if (this.scene.fog) {
        this.scene.fog.color.setHex(preset.skyHex);
        this.scene.fog.density = preset.fogDensity ?? 0.0085;
      }
    }
    if (this.hemiLight) {
      this.hemiLight.color.setHex(preset.hemiSkyHex);
      this.hemiLight.groundColor.setHex(preset.hemiGroundHex);
      this.hemiLight.intensity = preset.hemiIntensity ?? 1.0;
    }
    if (this.keyLight) {
      this.keyLight.color.setHex(preset.keyLightHex);
      this.keyLight.intensity = preset.keyIntensity ?? 1.75;
    }
    if (this.rimLight) {
      this.rimLight.color.setHex(preset.rimLightHex);
      this.rimLight.intensity = preset.rimIntensity ?? 1.05;
    }
    this.menu?.setAtmosphereState(preset.id);
  }

  _sanitizeDriveSettings(raw = {}) {
    const validMode = ACCEL_CONTROL_MODES.some((m) => m.id === raw.accelMode)
      ? raw.accelMode
      : DEFAULT_DRIVE_SETTINGS.accelMode;
    const rawTarget = Number(raw.targetKmh);
    const targetKmh = Number.isFinite(rawTarget)
      ? Math.round(Math.max(0, Math.min(180, rawTarget)))
      : DEFAULT_DRIVE_SETTINGS.targetKmh;
    const rawSpeed = Number(raw.speedScale);
    const derivedScale =
      targetKmh <= 0 ? 0.45 : Number(Math.max(0.45, Math.min(1.4, targetKmh / 100)).toFixed(2));
    const speedScale = Number.isFinite(rawSpeed)
      ? Number(Math.max(0.45, Math.min(1.4, rawSpeed)).toFixed(2))
      : derivedScale;
    const rawAccel = Number(raw.accelRate);
    const accelRate = Number.isFinite(rawAccel)
      ? Number(Math.max(0.35, Math.min(1.5, rawAccel)).toFixed(2))
      : DEFAULT_DRIVE_SETTINGS.accelRate;
    const rawThrottle = Number(raw.throttleLevel);
    const throttleLevel = Number.isFinite(rawThrottle)
      ? Number(Math.max(0, Math.min(1, rawThrottle)).toFixed(2))
      : DEFAULT_DRIVE_SETTINGS.throttleLevel;

    return {
      accelMode: validMode,
      targetKmh,
      speedScale,
      accelRate,
      throttleLevel,
    };
  }

  _loadDriveSettings() {
    if (!this.storage) return { ...DEFAULT_DRIVE_SETTINGS };
    try {
      const raw = this.storage.getItem(DRIVE_SETTINGS_STORAGE_KEY);
      if (raw) {
        return this._sanitizeDriveSettings(JSON.parse(raw));
      }
    } catch {
      // Ignore storage read errors
    }
    return { ...DEFAULT_DRIVE_SETTINGS };
  }

  getDriveSpeedSummary() {
    const modelPreset =
      this.car?.getActiveModelPreset?.() ||
      CAR_MODEL_PRESETS.find((m) => m.id === this.carModel) ||
      CAR_MODEL_PRESETS[0];
    const {
      accelMode,
      targetKmh = 75,
      speedScale,
      accelRate,
      throttleLevel = 0,
    } = this.driveSettings;

    const cruiseKmh = targetKmh;
    const maxThrottleKmh = Math.max(30, targetKmh);
    const nitroMaxKmh = Math.round(
      Math.max(targetKmh, 115) + 50.0 * (modelPreset.nitroPower || 1.0),
    );
    const throttleTargetKmh = Math.round(throttleLevel * maxThrottleKmh);
    const modeInfo =
      ACCEL_CONTROL_MODES.find((m) => m.id === accelMode) || ACCEL_CONTROL_MODES[0];

    let activeGear = -1;
    for (const gp of GEAR_PRESETS) {
      if (Math.abs(gp.targetKmh - targetKmh) <= 3) {
        activeGear = gp.gear;
        break;
      }
    }

    let activePresetId = 'custom';
    for (const preset of SPEED_PRESETS) {
      if (Math.abs(preset.targetKmh - targetKmh) <= 5) {
        activePresetId = preset.id;
        break;
      }
    }

    return {
      accelMode,
      modeName: modeInfo.name,
      modeShortName: modeInfo.shortName,
      modeDescription: modeInfo.description,
      targetKmh,
      activeGear,
      speedScale,
      accelRate,
      throttleLevel,
      throttleTargetKmh,
      cruiseKmh,
      maxThrottleKmh,
      nitroMaxKmh,
      activePresetId,
    };
  }

  setDriveSettings(partial = {}) {
    const nextRaw = {
      ...this.driveSettings,
      ...partial,
    };
    if (partial.targetKmh !== undefined && partial.speedScale === undefined) {
      const clampedKmh = Math.max(0, Math.min(180, Number(partial.targetKmh) || 0));
      nextRaw.speedScale =
        clampedKmh <= 0 ? 0.45 : Number(Math.max(0.45, Math.min(1.4, clampedKmh / 100)).toFixed(2));
    } else if (partial.speedScale !== undefined && partial.targetKmh === undefined) {
      const clampedScale = Math.max(0.45, Math.min(1.4, Number(partial.speedScale) || 0.85));
      nextRaw.targetKmh = Math.round(Math.max(25, Math.min(180, clampedScale * 90)));
    }

    this.driveSettings = this._sanitizeDriveSettings(nextRaw);
    if (this.storage) {
      try {
        this.storage.setItem(DRIVE_SETTINGS_STORAGE_KEY, JSON.stringify(this.driveSettings));
      } catch {
        // Ignore storage quota errors
      }
    }
    const summary = this.getDriveSpeedSummary();
    this.menu?.syncDriveSettings(summary);
    this.hud?.syncDriveSettings(summary);
    return summary;
  }

  setTargetSpeedKmh(kmh = 75) {
    const rounded = Math.round(Math.max(0, Math.min(180, Number(kmh) || 0)));
    return this.setDriveSettings({ targetKmh: rounded });
  }

  adjustTargetSpeedKmh(deltaKmh = 0) {
    const current = this.driveSettings.targetKmh ?? 75;
    const nextKmh = Math.max(0, Math.min(180, Math.round(current + deltaKmh)));
    const summary = this.setTargetSpeedKmh(nextKmh);
    const label =
      summary.targetKmh <= 0
        ? 'STOP · 0 KM/H'
        : summary.accelMode === 'manual_throttle'
          ? `SPEED CAP · ${summary.targetKmh} KM/H`
          : `SPEED · ${summary.targetKmh} KM/H`;
    this.hud?.showBonusToast(label);
    return summary;
  }

  setGear(gearNum = 2) {
    const preset =
      GEAR_PRESETS.find((g) => g.gear === Number(gearNum)) || GEAR_PRESETS[2];
    const patch = {
      targetKmh: preset.targetKmh,
      speedScale: preset.speedScale,
    };
    if (preset.gear === 0) {
      patch.throttleLevel = 0;
    }
    const summary = this.setDriveSettings(patch);
    const toast =
      preset.gear === 0
        ? 'GEAR 0 · FULL STOP (0 KM/H)'
        : `GEAR ${preset.gear} · ${preset.targetKmh} KM/H`;
    this.hud?.showBonusToast(toast);
    return summary;
  }

  setThrottleLevel(level = 0, switchToManual = false) {
    const clamped = Number(Math.max(0, Math.min(1, Number(level) || 0)).toFixed(2));
    const patch = { throttleLevel: clamped };
    if (switchToManual && this.driveSettings.accelMode !== 'manual_throttle') {
      patch.accelMode = 'manual_throttle';
    }
    return this.setDriveSettings(patch);
  }

  adjustThrottleLevel(delta = 0) {
    return this.adjustTargetSpeedKmh(delta > 0 ? 10 : -10);
  }

  applySpeedPreset(presetId) {
    const preset = SPEED_PRESETS.find((p) => p.id === presetId) || SPEED_PRESETS[1];
    const summary = this.setDriveSettings({
      targetKmh: preset.targetKmh,
      speedScale: preset.speedScale,
      accelRate: preset.accelRate,
    });
    this.hud?.showBonusToast(`PACE · ${preset.name.toUpperCase()} (${summary.targetKmh} KM/H)`);
    return summary;
  }

  adjustSpeedScale(delta = 0) {
    const nextSpeed = Number((this.driveSettings.speedScale + delta).toFixed(2));
    const summary = this.setDriveSettings({ speedScale: nextSpeed });
    this.hud?.showBonusToast(`SPEED · ${summary.targetKmh} KM/H`);
    return summary;
  }

  cycleAccelMode() {
    const idx = ACCEL_CONTROL_MODES.findIndex((m) => m.id === this.driveSettings.accelMode);
    const nextMode = ACCEL_CONTROL_MODES[(idx + 1) % ACCEL_CONTROL_MODES.length];
    const summary = this.setDriveSettings({ accelMode: nextMode.id });
    this.hud?.showBonusToast(`MODE · ${nextMode.shortName.toUpperCase()}`);
    return summary;
  }

  setShowroomAngle(angleId = 'orbit') {
    const allowed = ['orbit', 'front', 'side', 'rear'];
    this.showroomAngle = allowed.includes(angleId) ? angleId : 'orbit';
    this.menu?.setShowroomAngleState(this.showroomAngle);
    return this.showroomAngle;
  }

  navigateToPage(pageName = 'garage', { updateHash = true } = {}) {
    const target = pageName === 'race' ? 'race' : 'garage';
    if (target === 'garage') {
      this.returnToTitleScreen({ updateHash });
      return 'garage';
    }

    this.activePage = 'race';
    if (updateHash && typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        window.history.replaceState(null, '', '#race');
      } catch {
        // Ignore history restrictions in sandboxed environments
      }
    }

    const isActivelyRacing =
      this.state === GAME_STATE.RACING ||
      this.state === GAME_STATE.COUNTDOWN ||
      this.state === GAME_STATE.PAUSED;

    this.menu?.closeConsentModal();
    this.menu?.closeCalibrationScreen();
    this.gameOverUI?.hide();

    if (isActivelyRacing) {
      this.menu?.setActivePage('race', { showLobby: false });
      this.hud?.show(this.controlMode);
    } else {
      this.state = GAME_STATE.TITLE;
      this.car?.reset();
      this.car?.setNameplateVisible(true);
      this.hud?.hide();
      this.menu?.setActivePage('race', { showLobby: true });
    }
    return 'race';
  }

  cycleCameraView() {
    const idx = CAMERA_VIEWS.indexOf(this.cameraView);
    this.cameraView = CAMERA_VIEWS[(idx + 1) % CAMERA_VIEWS.length];
    this.car?.setNameplateVisible(this.cameraView !== 'hood');
    this.hud?.setCameraViewLabel(this.cameraView);
    const labelMap = {
      chase: 'CAMERA · CHASE VIEW',
      close: 'CAMERA · ACTION CLOSE',
      hood: 'CAMERA · PRO HOOD VIEW',
    };
    this.hud?.showBonusToast(labelMap[this.cameraView]);
    return this.cameraView;
  }

  _initUI() {
    this.hud = new HUD({
      onPause: () => this.pauseRace(),
      onToggleMute: () => this.toggleMute(),
      onRecenterHands: () => {
        this.audio.unlock();
        this.calibration.captureNeutral();
        this.audio.playCalibrationLock();
        this.hud?.showBonusToast('HAND WHEEL RECENTERED ✓');
      },
      onRecalibrate: () => this.openCalibrationDuringRace(),
      onCycleCamera: () => this.cycleCameraView(),
      onTriggerGas: (active) => {
        this.audio.unlock();
        this.hudGasPressed = Boolean(active);
      },
      onTriggerBrake: (active) => {
        this.audio.unlock();
        this.hudBrakePressed = Boolean(active);
      },
      onTriggerNitro: (active) => {
        this.audio.unlock();
        this.hudNitroPressed = Boolean(active);
      },
      onChangeTargetSpeed: (kmh) => {
        this.audio.unlock();
        this.setTargetSpeedKmh(kmh);
      },
      onAdjustTargetSpeed: (deltaKmh) => {
        this.audio.unlock();
        this.adjustTargetSpeedKmh(deltaKmh);
      },
      onCycleAccelMode: () => {
        this.audio.unlock();
        this.cycleAccelMode();
      },
      onTouchControl: (control, active) => {
        this.audio.unlock();
        this.keyboard.setTouchInput(control, active);
      },
    });

    this.menu = new Menu({
      onNavigatePage: (page) => {
        this.audio.unlock();
        this.navigateToPage(page);
      },
      onSelectShowroomAngle: (angleId) => {
        this.setShowroomAngle(angleId);
      },
      onSelectGear: (gearNum) => {
        this.audio.unlock();
        this.setGear(gearNum);
      },
      onChangeTargetSpeed: (kmh) => {
        this.setTargetSpeedKmh(kmh);
      },
      onAdjustTargetSpeed: (deltaKmh) => {
        this.audio.unlock();
        this.adjustTargetSpeedKmh(deltaKmh);
      },
      onSelectCameraPlay: () => {
        this.audio.unlock();
        this.startDirectCameraRace();
      },
      onConfirmCameraPermission: () => {
        this.audio.unlock();
        this.startDirectCameraRace();
      },
      onSelectKeyboardPlay: () => {
        this.audio.unlock();
        this.startKeyboardModeRace();
      },
      onCancelCalibration: () => {
        if (this.calibrationReturnState === GAME_STATE.PAUSED) {
          this.menu.closeCalibrationScreen();
          this.state = GAME_STATE.PAUSED;
          this.menu.openPauseModal({
            context: 'race',
            controlMode: this.controlMode,
            settings: this.calibration.settings,
            driveSettings: this.getDriveSpeedSummary(),
            quality: this.quality,
          });
        } else {
          this.exitCameraModeToTitle();
        }
      },
      onCaptureNeutral: () => {
        this.calibration.captureNeutral();
        this.audio.playCalibrationLock();
      },
      onStartCalibratedRace: () => {
        if (!this.calibration.settings.isCalibrated) {
          this.calibration.captureNeutral();
        }
        this.menu.closeCalibrationScreen();
        this.controlMode = 'camera';
        this.beginRaceCountdown();
      },
      onResetCalibrationDefaults: () => {
        this.calibration.resetDefaults();
        this.setDriveSettings(DEFAULT_DRIVE_SETTINGS);
        this.menu.syncSettingsControls(this.calibration.settings);
      },
      onUpdateSteeringSettings: (partial) => {
        this.calibration.updateSettings(partial);
      },
      onUpdateDriveSettings: (partial) => {
        this.setDriveSettings(partial);
      },
      onSelectSpeedPreset: (presetId) => {
        this.audio.unlock();
        this.applySpeedPreset(presetId);
      },
      onOpenTitleSettings: () => {
        this.audio.unlock();
        this.menu.openPauseModal({
          context: 'title',
          controlMode: this.controlMode,
          settings: this.calibration.settings,
          driveSettings: this.getDriveSpeedSummary(),
          quality: this.quality,
        });
      },
      onCycleQuality: () => {
        const order = ['high', 'medium', 'low'];
        const next = order[(order.indexOf(this.quality) + 1) % order.length];
        this.setQuality(next);
      },
      onSelectQuality: (q) => this.setQuality(q),
      onChangeDriverName: (val, source) => {
        this.setDriverName(val, source);
      },
      onRandomizeDriverName: () => {
        this.audio.unlock();
        this.randomizeDriverName();
        this.audio.playOvertakeChime(2);
      },
      onSelectCarModel: (modelId) => {
        this.audio.unlock();
        this.setCarModel(modelId);
        this.menu?.syncDriveSettings(this.getDriveSpeedSummary());
        this.hud?.syncDriveSettings(this.getDriveSpeedSummary());
        this.audio.playOvertakeChime(3);
      },
      onSelectCarPaint: (presetId) => {
        this.audio.unlock();
        this.setCarPaint(presetId);
      },
      onSelectAtmosphere: (themeId) => {
        this.audio.unlock();
        this.setAtmosphere(themeId);
      },
      onToggleMute: () => this.toggleMute(),
      onResumeRace: () => this.resumeRace(),
      onRecalibrateFromPause: () => {
        this.menu.hidePauseModal();
        this.openCalibrationDuringRace();
      },
      onRestartRace: () => {
        this.menu.hidePauseModal();
        this.beginRaceCountdown();
      },
      onSwitchControlMode: () => {
        this.menu.hidePauseModal();
        if (this.controlMode === 'camera') {
          this.cameraController.stopCamera();
          this.handTracker.resetFrameCache();
          this.startKeyboardModeRace();
        } else {
          this.startDirectCameraRace();
        }
      },
      onQuitToTitle: () => {
        this.menu.hidePauseModal();
        this.returnToTitleScreen();
      },
    });

    this.gameOverUI = new GameOver({
      onReplay: () => {
        this.gameOverUI.hide();
        this.beginRaceCountdown();
      },
      onSwitchMode: () => {
        this.gameOverUI.hide();
        if (this.controlMode === 'camera') {
          this.cameraController.stopCamera();
          this.handTracker.resetFrameCache();
          this.startKeyboardModeRace();
        } else {
          this.startDirectCameraRace();
        }
      },
      onMainMenu: () => {
        this.gameOverUI.hide();
        this.returnToTitleScreen();
      },
    });

    document.getElementById('btn-reload-app')?.addEventListener('click', () => {
      window.location.reload();
    });

    const driveSummary = this.getDriveSpeedSummary();
    this.menu.updateBestScore(this.bestScore);
    this.menu.setMutedState(this.audio.isMuted);
    this.menu.setQualityState(this.quality);
    this.menu.setDriverNameState(this.driverName);
    this.menu.setCarModelState(this.carModel);
    this.menu.setCarPaintState(this.carPaint);
    this.menu.setAtmosphereState(this.atmosphere);
    this.menu.syncSettingsControls(this.calibration.settings);
    this.menu.syncDriveSettings(driveSummary);
    this.hud.setMutedState(this.audio.isMuted);
    this.hud.setCameraViewLabel(this.cameraView);
    this.hud.syncDriveSettings(driveSummary);
    this.menu.setActivePage(this.activePage, { showLobby: this.activePage === 'race' });
  }

  _initThree() {
    this.isSoftwareGl = detectSoftwareWebGL();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl && this.quality !== 'low',
        powerPreference: 'high-performance',
      });
    } catch (err) {
      this._showWebGLFallback(err?.message);
      return;
    }

    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);
    }

    this._onContextLost = (e) => {
      e.preventDefault();
      if (this.state === GAME_STATE.RACING) {
        this.pauseRace();
      }
    };
    this._onContextRestored = () => {
      this.renderer?.render(this.scene, this.camera);
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this._onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this._onContextRestored);

    this.scene = new THREE.Scene();
    const initialAtmo =
      ATMOSPHERE_PRESETS.find((t) => t.id === this.atmosphere) || ATMOSPHERE_PRESETS[0];
    this.scene.background = new THREE.Color(initialAtmo.skyHex);
    this.scene.fog = new THREE.FogExp2(initialAtmo.skyHex, initialAtmo.fogDensity ?? 0.0085);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.2, 260);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmremGenerator.dispose();

    this.hemiLight = new THREE.HemisphereLight(
      initialAtmo.hemiSkyHex,
      initialAtmo.hemiGroundHex,
      initialAtmo.hemiIntensity ?? 1.0,
    );
    this.hemiLight.position.set(0, 40, 0);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(
      initialAtmo.keyLightHex,
      initialAtmo.keyIntensity ?? 1.75,
    );
    this.keyLight.position.set(12, 22, 14);
    this.keyLight.castShadow = !this.isSoftwareGl && this.quality === 'high';
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 65;
    const d = 14;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(
      initialAtmo.rimLightHex,
      initialAtmo.rimIntensity ?? 1.05,
    );
    this.rimLight.position.set(-10, 8, -18);
    this.scene.add(this.rimLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.road = new Road({
      isSoftwareGl: this.isSoftwareGl,
      maxAnisotropy: maxAniso,
      quality: this.quality,
    });
    this.road.setAtmosphere(this.atmosphere);
    this.scene.add(this.road.group);

    this.car = new Car({
      isSoftwareGl: this.isSoftwareGl,
      modelPresetId: this.carModel,
      paintPresetId: this.carPaint,
      driverName: this.driverName,
    });
    this.scene.add(this.car.root);
    this.car.attachSparksToScene(this.scene);

    this.traffic = new TrafficManager({ isSoftwareGl: this.isSoftwareGl });
    this.scene.add(this.traffic.root);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this._onResize = this.handleResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this.clock = new THREE.Clock();
    this._scheduleNextTick();
  }

  _showWebGLFallback(detail) {
    const fb = document.getElementById('webgl-fallback');
    const msg = document.getElementById('webgl-fallback-msg');
    if (fb) fb.classList.remove('hidden');
    if (msg && detail) msg.textContent = detail;
  }

  handleResize(explicitWidth, explicitHeight) {
    if (!this.renderer || !this.camera) return;
    const width =
      typeof explicitWidth === 'number' ? explicitWidth : window.innerWidth || 1280;
    const height =
      typeof explicitHeight === 'number' ? explicitHeight : Math.max(1, window.innerHeight || 720);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2),
    );
  }

  async startDirectCameraRace() {
    this.menu?.setCameraPlayLoading(true);
    this.menu?.setConsentLoading(
      true,
      'Starting camera and loading MediaPipe hand-wheel tracker...',
    );

    const calVideo = document.getElementById('cal-video-preview');
    const hudVideo = document.getElementById('hud-video-preview');

    try {
      await this.cameraController.requestCamera([calVideo, hudVideo]);
      await this.handTracker.initialize();
      this.handTracker.resetFrameCache();
      this.calibration.ensureDefaultNeutral();

      this.menu?.setCameraPlayLoading(false);
      this.menu?.setConsentLoading(false);
      this.menu?.closeConsentModal();
      this.menu?.closeCalibrationScreen();
      this.menu?.hideTitleScreen();

      this.controlMode = 'camera';
      this.beginRaceCountdown();
    } catch (err) {
      this.cameraController.stopCamera();
      this.menu?.setCameraPlayLoading(false);
      this.menu?.showConsentError(
        err?.title || 'Camera Setup Issue',
        err?.message ||
          'Unable to start webcam hand tracking. Allow camera permission or play with Touch / Keyboard Controls.',
      );
    }
  }

  async activateCameraAndOpenCalibration(returnState = GAME_STATE.TITLE) {
    this.calibrationReturnState = returnState;
    this.menu?.setConsentLoading(
      true,
      'Requesting camera permission and initializing MediaPipe hand tracker...',
    );

    const calVideo = document.getElementById('cal-video-preview');
    const hudVideo = document.getElementById('hud-video-preview');

    try {
      await this.cameraController.requestCamera([calVideo, hudVideo]);
      await this.handTracker.initialize();
      this.calibration.ensureDefaultNeutral();

      this.menu?.setConsentLoading(false);
      this.menu?.closeConsentModal();
      this.menu?.hideTitleScreen();
      this.hud?.hide();

      this.controlMode = 'camera';
      this.calibration.resetCalibrationProgress();
      this.state = GAME_STATE.CALIBRATING;
      this.menu?.openCalibrationScreen(this.calibration.settings, this.getDriveSpeedSummary());
      await this.cameraController.attachToVideos([calVideo, hudVideo]);
    } catch (err) {
      this.cameraController.stopCamera();
      this.menu?.showConsentError(
        err?.title || 'Camera Setup Issue',
        err?.message ||
          'Unable to start webcam hand tracking. Check permissions or play with Touch / Keyboard Controls.',
      );
    }
  }

  openCalibrationDuringRace() {
    if (this.controlMode !== 'camera') return;
    this.calibrationReturnState = GAME_STATE.PAUSED;
    this.calibration.resetCalibrationProgress();
    this.state = GAME_STATE.CALIBRATING;
    this.hud?.hide();
    this.menu?.openCalibrationScreen(this.calibration.settings, this.getDriveSpeedSummary());
    const calVideo = document.getElementById('cal-video-preview');
    this.cameraController.attachToVideos([calVideo]);
  }

  exitCameraModeToTitle() {
    this.cameraController.stopCamera();
    this.handTracker.resetFrameCache();
    this.controlMode = 'keyboard';
    this.menu?.closeCalibrationScreen();
    this.returnToTitleScreen();
  }

  startKeyboardModeRace() {
    this.cameraController.stopCamera();
    this.handTracker.resetFrameCache();
    this.controlMode = 'keyboard';
    this.menu?.hideTitleScreen();
    this.menu?.closeConsentModal();
    this.menu?.closeCalibrationScreen();
    this.beginRaceCountdown();
  }

  beginRaceCountdown() {
    this.resetRaceMetrics();
    this.activePage = 'race';
    if (!this.headless && typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        window.history.replaceState(null, '', '#race');
      } catch {
        // Ignore
      }
    }
    this.state = GAME_STATE.COUNTDOWN;
    this.countdownTimer = 2.4;
    this.lastCountdownDigit = 4;

    this.menu?.setActivePage('race', { showLobby: false });
    this.menu?.hidePauseModal();
    this.gameOverUI?.hide();
    this.hud?.show(this.controlMode);
    this.hud?.syncDriveSettings(this.getDriveSpeedSummary());

    if (this.controlMode === 'camera') {
      const hudVideo = document.getElementById('hud-video-preview');
      this.cameraController.attachToVideos([hudVideo]);
    }
  }

  resetRaceMetrics() {
    const { accelMode, targetKmh = 75, throttleLevel = 0 } = this.driveSettings;
    const launchKmh =
      accelMode === 'manual_throttle'
        ? throttleLevel * Math.max(30, targetKmh)
        : Math.min(targetKmh, 36);
    const launchSpeedMps = Math.max(0, launchKmh / 3.6);
    this.score = 0;
    this.distanceMeters = 0;
    this.speedMps = launchSpeedMps;
    this.topSpeedKmh = Math.round(launchSpeedMps * 3.6);
    this.nearMisses = 0;
    this.overtakes = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboDecayTimer = 0;
    this.nitroCharge = 100;
    this.isBoosting = false;
    this.hudGasPressed = false;
    this.hudBrakePressed = false;
    this.hudNitroPressed = false;
    this.cameraShake = 0;

    this.collisionSystem.reset();
    this.car?.reset();
    this.car?.setNameplateVisible(this.cameraView !== 'hood');
    this.traffic?.reset();
    this.keyboard?.reset();
  }

  pauseRace() {
    if (this.state !== GAME_STATE.RACING && this.state !== GAME_STATE.COUNTDOWN) return;
    this.state = GAME_STATE.PAUSED;
    this.isBoosting = false;
    this.hudGasPressed = false;
    this.hudBrakePressed = false;
    this.hudNitroPressed = false;
    this.audio.updateEngine(0, false, false, false);
    this.menu?.openPauseModal({
      context: 'race',
      controlMode: this.controlMode,
      settings: this.calibration.settings,
      driveSettings: this.getDriveSpeedSummary(),
      quality: this.quality,
    });
  }

  resumeRace() {
    if (this.state !== GAME_STATE.PAUSED) return;
    this.menu?.hidePauseModal();
    this.state = GAME_STATE.RACING;
  }

  returnToTitleScreen({ updateHash = true } = {}) {
    this.cameraController.stopCamera();
    this.handTracker.resetFrameCache();
    this.controlMode = 'keyboard';
    this.state = GAME_STATE.TITLE;
    this.activePage = 'garage';
    if (!this.headless && updateHash && typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        window.history.replaceState(null, '', '#garage');
      } catch {
        // Ignore
      }
    }
    this.isBoosting = false;
    this.hudGasPressed = false;
    this.hudBrakePressed = false;
    this.hudNitroPressed = false;
    this.audio.updateEngine(0, false, false, false);

    this.car?.reset();
    this.car?.setNameplateVisible(true);
    this.traffic?.reset();
    this.speedMps = 14;

    this.hud?.hide();
    this.gameOverUI?.hide();
    this.menu?.hidePauseModal();
    this.menu?.closeCalibrationScreen();
    this.menu?.showTitleScreen(this.bestScore);
  }

  toggleMute() {
    this.audio.unlock();
    const muted = this.audio.toggleMute();
    this.menu?.setMutedState(muted);
    this.hud?.setMutedState(muted);
  }

  handleEscapeKey() {
    const helpModal = document.getElementById('help-modal');
    if (helpModal && !helpModal.classList.contains('hidden')) {
      this.menu?.closeHelp();
      return;
    }
    if (this.state === GAME_STATE.RACING || this.state === GAME_STATE.COUNTDOWN) {
      this.pauseRace();
    } else if (this.state === GAME_STATE.PAUSED) {
      this.resumeRace();
    }
  }

  handleRestartShortcut() {
    if (
      this.state === GAME_STATE.GAMEOVER ||
      this.state === GAME_STATE.PAUSED ||
      this.state === GAME_STATE.RACING
    ) {
      this.beginRaceCountdown();
    }
  }

  /**
   * Advances core gameplay step by `dt` seconds. Can be called directly in automated tests.
   */
  stepSimulation(dt, externalControlOverride = null) {
    const safeDt = Math.min(0.08, Math.max(0.001, dt));

    if (this.state === GAME_STATE.TITLE) {
      if (this.activePage === 'race') {
        // Page 2 Starting Grid Preview: car sits centered on the highway ready to launch
        const idleRoll = 6.5;
        this.road?.update(safeDt, idleRoll, false);
        const centerSteer = Math.max(-0.25, Math.min(0.25, -(this.car?.x || 0) * 0.6));
        this.car?.setNameplateVisible(true);
        this.car?.update(safeDt, { steer: centerSteer, speedMps: idleRoll, isAccelerating: false });
        this._updateCameraRig(safeDt, 'grid');
        return;
      }

      // Page 1 Showroom Showcase: car glides in right showcase lane beside Garage & Speed Lab
      const showcaseSpeed = 14.0;
      this.road?.update(safeDt, showcaseSpeed, false);
      const targetLaneX = 1.7 + Math.sin(performance.now() * 0.0008) * 0.3;
      const gentleSteer = Math.max(-0.35, Math.min(0.35, (targetLaneX - (this.car?.x || 0)) * 0.5));
      this.car?.setNameplateVisible(true);
      this.car?.update(safeDt, { steer: gentleSteer, speedMps: showcaseSpeed, isAccelerating: true });
      this._updateCameraRig(safeDt, 'showcase');
      return;
    }

    if (this.state === GAME_STATE.CALIBRATING) {
      const calVideo =
        typeof document !== 'undefined' ? document.getElementById('cal-video-preview') : null;
      const calCanvas =
        typeof document !== 'undefined' ? document.getElementById('cal-landmark-canvas') : null;

      const detectVideo = this.cameraController.getDetectionVideo(calVideo);
      const geo = this.handTracker.detect(detectVideo, performance.now());
      const holdRes = this.calibration.feedCalibrationSample(geo, safeDt);
      if (holdRes.completedJustNow) {
        this.audio.playCalibrationLock();
      }
      const evalState = this.calibration.evaluate(geo, safeDt);
      this.handTracker.renderOverlay(calCanvas, this.calibration.settings.neutralAngleDeg);

      this.menu?.updateCalibrationView({
        evalState,
        progress: holdRes.progress,
        isCalibrated: this.calibration.settings.isCalibrated,
        neutralAngleDeg: this.calibration.settings.neutralAngleDeg,
      });

      const calSpeed = 14 * this.driveSettings.speedScale;
      this.road?.update(safeDt, calSpeed, false);
      this.car?.update(safeDt, { steer: evalState.steer, speedMps: calSpeed });
      this._updateCameraRig(safeDt, 'race');
      return;
    }

    if (this.state === GAME_STATE.PAUSED || this.state === GAME_STATE.GAMEOVER) {
      this._updateCameraRig(safeDt, 'race');
      return;
    }

    // Gather active steering + pedal + nitro inputs
    const kbInput = this.keyboard.update(safeDt, this.calibration.settings.sensitivity);
    const manualGasInput = kbInput.accelerate || this.hudGasPressed;
    const manualBrakeInput = kbInput.brake || this.hudBrakePressed;
    let steer = kbInput.steer;
    let wheelAngleDeg = kbInput.wheelAngleDeg;
    let isBraking = manualBrakeInput;
    let isAccelerating = !isBraking && manualGasInput;
    let wantsBoost = kbInput.boost || this.hudNitroPressed;
    let gestureStatus = GESTURE_STATUS.HANDS_DETECTED;
    let pedalGesture = '';
    let confidence = 0;
    let handCount = 0;

    if (externalControlOverride) {
      steer = externalControlOverride.steer ?? 0;
      wheelAngleDeg = externalControlOverride.wheelAngleDeg ?? steer * 38;
      isBraking = Boolean(externalControlOverride.brake);
      isAccelerating = !isBraking && Boolean(externalControlOverride.accelerate);
      wantsBoost = Boolean(externalControlOverride.boost);
    } else if (this.controlMode === 'camera') {
      const hudVideo =
        typeof document !== 'undefined' ? document.getElementById('hud-video-preview') : null;
      const hudCanvas =
        typeof document !== 'undefined' ? document.getElementById('hud-landmark-canvas') : null;

      const detectVideo = this.cameraController.getDetectionVideo(hudVideo);
      const geo = this.handTracker.detect(detectVideo, performance.now());
      const camEval = this.calibration.evaluate(geo, safeDt);
      this.handTracker.renderOverlay(hudCanvas, this.calibration.settings.neutralAngleDeg);

      steer = kbInput.hasSteerInput ? kbInput.steer : camEval.steer;
      wheelAngleDeg = kbInput.hasSteerInput ? kbInput.wheelAngleDeg : camEval.wheelAngleDeg;
      const pedalMode = this.calibration.settings.pedalMode;
      const usesGestureGas = pedalMode !== 'auto_only';
      isBraking = manualBrakeInput || Boolean(camEval.brake);
      // In Speed Dial ('smooth_auto'), holding the camera wheel cruises at your exact targetKmh
      // rather than flooring past your speed setting; in Manual Gas ('manual_throttle'), grip = gas!
      const gestureGasActive =
        usesGestureGas &&
        Boolean(camEval.throttle) &&
        this.driveSettings.accelMode === 'manual_throttle';
      isAccelerating = !isBraking && (manualGasInput || gestureGasActive);
      gestureStatus = camEval.status;
      pedalGesture = camEval.pedalGesture || '';
      confidence = camEval.confidence;
      handCount = camEval.handCount;
    }

    // COUNTDOWN STATE
    if (this.state === GAME_STATE.COUNTDOWN) {
      this.countdownTimer -= safeDt;
      const digit = Math.ceil(this.countdownTimer / 0.8);
      if (digit !== this.lastCountdownDigit && digit >= 1 && digit <= 3) {
        this.lastCountdownDigit = digit;
        const speedInfo =
          this.driveSettings.accelMode === 'manual_throttle'
            ? `HOLD W / GAS TO LAUNCH (CAP ${Math.max(30, this.driveSettings.targetKmh)} KM/H)`
            : `TARGET SPEED: ${this.driveSettings.targetKmh} KM/H · GEARS 0–5`;
        this.hud?.showCountdownStep(String(digit), speedInfo);
        this.audio.playCountdownBeep(false);
      } else if (this.countdownTimer <= 0) {
        this.hud?.showCountdownStep('DRIVE', 'USE GEARS 0–5 OR SPEED SLIDER ANYTIME');
        this.audio.playCountdownBeep(true);
        setTimeout(() => this.hud?.hideCountdown(), 550);
        this.state = GAME_STATE.RACING;
      }

      this.road?.update(safeDt, this.speedMps, false);
      this.car?.update(safeDt, { steer, speedMps: this.speedMps });
      this._updateCameraRig(safeDt, 'race');
      this._syncHud(
        steer,
        wheelAngleDeg,
        gestureStatus,
        confidence,
        handCount,
        isAccelerating,
        isBraking,
        pedalGesture,
      );
      return;
    }

    // CRASHING TRANSITION STATE
    if (this.state === GAME_STATE.CRASHING) {
      this.isBoosting = false;
      this.speedMps = Math.max(0, this.speedMps - 38 * safeDt);
      this.road?.update(safeDt, this.speedMps, false);
      this.traffic?.update(
        safeDt,
        this.speedMps,
        this.distanceMeters,
        this.driveSettings.speedScale,
      );
      this.car?.update(safeDt, { steer: 0, speedMps: this.speedMps });
      this._updateCameraRig(safeDt, 'crash');
      this.audio.updateEngine(0, false, false, false);

      if (this.car.crashTimer >= 1.15) {
        this._finalizeGameOver();
      }
      return;
    }

    // ACTIVE RACING STATE: Evaluate Nitro Boost charge & drain
    const modelPreset = this.car?.getActiveModelPreset?.() || CAR_MODEL_PRESETS[0];
    const wasBoosting = this.isBoosting;
    if (wantsBoost && !isBraking && (this.nitroCharge > 1.5 || (wasBoosting && this.nitroCharge > 0.2))) {
      if (!wasBoosting && this.nitroCharge < 18) {
        this.isBoosting = false;
      } else {
        this.isBoosting = true;
        this.nitroCharge = Math.max(0, this.nitroCharge - 30 * safeDt);
        if (!wasBoosting) {
          this.audio.playNitroBoost();
          this.hud?.showBonusToast('HYPER NITRO · 2X SCORE');
        }
      }
    } else {
      this.isBoosting = false;
      this.nitroCharge = Math.min(100, this.nitroCharge + 5.8 * safeDt);
    }

    // Combo decay window
    if (this.combo > 1) {
      this.comboDecayTimer -= safeDt;
      if (this.comboDecayTimer <= 0) {
        this.combo = 1;
      }
    }

    // Honest, Player-Governed Speed & Gearbox Physics
    const {
      accelMode,
      targetKmh = 75,
      speedScale,
      accelRate,
      throttleLevel = 0,
    } = this.driveSettings;

    const targetSpeedMps = Math.max(0, targetKmh) / 3.6;
    const manualCapMps = Math.max(30, targetKmh) / 3.6;
    const sliderCruiseMps = Math.max(0, Math.min(1, throttleLevel)) * manualCapMps;
    const passBoostMps = Math.min(200 / 3.6, targetSpeedMps + 9.5);
    const nitroTopMps =
      Math.max(targetSpeedMps, 32) + 14.0 * (modelPreset.nitroPower || 1.0);

    if (isBraking) {
      // Crisp disc braking all the way down to 0 km/h in every mode
      const brakeDecel = (30.0 + 12.0 * accelRate) * safeDt;
      this.speedMps = Math.max(0, this.speedMps - brakeDecel);
    } else if (this.isBoosting) {
      const nitroStep = (32.0 + 10.0 * accelRate) * safeDt;
      if (this.speedMps < nitroTopMps) {
        this.speedMps = Math.min(nitroTopMps, this.speedMps + nitroStep);
      } else {
        this.speedMps = THREE.MathUtils.damp(this.speedMps, nitroTopMps, 3.0, safeDt);
      }
    } else if (accelMode === 'manual_throttle') {
      if (isAccelerating) {
        const headroom = Math.max(0.3, 1 - (this.speedMps / Math.max(1, manualCapMps)) * 0.4);
        const accelStep = (15.5 + 12.5 * accelRate) * headroom * safeDt;
        if (this.speedMps < manualCapMps) {
          this.speedMps = Math.min(manualCapMps, this.speedMps + accelStep);
        } else {
          this.speedMps = THREE.MathUtils.damp(this.speedMps, manualCapMps, 3.5, safeDt);
        }
      } else if (this.speedMps < sliderCruiseMps - 0.15) {
        const accelStep = (13.0 + 10.0 * accelRate) * safeDt;
        this.speedMps = Math.min(sliderCruiseMps, this.speedMps + accelStep);
      } else {
        const coastDecel = (8.5 + 3.0 * accelRate) * safeDt;
        this.speedMps = Math.max(sliderCruiseMps, this.speedMps - coastDecel);
      }
    } else if (targetSpeedMps <= 0.05 && !isAccelerating) {
      // Gear 0 (STOP / 0 km/h): smoothly glides down to a complete stop
      const stopDecel = (16.0 + 6.0 * accelRate) * safeDt;
      this.speedMps = Math.max(0, this.speedMps - stopDecel);
    } else if (accelMode === 'constant_cruise') {
      this.speedMps = THREE.MathUtils.damp(
        this.speedMps,
        targetSpeedMps,
        2.6 * accelRate,
        safeDt,
      );
    } else if (isAccelerating) {
      // Speed Dial + Pedals: holding W / GAS gives a smooth controllable passing boost
      const accelStep = (14.5 + 11.0 * accelRate) * safeDt;
      if (this.speedMps < passBoostMps) {
        this.speedMps = Math.min(passBoostMps, this.speedMps + accelStep);
      } else {
        this.speedMps = THREE.MathUtils.damp(this.speedMps, passBoostMps, 3.0, safeDt);
      }
    } else {
      // Speed Dial + Pedals: smoothly converges to exact targetKmh
      this.speedMps = THREE.MathUtils.damp(
        this.speedMps,
        targetSpeedMps,
        2.5 * accelRate,
        safeDt,
      );
    }

    const speedKmh = this.speedMps * 3.6;
    if (speedKmh > this.topSpeedKmh) {
      this.topSpeedKmh = speedKmh;
    }

    const deltaDist = this.speedMps * safeDt;
    this.distanceMeters += deltaDist;
    const speedMultiplier = 1 + (this.speedMps / 34) * 1.3;
    const nitroScoreMult = this.isBoosting ? 2.0 : 1.0;
    this.score += deltaDist * 0.9 * speedMultiplier * nitroScoreMult;

    this.road?.update(safeDt, this.speedMps, this.isBoosting);
    this.car?.update(safeDt, {
      steer,
      speedMps: this.speedMps,
      isAccelerating,
      isBraking,
      isBoosting: this.isBoosting,
    });
    this.traffic?.update(safeDt, this.speedMps, this.distanceMeters, speedScale);

    // Evaluate collisions, near-misses & clean named rival overtakes
    const colResult = this.collisionSystem.evaluate(
      this.car.getBounds(),
      this.traffic.activeVehicles,
      this.car.invulnerableTimer > 0,
      this.speedMps,
    );

    if (colResult.nearMissCount > 0) {
      this.nearMisses += colResult.nearMissCount;
      this.combo = Math.min(5, this.combo + colResult.nearMissCount);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboDecayTimer = 5.5;
      this.nitroCharge = Math.min(100, this.nitroCharge + colResult.nearMissCount * 28);

      const bonus = colResult.nearMissCount * 50 * this.combo;
      this.score += bonus;
      const rivalTag = colResult.nearMissNames?.[0]
        ? ` · ${colResult.nearMissNames[0].toUpperCase()}`
        : '';
      this.hud?.showBonusToast(`NEAR MISS${rivalTag} +${bonus}`);
      this.audio.playNearMiss();
    } else if (colResult.overtakeCount > 0) {
      this.overtakes += colResult.overtakeCount;
      this.combo = Math.min(5, this.combo + 1);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboDecayTimer = 5.0;
      this.nitroCharge = Math.min(100, this.nitroCharge + colResult.overtakeCount * 8);

      const bonus = colResult.overtakeCount * 25 * this.combo;
      this.score += bonus;
      const rivalTag = colResult.overtakeNames?.[0]
        ? ` ${colResult.overtakeNames[0].toUpperCase()}`
        : '';
      this.hud?.showBonusToast(`PASSED${rivalTag} +${bonus}`);
      this.audio.playOvertakeChime(this.combo);
    }

    if (colResult.hitVehicle) {
      this.combo = 1;
      this.comboDecayTimer = 0;
      this.isBoosting = false;
      this.cameraShake = colResult.fatalCrash ? 0.65 : 0.36;
      if (colResult.fatalCrash) {
        this.audio.playCrash(true);
        const spinDir = this.car.x >= colResult.hitVehicle.x ? 1 : -1;
        this.car.triggerFatalCrash(spinDir);
        this.state = GAME_STATE.CRASHING;
      } else {
        this.audio.playCrash(false);
        this.speedMps = Math.max(0, this.speedMps * 0.62);
        const pushDir = this.car.x >= colResult.hitVehicle.x ? 1 : -1;
        this.car.lateralVelocity = pushDir * 6.5;
        this.car.triggerDamageShield(1.4);
        const hitName = colResult.hitVehicle.driverName
          ? ` WITH ${colResult.hitVehicle.driverName.toUpperCase()}`
          : '';
        this.hud?.showBonusToast(`IMPACT${hitName} — SHIELD ACTIVE`);
      }
    }

    if (this.score > this.bestScore) {
      this._saveBestScore(this.score);
    }

    this.audio.updateEngine(speedKmh, this.speedMps > 0.3 || isAccelerating, isBraking, this.isBoosting);
    this._updateCameraRig(safeDt, 'race');
    this._syncHud(
      steer,
      wheelAngleDeg,
      gestureStatus,
      confidence,
      handCount,
      isAccelerating,
      isBraking,
      pedalGesture,
    );
  }

  _finalizeGameOver() {
    this.state = GAME_STATE.GAMEOVER;
    const isNewBest = this._saveBestScore(this.score);
    const activeModel = this.car?.getActiveModelPreset?.() || CAR_MODEL_PRESETS[0];
    this.menu?.updateBestScore(this.bestScore);
    this.hud?.hide();
    this.gameOverUI?.show({
      score: this.score,
      bestScore: this.bestScore,
      isNewBest,
      distanceMeters: this.distanceMeters,
      topSpeedKmh: this.topSpeedKmh,
      nearMisses: this.nearMisses,
      overtakes: this.overtakes,
      maxCombo: this.maxCombo,
      driverName: this.driverName,
      carModelName: activeModel.name,
      controlMode: this.controlMode,
    });
  }

  _syncHud(
    steer,
    wheelAngleDeg,
    gestureStatus,
    confidence,
    handCount,
    isAccelerating,
    isBraking,
    pedalGesture = '',
  ) {
    const driveSummary = this.getDriveSpeedSummary();
    this.hud?.update({
      score: this.score,
      bestScore: Math.max(this.bestScore, Math.floor(this.score)),
      distanceMeters: this.distanceMeters,
      speedKmh: this.speedMps * 3.6,
      maxSpeedKmh: Math.max(110, driveSummary.nitroMaxKmh),
      health: this.collisionSystem.health,
      maxHealth: this.collisionSystem.maxHealth,
      steer,
      wheelAngleDeg,
      controlMode: this.controlMode,
      gestureStatus,
      pedalGesture,
      confidence,
      handCount,
      isAccelerating,
      isBraking,
      isBoosting: this.isBoosting,
      nitroCharge: this.nitroCharge,
      combo: this.combo,
      difficultyTier: this.traffic?.difficultyLevel || 1,
      accelMode: driveSummary.accelMode,
      targetKmh: driveSummary.targetKmh,
      speedScale: driveSummary.speedScale,
      throttleLevel: driveSummary.throttleLevel,
    });
  }

  _updateCameraRig(dt, mode = 'race') {
    if (!this.camera || !this.car) return;

    const aspect = this.camera.aspect || 1.6;
    const isPortraitMobile = aspect < 1.05;

    if (mode === 'grid') {
      // Page 2 Starting Grid Camera: elevated hero chase view overlooking the highway lanes
      const t = performance.now() * 0.0005;
      const swayX = Math.sin(t) * 0.45;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, this.car.x + swayX, 3.8, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, isPortraitMobile ? 3.2 : 2.75, 3.8, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, isPortraitMobile ? 7.6 : 6.4, 3.8, dt);
      _lookTarget.set(this.car.x, isPortraitMobile ? 0.25 : 0.72, -10.5);
      this.camLook.lerp(_lookTarget, 1 - Math.exp(-6.0 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.camera.rotation.z = 0;

      const gridFov = isPortraitMobile ? 64 : 58;
      if (Math.abs(this.camera.fov - gridFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, gridFov, 6.0, dt);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    if (mode === 'showcase') {
      const t = performance.now() * 0.00038;
      const angle = this.showroomAngle || 'orbit';

      if (isPortraitMobile) {
        let targetX = Math.sin(t) * 1.1;
        let targetY = 2.35;
        let targetZ = 7.25;
        if (angle === 'front') {
          targetX = 2.1;
          targetZ = -6.8;
        } else if (angle === 'side') {
          targetX = 5.2;
          targetZ = -2.8;
        } else if (angle === 'rear') {
          targetX = 0.4;
          targetZ = 7.1;
        }
        this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetX, 3.6, dt);
        this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetY, 3.6, dt);
        this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetZ, 3.6, dt);
        _lookTarget.set(this.car.x, -0.78, -3.2);
      } else {
        let targetX = -1.65 + Math.sin(t) * 0.9;
        let targetY = 2.22;
        let targetZ = 5.55;
        let lookX = this.car.x - 1.35;

        if (angle === 'front') {
          targetX = -1.1;
          targetY = 1.85;
          targetZ = -7.6;
          lookX = this.car.x - 1.45;
        } else if (angle === 'side') {
          targetX = -3.85;
          targetY = 1.68;
          targetZ = -3.1;
          lookX = this.car.x - 1.1;
        } else if (angle === 'rear') {
          targetX = -0.55;
          targetY = 2.05;
          targetZ = 6.2;
          lookX = this.car.x - 1.5;
        }

        this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetX, 3.6, dt);
        this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetY, 3.6, dt);
        this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetZ, 3.6, dt);
        _lookTarget.set(lookX, 0.88, -3.2);
      }

      this.camLook.lerp(_lookTarget, 1 - Math.exp(-5.5 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.camera.rotation.z = 0;

      const showcaseFov = isPortraitMobile ? 64 : 58;
      if (Math.abs(this.camera.fov - showcaseFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, showcaseFov, 6.0, dt);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    const speedRatio = Math.min(1.15, Math.max(0, (this.speedMps - 11) / 36));
    const nitroPullback = this.isBoosting ? 0.5 : 0;

    let followX = this.car.x * 0.66;
    let targetY = 2.68 + speedRatio * 0.12;
    let targetZ = 6.75 + speedRatio * 0.42 + nitroPullback;
    let lookY = 0.85;
    let lookZ = -14.5;
    let lookXFactor = 0.8;

    if (this.cameraView === 'close' && mode !== 'crash') {
      followX = this.car.x * 0.82;
      targetY = 1.92 + speedRatio * 0.08;
      targetZ = 4.65 + speedRatio * 0.32 + nitroPullback * 0.6;
      lookY = 0.78;
      lookZ = -18.0;
      lookXFactor = 0.92;
    } else if (this.cameraView === 'hood' && mode !== 'crash') {
      followX = this.car.x;
      targetY = 1.24;
      targetZ = -0.35;
      lookY = 0.96;
      lookZ = -26.0;
      lookXFactor = 1.0;
    }

    const posDamp = this.cameraView === 'hood' ? 22.0 : 8.5;
    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, followX, posDamp, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetY, posDamp, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetZ, posDamp, dt);

    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShake > 0.005) {
      shakeX = (Math.random() - 0.5) * this.cameraShake;
      shakeY = (Math.random() - 0.5) * this.cameraShake * 0.7;
      this.cameraShake = Math.max(0, this.cameraShake - 1.8 * dt);
    }

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);

    _lookTarget.set(this.car.x * lookXFactor, lookY, lookZ);
    this.camLook.lerp(_lookTarget, 1 - Math.exp(-13 * dt));
    this.camera.lookAt(this.camLook);

    const targetBank = -this.car.steerInput * (this.cameraView === 'hood' ? 0.032 : 0.02);
    this.camBank = THREE.MathUtils.damp(this.camBank, targetBank, 8.5, dt);
    this.camera.rotation.z = this.camBank;

    const nitroFov = this.isBoosting ? 6.5 : 0;
    const portraitExtraFov = aspect < 0.85 ? Math.min(13, (0.85 - aspect) * 32) : 0;
    const baseFov = (this.cameraView === 'hood' ? 63 : 57) + portraitExtraFov;
    const targetFov = baseFov + speedRatio * 7.5 + nitroFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6.0, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  _afterSoftwareDraw(cb) {
    if (this.isDisposed || !this.renderer) return;
    const gl = this.renderer.getContext();
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  _scheduleNextTick() {
    if (this.isDisposed) return;
    const tick = () => {
      if (this.isDisposed) return;
      const rawDt = this.clock ? this.clock.getDelta() : 0.016;
      const clampedDt = Math.min(0.05, Math.max(0.001, rawDt));
      this.smoothedDt += (clampedDt - this.smoothedDt) * 0.35;
      this.stepSimulation(this.smoothedDt);
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      if (this.isSoftwareGl) {
        this._afterSoftwareDraw(tick);
      } else {
        this.frameId = window.requestAnimationFrame(tick);
      }
    };

    this.frameId = window.requestAnimationFrame(tick);
  }

  dispose() {
    this.isDisposed = true;
    if (typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.frameId);
      window.clearTimeout(this.frameId);
      if (this._onResize) {
        window.removeEventListener('resize', this._onResize);
      }
      if (this._onHashChange) {
        window.removeEventListener('hashchange', this._onHashChange);
      }
    }

    this.cameraController?.dispose();
    this.handTracker?.dispose();
    this.keyboard?.dispose();
    this.audio?.dispose();

    if (this.renderer) {
      this.renderer.domElement?.removeEventListener('webglcontextlost', this._onContextLost);
      this.renderer.domElement?.removeEventListener('webglcontextrestored', this._onContextRestored);
      this.envRT?.dispose();
      this.renderer.dispose?.();
    }
  }
}
