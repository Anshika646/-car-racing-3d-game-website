/**
 * Menu.js
 *
 * Manages Title Screen Garage (Driver Name, 4 Car Models, 8 Paint Colours, 5 Colorful World Arenas),
 * Camera Permission Fallback Modal, Steering Tuning Studio, Pause/Settings Dialog, and Help Modal.
 */

import gsap from 'gsap';
import { CAR_MODEL_PRESETS, CAR_PAINT_PRESETS } from '../game/Car.js';
import { ATMOSPHERE_PRESETS } from '../game/Road.js';

const PEDAL_MODE_HINTS = {
  grip_gas_palm_brake:
    'Grip your imaginary wheel (1 or 2 hands) to accelerate. Spread palm(s) open to brake to a stop.',
  palm_gas_fist_brake:
    'Hold open palm(s) to accelerate. Close hand(s) into fists to brake to a stop.',
  auto_palm_brake:
    'Hands in view accelerate/cruise smoothly. Spread palm(s) wide open to brake, or use W/S keys anytime.',
  auto_only:
    'Your hands steer left/right only. Control acceleration with W/S, Touch Pedals, or the HUD Throttle Slider.',
};

export class Menu {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.pauseContext = 'race'; // 'race' | 'title'

    this.els = {
      titleScreen: document.getElementById('title-screen'),
      titleBestReadout: document.getElementById('title-best-readout'),
      titleBestMobile: document.getElementById('title-best-mobile'),
      navQualityBtn: document.getElementById('nav-quality-btn'),
      navMuteBtn: document.getElementById('nav-mute-btn'),
      btnPlayCamera: document.getElementById('btn-play-camera'),
      btnPlayCameraLabel: document.getElementById('btn-play-camera-label'),
      btnPlayKeyboard: document.getElementById('btn-play-keyboard'),

      // Garage Controls (Driver Name + Custom Dropdowns for Model, Paint, World Arena)
      inputDriverName: document.getElementById('input-driver-name'),
      btnRandomDriverName: document.getElementById('btn-random-driver-name'),
      titleModelStats: document.getElementById('title-model-stats'),
      titlePaintLabel: document.getElementById('title-paint-label'),

      btnDdModel: document.getElementById('btn-dd-model'),
      menuDdModel: document.getElementById('menu-dd-model'),
      ddModelName: document.getElementById('dd-model-name'),
      ddModelClass: document.getElementById('dd-model-class'),

      btnDdPaint: document.getElementById('btn-dd-paint'),
      menuDdPaint: document.getElementById('menu-dd-paint'),
      ddPaintSwatch: document.getElementById('dd-paint-swatch'),
      ddPaintName: document.getElementById('dd-paint-name'),

      btnDdAtmo: document.getElementById('btn-dd-atmo'),
      menuDdAtmo: document.getElementById('menu-dd-atmo'),
      ddAtmoSwatch: document.getElementById('dd-atmo-swatch'),
      ddAtmoLabel: document.getElementById('dd-atmo-label'),

      // Field 5: Acceleration & Speed Control Dropdown + Sliders
      btnDdAccel: document.getElementById('btn-dd-accel'),
      menuDdAccel: document.getElementById('menu-dd-accel'),
      ddAccelLabel: document.getElementById('dd-accel-label'),
      titleAccelSummary: document.getElementById('title-accel-summary'),
      titleThrottleLevel: document.getElementById('title-throttle-level'),
      titleThrottleVal: document.getElementById('title-throttle-val'),
      titleSpeedScale: document.getElementById('title-speed-scale'),
      titleSpeedVal: document.getElementById('title-speed-val'),
      titleAccelRate: document.getElementById('title-accel-rate'),
      titleAccelVal: document.getElementById('title-accel-val'),
      titleAccelHint: document.getElementById('title-accel-hint'),

      // Pause / Settings Equivalents
      pauseDriverName: document.getElementById('pause-driver-name'),
      pauseModelSelect: document.getElementById('pause-model-select'),
      pausePaintSelect: document.getElementById('pause-paint-select'),
      pauseAtmosphereSelect: document.getElementById('pause-atmosphere-select'),
      pauseAccelMode: document.getElementById('pause-accel-mode'),
      pauseThrottleLevel: document.getElementById('pause-throttle-level'),
      pauseThrottleVal: document.getElementById('pause-throttle-val'),
      pauseSpeedScale: document.getElementById('pause-speed-scale'),
      pauseSpeedVal: document.getElementById('pause-speed-val'),
      pauseAccelRate: document.getElementById('pause-accel-rate'),
      pauseAccelVal: document.getElementById('pause-accel-val'),

      // Consent Modal
      consentModal: document.getElementById('camera-consent-modal'),
      btnCloseConsent: document.getElementById('btn-close-consent'),
      btnConsentKeyboard: document.getElementById('btn-consent-keyboard'),
      btnConfirmCamera: document.getElementById('btn-confirm-camera'),
      cameraErrorBox: document.getElementById('camera-error-box'),
      cameraErrorTitle: document.getElementById('camera-error-title'),
      cameraErrorDetail: document.getElementById('camera-error-detail'),
      cameraLoadingBox: document.getElementById('camera-loading-box'),
      cameraLoadingText: document.getElementById('camera-loading-text'),

      // Calibration / Tuning Screen
      calibrationScreen: document.getElementById('calibration-screen'),
      btnCalCancel: document.getElementById('btn-cal-cancel'),
      calStatusBadge: document.getElementById('cal-status-badge'),
      calConfidenceText: document.getElementById('cal-confidence-text'),
      calVideoPreview: document.getElementById('cal-video-preview'),
      calLandmarkCanvas: document.getElementById('cal-landmark-canvas'),
      calInstructionText: document.getElementById('cal-instruction-text'),
      calProgressPct: document.getElementById('cal-progress-pct'),
      calWheelSvg: document.getElementById('cal-wheel-svg'),
      calDirectionLabel: document.getElementById('cal-direction-label'),
      calAngleReadout: document.getElementById('cal-angle-readout'),
      btnCaptureNeutral: document.getElementById('btn-capture-neutral'),
      inputSensitivity: document.getElementById('input-sensitivity'),
      valSensitivity: document.getElementById('val-sensitivity'),
      inputDeadzone: document.getElementById('input-deadzone'),
      valDeadzone: document.getElementById('val-deadzone'),
      inputSmoothing: document.getElementById('input-smoothing'),
      valSmoothing: document.getElementById('val-smoothing'),
      inputMaxangle: document.getElementById('input-maxangle'),
      valMaxangle: document.getElementById('val-maxangle'),
      selectPedalMode: document.getElementById('select-pedal-mode'),
      pedalModeHint: document.getElementById('pedal-mode-hint'),
      calSpeedScale: document.getElementById('cal-speed-scale'),
      calSpeedVal: document.getElementById('cal-speed-val'),
      calAccelRate: document.getElementById('cal-accel-rate'),
      calAccelVal: document.getElementById('cal-accel-val'),
      btnStartCalibratedRace: document.getElementById('btn-start-calibrated-race'),
      btnResetDefaults: document.getElementById('btn-reset-calibration-defaults'),

      // Pause / Settings Modal
      pauseModal: document.getElementById('pause-modal'),
      pauseTitle: document.getElementById('pause-title'),
      pauseModeLabel: document.getElementById('pause-mode-label'),
      pauseQualitySelect: document.getElementById('pause-quality-select'),
      pauseSensitivity: document.getElementById('pause-sensitivity'),
      pauseSensitivityVal: document.getElementById('pause-sensitivity-val'),
      btnPauseMute: document.getElementById('btn-pause-mute'),
      btnResumeRace: document.getElementById('btn-resume-race'),
      btnPauseRecalibrate: document.getElementById('btn-pause-recalibrate'),
      btnPauseRestart: document.getElementById('btn-pause-restart'),
      btnPauseSwitchMode: document.getElementById('btn-pause-switch-mode'),
      btnPauseQuit: document.getElementById('btn-pause-quit'),

      // Help Modal
      helpModal: document.getElementById('help-modal'),
      btnCloseHelp: document.getElementById('btn-close-help'),
      btnDoneHelp: document.getElementById('btn-done-help'),
    };

