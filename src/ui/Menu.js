/**
 * Menu.js
 *
 * Manages Title Screen Garage (Driver Name, 4 Car Models, 8 Paint Colours, 3 Track Atmospheres),
 * Camera Consent Modal, Steering Calibration Studio, Pause/Settings Dialog, and Help Modal.
 */

import gsap from 'gsap';
import { CAR_MODEL_PRESETS, CAR_PAINT_PRESETS } from '../game/Car.js';
import { ATMOSPHERE_PRESETS } from '../game/Road.js';

const PEDAL_MODE_HINTS = {
  auto_palm_brake:
    'Car accelerates smoothly on its own. Spread both palms wide open to brake, or use W/S keys anytime.',
  grip_gas_palm_brake:
    'Grip with closed fists to accelerate. Open both palms wide to brake. Neutral relaxed hands coast.',
  palm_gas_fist_brake:
    'Hold open palms to accelerate. Close both fists to brake.',
  auto_only:
    'Automatic forward acceleration is active. Your hands are used exclusively for smooth left/right steering.',
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
      btnPlayKeyboard: document.getElementById('btn-play-keyboard'),

      // Garage Controls (Driver Name, Car Model, Paint Colour, Atmosphere)
      inputDriverName: document.getElementById('input-driver-name'),
      btnRandomDriverName: document.getElementById('btn-random-driver-name'),
      titleModelStats: document.getElementById('title-model-stats'),
      titlePaintLabel: document.getElementById('title-paint-label'),

      // Pause / Settings Equivalents
      pauseDriverName: document.getElementById('pause-driver-name'),
      pauseModelSelect: document.getElementById('pause-model-select'),
      pausePaintSelect: document.getElementById('pause-paint-select'),
      pauseAtmosphereSelect: document.getElementById('pause-atmosphere-select'),

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

      // Calibration Screen
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

    // Car Model Selection
    document.querySelectorAll('[data-car-model]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modelId = btn.getAttribute('data-car-model');
        if (modelId) {
          this.callbacks.onSelectCarModel?.(modelId);
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
        }
      });
    });
    this.els.pausePaintSelect?.addEventListener('change', (e) => {
      this.callbacks.onSelectCarPaint?.(e.target.value);
    });

    // Track Atmosphere Selection
    document.querySelectorAll('[data-atmosphere]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const themeId = btn.getAttribute('data-atmosphere');
        if (themeId) {
          this.callbacks.onSelectAtmosphere?.(themeId);
        }
      });
    });
    this.els.pauseAtmosphereSelect?.addEventListener('change', (e) => {
      this.callbacks.onSelectAtmosphere?.(e.target.value);
    });

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

  showTitleScreen(bestScore = 0) {
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

  setCarModelState(modelId) {
    const activeModel =
      CAR_MODEL_PRESETS.find((m) => m.id === modelId) || CAR_MODEL_PRESETS[0];

    if (this.els.titleModelStats) {
      this.els.titleModelStats.textContent = `${activeModel.name} · SPD ${activeModel.speedRating} · HND ${activeModel.handlingRating} · N2O ${activeModel.nitroRating}`;
    }
    if (this.els.pauseModelSelect) {
      this.els.pauseModelSelect.value = activeModel.id;
    }

    document.querySelectorAll('[data-car-model]').forEach((btn) => {
      const isSelected = btn.getAttribute('data-car-model') === activeModel.id;
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.classList.toggle('border-[#22d3ee]', isSelected);
      btn.classList.toggle('bg-[#132033]', isSelected);
      btn.classList.toggle('text-white', isSelected);
      btn.classList.toggle('border-white/12', !isSelected);
      btn.classList.toggle('bg-[#0d1422]/90', !isSelected);
      btn.classList.toggle('text-slate-300', !isSelected);
    });
  }

  setCarPaintState(presetId) {
    const activePreset =
      CAR_PAINT_PRESETS.find((p) => p.id === presetId) || CAR_PAINT_PRESETS[0];

    if (this.els.titlePaintLabel) {
      this.els.titlePaintLabel.textContent = `${activePreset.name} · ${activePreset.finishType}`;
    }
    if (this.els.pausePaintSelect) {
      this.els.pausePaintSelect.value = activePreset.id;
    }

    document.querySelectorAll('[data-car-paint]').forEach((btn) => {
      const isSelected = btn.getAttribute('data-car-paint') === activePreset.id;
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.classList.toggle('border-[#22d3ee]', isSelected);
      btn.classList.toggle('bg-[#132033]', isSelected);
      btn.classList.toggle('text-white', isSelected);
      btn.classList.toggle('border-white/12', !isSelected);
      btn.classList.toggle('bg-[#0d1422]/90', !isSelected);
      btn.classList.toggle('text-slate-300', !isSelected);
    });
  }

  setAtmosphereState(themeId) {
    const activeTheme =
      ATMOSPHERE_PRESETS.find((t) => t.id === themeId) || ATMOSPHERE_PRESETS[0];

    if (this.els.pauseAtmosphereSelect) {
      this.els.pauseAtmosphereSelect.value = activeTheme.id;
    }

    document.querySelectorAll('[data-atmosphere]').forEach((btn) => {
      const isSelected = btn.getAttribute('data-atmosphere') === activeTheme.id;
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.classList.toggle('border-[#22d3ee]', isSelected);
      btn.classList.toggle('bg-[#132033]', isSelected);
      btn.classList.toggle('text-white', isSelected);
      btn.classList.toggle('border-white/12', !isSelected);
      btn.classList.toggle('bg-[#0d1422]/90', !isSelected);
      btn.classList.toggle('text-slate-300', !isSelected);
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
          settings.smoothingRate <= 8
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
          PEDAL_MODE_HINTS[settings.pedalMode] || PEDAL_MODE_HINTS.auto_palm_brake;
      }
    }
  }

  openConsentModal() {
    if (!this.els.consentModal) return;
    this.els.cameraErrorBox?.classList.add('hidden');
    this.els.cameraLoadingBox?.classList.add('hidden');
    if (this.els.btnConfirmCamera) {
      this.els.btnConfirmCamera.disabled = false;
      this.els.btnConfirmCamera.textContent = 'Allow Camera & Calibrate';
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
        ? 'Initializing Camera...'
        : 'Allow Camera & Calibrate';
    }
  }

  showConsentError(title, detail) {
    this.setConsentLoading(false);
    if (this.els.cameraErrorBox) {
      this.els.cameraErrorBox.classList.remove('hidden');
    }
    if (this.els.cameraErrorTitle) this.els.cameraErrorTitle.textContent = title;
    if (this.els.cameraErrorDetail) this.els.cameraErrorDetail.textContent = detail;
    if (this.els.btnConfirmCamera) {
      this.els.btnConfirmCamera.textContent = 'Retry Camera Access';
    }
  }

  closeConsentModal() {
    this.els.consentModal?.classList.add('hidden');
  }

  openCalibrationScreen(settings) {
    this.syncSettingsControls(settings);
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
      wheelAngleDeg = 0,
      handCount = 0,
      confidence = 0,
      status = 'CALIBRATE STEERING',
    } = evalState || {};

    if (this.els.calStatusBadge) {
      this.els.calStatusBadge.textContent = status;
      this.els.calStatusBadge.style.color =
        handCount < 2 ? '#fbbf24' : '#22d3ee';
    }
    if (this.els.calConfidenceText) {
      const confStr = handCount > 0 ? `${Math.round(confidence * 100)}%` : '--';
      this.els.calConfidenceText.textContent = `Hands: ${handCount}/2 · Confidence: ${confStr}`;
    }

    if (this.els.calInstructionText) {
      if (handCount === 0) {
        this.els.calInstructionText.textContent =
          'Raise both hands into the camera frame like holding a steering wheel.';
      } else if (handCount === 1) {
        this.els.calInstructionText.textContent =
          '1 hand visible — bring both hands into frame so the wheel axle can form.';
      } else if (!isCalibrated) {
        this.els.calInstructionText.textContent =
          'Hold both hands steady in a comfortable neutral grip to lock center...';
      } else {
        this.els.calInstructionText.textContent =
          'Neutral calibrated! Rotate your hands left and right to test steering, then click Start Race.';
      }
    }

    if (this.els.calProgressPct) {
      this.els.calProgressPct.textContent = isCalibrated
        ? 'READY'
        : `${Math.round(progress * 100)}%`;
    }

    if (this.els.calWheelSvg) {
      const deg = Math.max(-85, Math.min(85, wheelAngleDeg * 1.55));
      this.els.calWheelSvg.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    }

    if (this.els.calDirectionLabel) {
      this.els.calDirectionLabel.textContent = status;
    }

    if (this.els.calAngleReadout) {
      const pct = Math.round(steer * 100);
      const sign = pct > 0 ? '+' : '';
      this.els.calAngleReadout.textContent = `Steer: ${sign}${pct}% · Neutral: ${neutralAngleDeg.toFixed(1)}°`;
    }
  }

  openPauseModal({ context = 'race', controlMode = 'keyboard', settings = {}, quality = 'high' }) {
    this.pauseContext = context;
    this.syncSettingsControls(settings);
    this.setQualityState(quality);

    const isTitleSettings = context === 'title';
    const isCamera = controlMode === 'camera';

    if (this.els.pauseTitle) {
      this.els.pauseTitle.textContent = isTitleSettings ? 'Garage & Game Settings' : 'Race Paused';
    }
    if (this.els.pauseModeLabel) {
      this.els.pauseModeLabel.textContent = isTitleSettings
        ? 'Preferences'
        : `Mode: ${isCamera ? 'Camera' : 'Keyboard'}`;
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
        ? 'Switch to Keyboard'
        : 'Switch to Camera';
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