    this._bindEvents();
  }

  _bindEvents() {
    this.els.btnPlayCamera?.addEventListener('click', () => {
      this.callbacks.onSelectCameraPlay?.();
    });
    this.els.btnPlayKeyboard?.addEventListener('click', () => {
      this.callbacks.onSelectKeyboardPlay?.();
    });

    // Global data-action buttons on Title Screen
    document.querySelectorAll('[data-action="open-help"]').forEach((btn) => {
      btn.addEventListener('click', () => this.openHelp());
    });
    document.querySelectorAll('[data-action="open-settings"]').forEach((btn) => {
      btn.addEventListener('click', () => this.callbacks.onOpenTitleSettings?.());
    });
    document.querySelectorAll('[data-action="toggle-quality-quick"]').forEach((btn) => {
      btn.addEventListener('click', () => this.callbacks.onCycleQuality?.());
    });
    document.querySelectorAll('[data-action="toggle-mute"]').forEach((btn) => {
      btn.addEventListener('click', () => this.callbacks.onToggleMute?.());
    });

    // Driver Name live editing
    this.els.inputDriverName?.addEventListener('input', (e) => {
      this.callbacks.onChangeDriverName?.(e.target.value, 'title');
    });
    this.els.pauseDriverName?.addEventListener('input', (e) => {
      this.callbacks.onChangeDriverName?.(e.target.value, 'pause');
    });
    this.els.btnRandomDriverName?.addEventListener('click', () => {
      this.callbacks.onRandomizeDriverName?.();
    });

    // Custom Dropdown toggles (Model, Paint, Atmosphere, Acceleration Control)
    const dropdownPairs = [
      { key: 'model', btn: this.els.btnDdModel, menu: this.els.menuDdModel },
      { key: 'paint', btn: this.els.btnDdPaint, menu: this.els.menuDdPaint },
      { key: 'atmo', btn: this.els.btnDdAtmo, menu: this.els.menuDdAtmo },
      { key: 'accel', btn: this.els.btnDdAccel, menu: this.els.menuDdAccel },
    ];

    this.closeAllDropdowns = () => {
      for (const pair of dropdownPairs) {
        if (!pair.menu || !pair.btn) continue;
        pair.menu.classList.add('hidden');
        pair.btn.setAttribute('aria-expanded', 'false');
        const chev = pair.btn.querySelector('[data-dd-chevron]');
        if (chev) chev.style.transform = 'rotate(0deg)';
      }
    };

    for (const pair of dropdownPairs) {
      pair.btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = pair.menu && !pair.menu.classList.contains('hidden');
        this.closeAllDropdowns();
        if (!isOpen && pair.menu) {
          pair.menu.classList.remove('hidden');
          pair.btn.setAttribute('aria-expanded', 'true');
          const chev = pair.btn.querySelector('[data-dd-chevron]');
          if (chev) chev.style.transform = 'rotate(180deg)';
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target?.closest?.('[data-dropdown]')) {
        this.closeAllDropdowns();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllDropdowns();
      }
    });

    // Car Model Selection
    document.querySelectorAll('[data-car-model]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modelId = btn.getAttribute('data-car-model');
        if (modelId) {
          this.callbacks.onSelectCarModel?.(modelId);
          this.closeAllDropdowns();
        }
      });
    });
    this.els.pauseModelSelect?.addEventListener('change', (e) => {
      this.callbacks.onSelectCarModel?.(e.target.value);
    });

    // Car Paint Colour & Finish Selection
    document.querySelectorAll('[data-car-paint]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetId = btn.getAttribute('data-car-paint');
        if (presetId) {
          this.callbacks.onSelectCarPaint?.(presetId);
          this.closeAllDropdowns();
        }
      });
    });
    this.els.pausePaintSelect?.addEventListener('change', (e) => {
      this.callbacks.onSelectCarPaint?.(e.target.value);
    });

    // World Arena Selection
    document.querySelectorAll('[data-atmosphere]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const themeId = btn.getAttribute('data-atmosphere');
        if (themeId) {
          this.callbacks.onSelectAtmosphere?.(themeId);
          this.closeAllDropdowns();
        }
      });
    });
    this.els.pauseAtmosphereSelect?.addEventListener('change', (e) => {
      this.callbacks.onSelectAtmosphere?.(e.target.value);
    });

    // Acceleration Control Mode, Speed Presets & Speed/Accel Sliders
    document.querySelectorAll('[data-speed-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetId = btn.getAttribute('data-speed-preset');
        if (presetId) {
          this.callbacks.onSelectSpeedPreset?.(presetId);
        }
      });
    });

    document.querySelectorAll('[data-accel-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modeId = btn.getAttribute('data-accel-mode');
        if (modeId) {
          this.callbacks.onUpdateDriveSettings?.({ accelMode: modeId });
        }
      });
    });

    this.els.pauseAccelMode?.addEventListener('change', (e) => {
      this.callbacks.onUpdateDriveSettings?.({ accelMode: e.target.value });
    });

    for (const throttleInput of [this.els.titleThrottleLevel, this.els.pauseThrottleLevel]) {
      throttleInput?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.callbacks.onUpdateDriveSettings?.({
          throttleLevel: val,
          accelMode: 'manual_throttle',
        });
      });
    }

    for (const speedInput of [
      this.els.titleSpeedScale,
      this.els.pauseSpeedScale,
      this.els.calSpeedScale,
    ]) {
      speedInput?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.callbacks.onUpdateDriveSettings?.({ speedScale: val });
      });
    }

    for (const accelInput of [
      this.els.titleAccelRate,
      this.els.pauseAccelRate,
      this.els.calAccelRate,
    ]) {
      accelInput?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.callbacks.onUpdateDriveSettings?.({ accelRate: val });
      });
    }

    // Consent modal actions
    this.els.btnCloseConsent?.addEventListener('click', () => this.closeConsentModal());
    this.els.btnConsentKeyboard?.addEventListener('click', () => {
      this.closeConsentModal();
      this.callbacks.onSelectKeyboardPlay?.();
    });
    this.els.btnConfirmCamera?.addEventListener('click', () => {
      this.callbacks.onConfirmCameraPermission?.();
    });

    // Calibration controls
    this.els.btnCalCancel?.addEventListener('click', () => {
      this.callbacks.onCancelCalibration?.();
    });
    this.els.btnCaptureNeutral?.addEventListener('click', () => {
      this.callbacks.onCaptureNeutral?.();
    });
    this.els.btnStartCalibratedRace?.addEventListener('click', () => {
      this.callbacks.onStartCalibratedRace?.();
    });
    this.els.btnResetDefaults?.addEventListener('click', () => {
      this.callbacks.onResetCalibrationDefaults?.();
    });

    this.els.inputSensitivity?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.callbacks.onUpdateSteeringSettings?.({ sensitivity: val });
      this.syncSettingsControls({ sensitivity: val });
    });
    this.els.inputDeadzone?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.callbacks.onUpdateSteeringSettings?.({ deadZoneDeg: val });
      this.syncSettingsControls({ deadZoneDeg: val });
    });
    this.els.inputSmoothing?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.callbacks.onUpdateSteeringSettings?.({ smoothingRate: val });
      this.syncSettingsControls({ smoothingRate: val });
    });
    this.els.inputMaxangle?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.callbacks.onUpdateSteeringSettings?.({ maxAngleDeg: val });
      this.syncSettingsControls({ maxAngleDeg: val });
    });
    this.els.selectPedalMode?.addEventListener('change', (e) => {
      const val = e.target.value;
      this.callbacks.onUpdateSteeringSettings?.({ pedalMode: val });
      this.syncSettingsControls({ pedalMode: val });
    });

    // Pause / Settings modal controls
    this.els.pauseQualitySelect?.addEventListener('change', (e) => {
      this.callbacks.onSelectQuality?.(e.target.value);
    });
    this.els.pauseSensitivity?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.callbacks.onUpdateSteeringSettings?.({ sensitivity: val });
      this.syncSettingsControls({ sensitivity: val });
    });
    this.els.btnPauseMute?.addEventListener('click', () => {
      this.callbacks.onToggleMute?.();
    });
    this.els.btnResumeRace?.addEventListener('click', () => {
      if (this.pauseContext === 'title') {
        this.hidePauseModal();
      } else {
        this.callbacks.onResumeRace?.();
      }
    });
    this.els.btnPauseRecalibrate?.addEventListener('click', () => {
      this.callbacks.onRecalibrateFromPause?.();
    });
    this.els.btnPauseRestart?.addEventListener('click', () => {
      this.callbacks.onRestartRace?.();
    });
    this.els.btnPauseSwitchMode?.addEventListener('click', () => {
      this.callbacks.onSwitchControlMode?.();
    });
    this.els.btnPauseQuit?.addEventListener('click', () => {
      this.callbacks.onQuitToTitle?.();
    });

    // Help modal
    this.els.btnCloseHelp?.addEventListener('click', () => this.closeHelp());
    this.els.btnDoneHelp?.addEventListener('click', () => this.closeHelp());
  }

  setCameraPlayLoading(isLoading) {
    if (this.els.btnPlayCamera) {
      this.els.btnPlayCamera.disabled = Boolean(isLoading);
    }
    if (this.els.btnPlayCameraLabel) {
      this.els.btnPlayCameraLabel.textContent = isLoading
        ? 'STARTING CAMERA...'
        : 'HAND STEER DRIVE';
    }
  }

  showTitleScreen(bestScore = 0) {
    this.setCameraPlayLoading(false);
    this.updateBestScore(bestScore);
    if (!this.els.titleScreen) return;
    this.els.titleScreen.classList.remove('hidden');
    gsap.fromTo(
      this.els.titleScreen,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power2.out' },
    );
  }

  hideTitleScreen() {
    this.setCameraPlayLoading(false);
    if (!this.els.titleScreen) return;
    this.els.titleScreen.classList.add('hidden');
  }

  updateBestScore(bestScore = 0) {
    const formatted = Math.floor(bestScore).toLocaleString();
    if (this.els.titleBestReadout) {
      this.els.titleBestReadout.textContent = `Personal Best: ${formatted} pts`;
    }
    if (this.els.titleBestMobile) {
      this.els.titleBestMobile.textContent = `Best: ${formatted} pts`;
    }
  }

  setMutedState(isMuted) {
    const label = isMuted ? 'Audio: Off' : 'Audio: On';
    if (this.els.navMuteBtn) this.els.navMuteBtn.textContent = label;
    if (this.els.btnPauseMute) this.els.btnPauseMute.textContent = label;
  }

  setQualityState(quality) {
    const map = { high: 'High', medium: 'Balanced', low: 'Low' };
    if (this.els.navQualityBtn) {
      this.els.navQualityBtn.textContent = `Graphics: ${map[quality] || 'High'}`;
    }
    if (this.els.pauseQualitySelect) {
      this.els.pauseQualitySelect.value = quality;
    }
  }

  setDriverNameState(name, skipInputSource = null) {
    if (this.els.inputDriverName && skipInputSource !== 'title') {
      this.els.inputDriverName.value = name;
    }
    if (this.els.pauseDriverName && skipInputSource !== 'pause') {
      this.els.pauseDriverName.value = name;
    }
  }

  _applyDropdownSelectionClasses(btn, isSelected) {
    btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    btn.classList.toggle('border-[#22e4ff]', isSelected);
    btn.classList.toggle('bg-[#21194a]', isSelected);
    btn.classList.toggle('text-white', isSelected);
    btn.classList.toggle('border-white/12', !isSelected);
    btn.classList.toggle('bg-[#151030]', !isSelected);
    btn.classList.toggle('text-slate-200', !isSelected);
  }

  setCarModelState(modelId) {
    const activeModel =
      CAR_MODEL_PRESETS.find((m) => m.id === modelId) || CAR_MODEL_PRESETS[0];

    if (this.els.titleModelStats) {
      this.els.titleModelStats.textContent = `SPD ${activeModel.speedRating} · HND ${activeModel.handlingRating} · N2O ${activeModel.nitroRating}`;
    }
    if (this.els.ddModelName) {
      this.els.ddModelName.textContent = activeModel.name;
    }
    if (this.els.ddModelClass) {
      this.els.ddModelClass.textContent = `· ${activeModel.category || 'Hyper Coupe'}`;
    }
    if (this.els.pauseModelSelect) {
      this.els.pauseModelSelect.value = activeModel.id;
    }

    document.querySelectorAll('[data-car-model]').forEach((btn) => {
      const isSelected = btn.getAttribute('data-car-model') === activeModel.id;
      this._applyDropdownSelectionClasses(btn, isSelected);
    });
  }

  setCarPaintState(presetId) {
    const activePreset =
      CAR_PAINT_PRESETS.find((p) => p.id === presetId) || CAR_PAINT_PRESETS[0];

    if (this.els.titlePaintLabel) {
      this.els.titlePaintLabel.textContent = activePreset.finishType;
    }
    if (this.els.ddPaintSwatch) {
      this.els.ddPaintSwatch.style.backgroundColor = activePreset.swatch;
    }
    if (this.els.ddPaintName) {
      this.els.ddPaintName.textContent = activePreset.name;
    }
    if (this.els.pausePaintSelect) {
      this.els.pausePaintSelect.value = activePreset.id;
    }

    document.querySelectorAll('[data-car-paint]').forEach((btn) => {
      const isSelected = btn.getAttribute('data-car-paint') === activePreset.id;
      this._applyDropdownSelectionClasses(btn, isSelected);
    });
  }

  setAtmosphereState(themeId) {
    const activeTheme =
      ATMOSPHERE_PRESETS.find((t) => t.id === themeId) || ATMOSPHERE_PRESETS[0];

    const swatchMap = {
      midnight: '#ff2eb6',
      city: '#38bdf8',
      track: '#a3ff2e',
      sunset: '#ff8c1a',
      cyber_dusk: '#c084fc',
    };
    if (this.els.ddAtmoSwatch) {
      this.els.ddAtmoSwatch.style.backgroundColor =
        activeTheme.swatch || swatchMap[activeTheme.id] || '#ff2eb6';
    }
    if (this.els.ddAtmoLabel) {
      this.els.ddAtmoLabel.textContent = activeTheme.name;
    }
    if (this.els.pauseAtmosphereSelect) {
      this.els.pauseAtmosphereSelect.value = activeTheme.id;
    }

    document.querySelectorAll('[data-atmosphere]').forEach((btn) => {
      const isSelected = btn.getAttribute('data-atmosphere') === activeTheme.id;
      this._applyDropdownSelectionClasses(btn, isSelected);
    });
  }

  syncSettingsControls(settings = {}) {
    if (typeof settings.sensitivity === 'number') {
      const txt = `${settings.sensitivity.toFixed(2)}x`;
      if (this.els.inputSensitivity) this.els.inputSensitivity.value = String(settings.sensitivity);
      if (this.els.valSensitivity) this.els.valSensitivity.textContent = txt;
      if (this.els.pauseSensitivity) this.els.pauseSensitivity.value = String(settings.sensitivity);
      if (this.els.pauseSensitivityVal) this.els.pauseSensitivityVal.textContent = txt;
    }
    if (typeof settings.deadZoneDeg === 'number') {
      if (this.els.inputDeadzone) this.els.inputDeadzone.value = String(settings.deadZoneDeg);
      if (this.els.valDeadzone) {
        this.els.valDeadzone.textContent = `${settings.deadZoneDeg.toFixed(1)}°`;
      }
    }
    if (typeof settings.smoothingRate === 'number') {
      if (this.els.inputSmoothing) this.els.inputSmoothing.value = String(settings.smoothingRate);
      if (this.els.valSmoothing) {
        const desc =
          settings.smoothingRate <= 9
            ? 'Smooth'
            : settings.smoothingRate <= 15
              ? 'Balanced'
              : 'Direct';
        this.els.valSmoothing.textContent = desc;
      }
    }
    if (typeof settings.maxAngleDeg === 'number') {
      if (this.els.inputMaxangle) this.els.inputMaxangle.value = String(settings.maxAngleDeg);
      if (this.els.valMaxangle) {
        this.els.valMaxangle.textContent = `${Math.round(settings.maxAngleDeg)}°`;
      }
    }
    if (settings.pedalMode) {
      if (this.els.selectPedalMode) this.els.selectPedalMode.value = settings.pedalMode;
      if (this.els.pedalModeHint) {
        this.els.pedalModeHint.textContent =
          PEDAL_MODE_HINTS[settings.pedalMode] || PEDAL_MODE_HINTS.grip_gas_palm_brake;
      }
    }
  }

  syncDriveSettings(summary = {}) {
    const {
      accelMode = 'manual_throttle',
      modeShortName = 'Manual Gas',
      modeDescription = '',
      speedScale = 0.9,
      accelRate = 0.85,
      throttleLevel = 0,
      throttleTargetKmh = 0,
      cruiseKmh = 73,
      maxThrottleKmh = 113,
      activePresetId = 'smooth',
    } = summary;

    const speedPct = Math.round(speedScale * 100);
    const accelPct = Math.round(accelRate * 100);
    const throttlePct = Math.round(throttleLevel * 100);
    const accelFeel =
      accelRate <= 0.65 ? 'Gentle' : accelRate <= 0.98 ? 'Smooth' : 'Sport';
    const targetKmh =
      accelMode === 'manual_throttle' ? `Max ${maxThrottleKmh} km/h` : `${cruiseKmh} km/h`;

    if (this.els.ddAccelLabel) {
      this.els.ddAccelLabel.textContent = `${modeShortName} · ${speedPct}% Pace`;
    }
    if (this.els.titleAccelSummary) {
      this.els.titleAccelSummary.textContent = `${targetKmh} · ${accelFeel}`;
    }
    if (this.els.titleAccelHint && modeDescription) {
      this.els.titleAccelHint.textContent = modeDescription;
    }

    const throttleReadout =
      throttlePct === 0 ? '0% (Pedal Control)' : `${throttlePct}% (${throttleTargetKmh} km/h)`;
    for (const el of [this.els.titleThrottleLevel, this.els.pauseThrottleLevel]) {
      if (el) el.value = String(throttleLevel);
    }
    for (const el of [this.els.titleThrottleVal, this.els.pauseThrottleVal]) {
      if (el) el.textContent = throttleReadout;
    }

    const speedReadout = `${speedPct}% (${targetKmh})`;
    for (const el of [this.els.titleSpeedScale, this.els.pauseSpeedScale, this.els.calSpeedScale]) {
      if (el) el.value = String(speedScale);
    }
    for (const el of [this.els.titleSpeedVal, this.els.pauseSpeedVal, this.els.calSpeedVal]) {
      if (el) el.textContent = speedReadout;
    }

    const accelReadout = `${accelPct}% · ${accelFeel}`;
    for (const el of [this.els.titleAccelRate, this.els.pauseAccelRate, this.els.calAccelRate]) {
      if (el) el.value = String(accelRate);
    }
    for (const el of [this.els.titleAccelVal, this.els.pauseAccelVal, this.els.calAccelVal]) {
      if (el) el.textContent = accelReadout;
    }

    if (this.els.pauseAccelMode) {
      this.els.pauseAccelMode.value = accelMode;
    }

    document.querySelectorAll('[data-accel-mode]').forEach((btn) => {
      const isSelected = btn.getAttribute('data-accel-mode') === accelMode;
      this._applyDropdownSelectionClasses(btn, isSelected);
    });

    document.querySelectorAll('[data-speed-preset]').forEach((btn) => {
      const isSelected = btn.getAttribute('data-speed-preset') === activePresetId;
      this._applyDropdownSelectionClasses(btn, isSelected);
    });
  }

  openConsentModal() {
    if (!this.els.consentModal) return;
    this.els.cameraErrorBox?.classList.add('hidden');
    this.els.cameraLoadingBox?.classList.add('hidden');
    if (this.els.btnConfirmCamera) {
      this.els.btnConfirmCamera.disabled = false;
      this.els.btnConfirmCamera.textContent = 'Allow Camera & Drive!';
    }
    this.els.consentModal.classList.remove('hidden');
    gsap.fromTo(
      this.els.consentModal.firstElementChild,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.2, ease: 'power2.out' },
    );
  }

  setConsentLoading(isLoading, message = '') {
    if (this.els.cameraLoadingBox) {
      this.els.cameraLoadingBox.classList.toggle('hidden', !isLoading);
    }
    if (message && this.els.cameraLoadingText) {
      this.els.cameraLoadingText.textContent = message;
    }
    if (this.els.btnConfirmCamera) {
      this.els.btnConfirmCamera.disabled = isLoading;
      this.els.btnConfirmCamera.textContent = isLoading
        ? 'Starting Camera...'
        : 'Allow Camera & Drive!';
    }
  }

  showConsentError(title, detail) {
    this.setConsentLoading(false);
    if (this.els.consentModal?.classList.contains('hidden')) {
      this.els.consentModal.classList.remove('hidden');
    }
    if (this.els.cameraErrorBox) {
      this.els.cameraErrorBox.classList.remove('hidden');
    }
    if (this.els.cameraErrorTitle) this.els.cameraErrorTitle.textContent = title;
    if (this.els.cameraErrorDetail) this.els.cameraErrorDetail.textContent = detail;
    if (this.els.btnConfirmCamera) {
      this.els.btnConfirmCamera.textContent = 'Retry Camera & Drive!';
    }
  }

  closeConsentModal() {
    this.els.consentModal?.classList.add('hidden');
  }

  openCalibrationScreen(settings, driveSummary = null) {
    this.syncSettingsControls(settings);
    if (driveSummary) {
      this.syncDriveSettings(driveSummary);
    }
    if (!this.els.calibrationScreen) return;
    this.els.calibrationScreen.classList.remove('hidden');
    gsap.fromTo(
      this.els.calibrationScreen.firstElementChild,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.22, ease: 'power2.out' },
    );
  }

  closeCalibrationScreen() {
    this.els.calibrationScreen?.classList.add('hidden');
  }

  updateCalibrationView({
    evalState,
    progress = 0,
    isCalibrated = false,
    neutralAngleDeg = 0,
  }) {
    const {
      steer = 0,
      handCount = 0,
      confidence = 0,
      status = 'CALIBRATE STEERING',
    } = evalState || {};

    if (this.els.calStatusBadge) {
      this.els.calStatusBadge.textContent = status;
      this.els.calStatusBadge.style.color =
        handCount === 0 ? '#ffe224' : '#22e4ff';
    }
    if (this.els.calConfidenceText) {
      const confStr = handCount > 0 ? `${Math.round(confidence * 100)}%` : '--';
      this.els.calConfidenceText.textContent = `Hands: ${handCount} · Conf: ${confStr}`;
    }

    if (this.els.calInstructionText) {
      if (handCount === 0) {
        this.els.calInstructionText.textContent =
          'Raise 1 or 2 hands into camera view — horizontal = straight ahead!';
      } else if (!isCalibrated) {
        this.els.calInstructionText.textContent =
          handCount >= 2
            ? '2 hands tracked! Hold steady to auto-lock, or click DRIVE NOW!'
            : '1 hand tracked! Hold steady to auto-lock, or click DRIVE NOW!';
      } else {
        this.els.calInstructionText.textContent =
          handCount >= 2
            ? '2-Hand Wheel Ready! Rotate left/right to test, then click DRIVE NOW!'
            : '1-Hand Steer Ready! Move left/right to test, then click DRIVE NOW!';
      }
    }

    if (this.els.calProgressPct) {
      this.els.calProgressPct.textContent = isCalibrated
        ? 'READY ✓'
        : `${Math.round(progress * 100)}%`;
    }

    if (this.els.calWheelSvg) {
      const deg = Math.max(-115, Math.min(115, steer * 115));
      this.els.calWheelSvg.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    }

    if (this.els.calDirectionLabel) {
      this.els.calDirectionLabel.textContent = status;
    }

    if (this.els.calAngleReadout) {
      const pct = Math.round(steer * 100);
      const sign = pct > 0 ? '+' : '';
      this.els.calAngleReadout.textContent = `Steer: ${sign}${pct}% · Center: ${neutralAngleDeg.toFixed(1)}°`;
    }
  }

  openPauseModal({
    context = 'race',
    controlMode = 'keyboard',
    settings = {},
    driveSettings = null,
    quality = 'high',
  }) {
    this.pauseContext = context;
    this.syncSettingsControls(settings);
    if (driveSettings) {
      this.syncDriveSettings(driveSettings);
    }
    this.setQualityState(quality);

    const isTitleSettings = context === 'title';
    const isCamera = controlMode === 'camera';

    if (this.els.pauseTitle) {
      this.els.pauseTitle.textContent = isTitleSettings ? 'Garage & World Settings' : 'Race Paused';
    }
    if (this.els.pauseModeLabel) {
      this.els.pauseModeLabel.textContent = isTitleSettings
        ? 'Preferences'
        : `Mode: ${isCamera ? 'Hand Wheel' : 'Keys / Touch'}`;
    }
    if (this.els.btnResumeRace) {
      this.els.btnResumeRace.textContent = isTitleSettings ? 'Save & Close' : 'Resume Race [Esc]';
    }
    if (this.els.btnPauseRecalibrate) {
      this.els.btnPauseRecalibrate.classList.toggle('hidden', isTitleSettings || !isCamera);
    }
    if (this.els.btnPauseRestart) {
      this.els.btnPauseRestart.classList.toggle('hidden', isTitleSettings);
    }
    if (this.els.btnPauseSwitchMode) {
      this.els.btnPauseSwitchMode.classList.toggle('hidden', isTitleSettings);
      this.els.btnPauseSwitchMode.textContent = isCamera
        ? 'Switch to Keys/Touch'
        : 'Switch to Hand Wheel';
    }
    if (this.els.btnPauseQuit) {
      this.els.btnPauseQuit.classList.toggle('hidden', isTitleSettings);
    }

    this.els.pauseModal?.classList.remove('hidden');
    if (this.els.pauseModal?.firstElementChild) {
      gsap.fromTo(
        this.els.pauseModal.firstElementChild,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.18, ease: 'power2.out' },
      );
    }
  }

  hidePauseModal() {
    this.els.pauseModal?.classList.add('hidden');
  }

  openHelp() {
    if (!this.els.helpModal) return;
    this.els.helpModal.classList.remove('hidden');
    gsap.fromTo(
      this.els.helpModal.firstElementChild,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.18, ease: 'power2.out' },
    );
  }

  closeHelp() {
    this.els.helpModal?.classList.add('hidden');
  }
}
