/**
 * HUD.js
 *
 * Manages the active Chroma Confetti Arcade Heads-Up Display:
 * - Score, Personal Best, Distance & Live Combo Multiplier Badge
 * - Rainbow Speedometer + Interactive Hyper Nitro Boost Gauge ([Space] or tap/hold)
 * - Camera View Switcher ([C]: Chase / Action Close / Hood)
 * - One-tap Hand Recenter + Tuning Studio + Rainbow Virtual Steering Wheel
 * - Collapsible Bottom Wheel Dock & Mirrored Webcam PiP Panel
 */

import gsap from 'gsap';
import { GESTURE_STATUS } from '../controls/SteeringCalibration.js';

function detectTouchCapable() {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (navigator && navigator.maxTouchPoints > 0) ||
    Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
  );
}

export class HUD {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.isDockCollapsed = false;
    this.isPipMinimized = false;
    this.hasTouchSupport = detectTouchCapable();
    this._currentControlMode = 'keyboard';
    this._bonusTimer = null;

    this.els = {
      root: document.getElementById('race-hud'),
      score: document.getElementById('hud-score'),
      distance: document.getElementById('hud-distance'),
      best: document.getElementById('hud-best'),
      comboBadge: document.getElementById('hud-combo-badge'),
      gestureBanner: document.getElementById('hud-gesture-banner'),
      gestureStatus: document.getElementById('hud-gesture-status'),
      bonusToast: document.getElementById('hud-bonus-toast'),
      hullBars: [
        document.getElementById('hull-bar-1'),
        document.getElementById('hull-bar-2'),
        document.getElementById('hull-bar-3'),
      ],
      hullText: document.getElementById('hud-hull-text'),
      controlMode: document.getElementById('hud-control-mode'),
      btnCameraView: document.getElementById('btn-hud-camera-view'),
      btnRecenter: document.getElementById('btn-hud-recenter'),
      btnRecalibrate: document.getElementById('btn-hud-recalibrate'),
      btnMute: document.getElementById('btn-hud-mute'),
      btnPause: document.getElementById('btn-hud-pause'),
      speedPanel: document.getElementById('hud-speed-panel'),
      speed: document.getElementById('hud-speed'),
      speedBar: document.getElementById('hud-speed-bar'),
      pedalState: document.getElementById('hud-pedal-state'),
      difficultyTier: document.getElementById('hud-difficulty-tier'),
      btnAccelMode: document.getElementById('btn-hud-accel-mode'),
      btnSpeedDown: document.getElementById('btn-hud-speed-down'),
      btnSpeedUp: document.getElementById('btn-hud-speed-up'),
      speedCapLabel: document.getElementById('hud-speed-cap'),
      nitroBar: document.getElementById('hud-nitro-bar'),
      nitroPct: document.getElementById('hud-nitro-pct'),
      btnGas: document.getElementById('btn-hud-gas'),
      btnNitro: document.getElementById('btn-hud-nitro'),
      touchControls: document.getElementById('hud-touch-controls'),
      touchSteerZone: document.getElementById('touch-steer-zone'),
      btnTouchLeft: document.getElementById('btn-touch-left'),
      btnTouchRight: document.getElementById('btn-touch-right'),
      btnTouchGas: document.getElementById('btn-touch-gas'),
      btnTouchBrake: document.getElementById('btn-touch-brake'),
      btnTouchNitro: document.getElementById('btn-touch-nitro'),
      btnToggleDock: document.getElementById('btn-toggle-hud-dock'),
      steeringDock: document.getElementById('hud-steering-dock'),
      dirLeft: document.getElementById('hud-dir-left'),
      dirRight: document.getElementById('hud-dir-right'),
      wheelSvg: document.getElementById('hud-wheel-svg'),
      steerFill: document.getElementById('hud-steer-fill'),
      steerText: document.getElementById('hud-steer-text'),
      cameraPip: document.getElementById('hud-camera-pip'),
      pipTrackingLabel: document.getElementById('pip-tracking-label'),
      btnTogglePipSize: document.getElementById('btn-toggle-pip-size'),
      pipVideoWrapper: document.getElementById('pip-video-wrapper'),
      videoPreview: document.getElementById('hud-video-preview'),
      landmarkCanvas: document.getElementById('hud-landmark-canvas'),
      countdownOverlay: document.getElementById('countdown-overlay'),
      countdownNumber: document.getElementById('countdown-number'),
      countdownSub: document.getElementById('countdown-sub'),
    };

    this._bindEvents();
  }

  _bindEvents() {
    this.els.btnPause?.addEventListener('click', () => this.callbacks.onPause?.());
    this.els.btnMute?.addEventListener('click', () => this.callbacks.onToggleMute?.());
    this.els.btnRecenter?.addEventListener('click', () => this.callbacks.onRecenterHands?.());
    this.els.btnRecalibrate?.addEventListener('click', () => this.callbacks.onRecalibrate?.());
    this.els.btnCameraView?.addEventListener('click', () => this.callbacks.onCycleCamera?.());
    this.els.btnToggleDock?.addEventListener('click', () => this.toggleDock());
    this.els.btnTogglePipSize?.addEventListener('click', () => this.togglePipMinimize());
    this.els.btnAccelMode?.addEventListener('click', () => this.callbacks.onCycleAccelMode?.());
    this.els.btnSpeedDown?.addEventListener('click', () => this.callbacks.onAdjustSpeed?.(-0.1));
    this.els.btnSpeedUp?.addEventListener('click', () => this.callbacks.onAdjustSpeed?.(0.1));

    if (this.els.btnGas) {
      const startGas = (e) => {
        e.preventDefault();
        this.callbacks.onTriggerGas?.(true);
      };
      const stopGas = () => {
        this.callbacks.onTriggerGas?.(false);
      };
      this.els.btnGas.addEventListener('pointerdown', startGas);
      this.els.btnGas.addEventListener('pointerup', stopGas);
      this.els.btnGas.addEventListener('pointerleave', stopGas);
      this.els.btnGas.addEventListener('pointercancel', stopGas);
    }

    if (this.els.btnNitro) {
      const startNitro = (e) => {
        e.preventDefault();
        this.callbacks.onTriggerNitro?.(true);
      };
      const stopNitro = () => {
        this.callbacks.onTriggerNitro?.(false);
      };
      this.els.btnNitro.addEventListener('pointerdown', startNitro);
      this.els.btnNitro.addEventListener('pointerup', stopNitro);
      this.els.btnNitro.addEventListener('pointerleave', stopNitro);
      this.els.btnNitro.addEventListener('pointercancel', stopNitro);
    }

    // Bind dedicated Mobile Multi-Touch Steering & Pedals
    this._bindTouchButton(this.els.btnTouchLeft, 'left');
    this._bindTouchButton(this.els.btnTouchRight, 'right');
    this._bindTouchButton(this.els.btnTouchGas, 'accelerate');
    this._bindTouchButton(this.els.btnTouchBrake, 'brake');
    this._bindTouchButton(this.els.btnTouchNitro, 'boost');

    // Allow smooth left-thumb slide across the steer zone between ◀ and ▶
    if (this.els.touchSteerZone) {
      let steerPointerId = null;
      const updateSlideSteer = (clientX) => {
        const rect = this.els.touchSteerZone.getBoundingClientRect();
        const midX = rect.left + rect.width * 0.5;
        const goLeft = clientX < midX;
        this.callbacks.onTouchControl?.('left', goLeft);
        this.callbacks.onTouchControl?.('right', !goLeft);
      };
      this.els.touchSteerZone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        steerPointerId = e.pointerId;
        this.els.touchSteerZone.setPointerCapture?.(e.pointerId);
        updateSlideSteer(e.clientX);
      });
      this.els.touchSteerZone.addEventListener('pointermove', (e) => {
        if (e.pointerId === steerPointerId) {
          updateSlideSteer(e.clientX);
        }
      });
      const releaseSlide = (e) => {
        if (e.pointerId === steerPointerId) {
          steerPointerId = null;
          this.callbacks.onTouchControl?.('left', false);
          this.callbacks.onTouchControl?.('right', false);
        }
      };
      this.els.touchSteerZone.addEventListener('pointerup', releaseSlide);
      this.els.touchSteerZone.addEventListener('pointercancel', releaseSlide);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(
        'touchstart',
        () => {
          if (!this.hasTouchSupport) {
            this.hasTouchSupport = true;
            this._syncTouchPadVisibility();
          }
        },
        { passive: true },
      );
      window.addEventListener('resize', () => this._syncTouchPadVisibility());
    }
  }

  _bindTouchButton(btn, controlName) {
    if (!btn) return;
    if (controlName === 'left' || controlName === 'right') return;

    const press = (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      if (controlName === 'boost') {
        this.callbacks.onTriggerNitro?.(true);
      }
      this.callbacks.onTouchControl?.(controlName, true);
    };
    const release = () => {
      if (controlName === 'boost') {
        this.callbacks.onTriggerNitro?.(false);
      }
      this.callbacks.onTouchControl?.(controlName, false);
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
  }

  _syncTouchPadVisibility() {
    if (!this.els.touchControls) return;
    const isSmallViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    const showTouchPads =
      this._currentControlMode !== 'camera' && (this.hasTouchSupport || isSmallViewport);
    this.els.touchControls.classList.toggle('hidden', !showTouchPads);
  }

  show(controlMode = 'keyboard') {
    if (!this.els.root) return;
    this.els.root.classList.remove('hidden');
    this.setControlMode(controlMode);
    gsap.fromTo(
      this.els.root,
      { opacity: 0 },
      { opacity: 1, duration: 0.25, ease: 'power2.out' },
    );
  }

  hide() {
    if (!this.els.root) return;
    this.els.root.classList.add('hidden');
    this.hideCountdown();
  }

  setControlMode(controlMode) {
    this._currentControlMode = controlMode;
    const isCamera = controlMode === 'camera';
    if (this.els.controlMode) {
      this.els.controlMode.textContent = isCamera
        ? 'Hand Wheel'
        : this.hasTouchSupport
          ? 'Touch / Keys'
          : 'Keyboard';
    }
    if (this.els.cameraPip) {
      this.els.cameraPip.classList.toggle('hidden', !isCamera);
    }
    if (this.els.btnRecenter) {
      this.els.btnRecenter.classList.toggle('hidden', !isCamera);
    }
    if (this.els.btnRecalibrate) {
      this.els.btnRecalibrate.classList.toggle('hidden', !isCamera);
    }
    this._syncTouchPadVisibility();
  }

  setCameraViewLabel(viewId = 'chase') {
    if (!this.els.btnCameraView) return;
    const labels = {
      chase: 'Cam: Chase',
      close: 'Cam: Action',
      hood: 'Cam: Hood',
    };
    this.els.btnCameraView.textContent = labels[viewId] || 'Cam: Chase';
  }

  setMutedState(isMuted) {
    if (this.els.btnMute) {
      this.els.btnMute.textContent = isMuted ? 'Sound: Off' : 'Sound: On';
    }
  }

  syncDriveSettings(summary = {}) {
    if (this.els.btnAccelMode && summary.modeShortName) {
      this.els.btnAccelMode.textContent = summary.modeShortName;
    }
    if (this.els.speedCapLabel && typeof summary.speedScale === 'number') {
      this.els.speedCapLabel.textContent = `${Math.round(summary.speedScale * 100)}%`;
    }
  }

  toggleDock() {
    this.isDockCollapsed = !this.isDockCollapsed;
    if (this.els.steeringDock) {
      gsap.to(this.els.steeringDock, {
        y: this.isDockCollapsed ? 80 : 0,
        opacity: this.isDockCollapsed ? 0 : 1,
        duration: 0.18,
        ease: 'power2.out',
      });
      this.els.steeringDock.style.pointerEvents = this.isDockCollapsed ? 'none' : 'auto';
    }
    if (this.els.btnToggleDock) {
      this.els.btnToggleDock.textContent = this.isDockCollapsed
        ? '▴ Show Wheel [H]'
        : '▾ Hide Wheel [H]';
    }
  }

  togglePipMinimize() {
    this.isPipMinimized = !this.isPipMinimized;
    if (this.els.pipVideoWrapper) {
      this.els.pipVideoWrapper.classList.toggle('hidden', this.isPipMinimized);
    }
    if (this.els.btnTogglePipSize) {
      this.els.btnTogglePipSize.textContent = this.isPipMinimized ? 'Show' : 'Hide';
    }
  }

  showCountdownStep(label, subtitle = '') {
    if (!this.els.countdownOverlay || !this.els.countdownNumber) return;
    this.els.countdownOverlay.classList.remove('hidden');
    this.els.countdownNumber.textContent = label;
    if (this.els.countdownSub) {
      this.els.countdownSub.textContent = subtitle;
    }
    gsap.fromTo(
      this.els.countdownNumber,
      { scale: 1.35, opacity: 0.25 },
      { scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(1.6)' },
    );
  }

  hideCountdown() {
    if (!this.els.countdownOverlay) return;
    this.els.countdownOverlay.classList.add('hidden');
  }

  showBonusToast(message = 'NEAR MISS +50') {
    if (!this.els.bonusToast) return;
    this.els.bonusToast.textContent = message;
    this.els.bonusToast.style.opacity = '1';
    this.els.bonusToast.style.transform = 'translateY(0)';

    if (this._bonusTimer) clearTimeout(this._bonusTimer);
    this._bonusTimer = setTimeout(() => {
      if (this.els.bonusToast) {
        this.els.bonusToast.style.opacity = '0';
        this.els.bonusToast.style.transform = 'translateY(-4px)';
      }
    }, 1250);
  }

  update(state) {
    const {
      score = 0,
      bestScore = 0,
      distanceMeters = 0,
      speedKmh = 0,
      maxSpeedKmh = 285,
      health = 3,
      maxHealth = 3,
      steer = 0,
      wheelAngleDeg = 0,
      controlMode = 'keyboard',
      gestureStatus = '',
      confidence = 0,
      handCount = 0,
      isAccelerating = false,
      isBraking = false,
      isBoosting = false,
      nitroCharge = 100,
      combo = 1,
      difficultyTier = 1,
      accelMode = 'smooth_auto',
      speedScale = 1.0,
    } = state;

    if (this.els.score) {
      this.els.score.textContent = Math.floor(score).toLocaleString();
    }
    if (this.els.best) {
      this.els.best.textContent = `Best ${Math.floor(bestScore).toLocaleString()}`;
    }
    if (this.els.distance) {
      this.els.distance.textContent = `${(distanceMeters / 1000).toFixed(2)} km`;
    }
    if (this.els.comboBadge) {
      if (combo > 1) {
        this.els.comboBadge.classList.remove('hidden');
        this.els.comboBadge.textContent = `COMBO x${combo}`;
      } else {
        this.els.comboBadge.classList.add('hidden');
      }
    }

    if (this.els.speed) {
      this.els.speed.textContent = String(Math.round(speedKmh));
    }
    if (this.els.speedBar) {
      const pct = Math.min(100, Math.max(0, (speedKmh / maxSpeedKmh) * 100));
      this.els.speedBar.style.width = `${pct.toFixed(1)}%`;
      this.els.speedBar.style.backgroundColor = isBoosting
        ? '#ff2eb6'
        : isBraking
          ? '#ff8c1a'
          : isAccelerating
            ? '#a3ff2e'
            : '#22e4ff';
    }
    if (this.els.pedalState) {
      const isManual = accelMode === 'manual_throttle';
      const isSteady = accelMode === 'constant_cruise';
      this.els.pedalState.textContent = isBoosting
        ? 'HYPER NITRO ⚡'
        : isBraking
          ? 'Braking'
          : isAccelerating && !isSteady
            ? 'Accelerating'
            : isManual
              ? 'Coasting [Hold Gas]'
              : isSteady
                ? 'Steady Lock'
                : 'Cruising';
      this.els.pedalState.style.color = isBoosting
        ? '#ff2eb6'
        : isBraking
          ? '#ffe224'
          : isAccelerating && !isSteady
            ? '#a3ff2e'
            : '#cbd5e1';
    }
    if (this.els.difficultyTier) {
      this.els.difficultyTier.textContent = `Tier ${difficultyTier}`;
    }
    if (this.els.speedCapLabel && typeof speedScale === 'number') {
      this.els.speedCapLabel.textContent = `${Math.round(speedScale * 100)}%`;
    }

    // Nitro Boost & Gas Buttons
    const clampedNitro = Math.min(100, Math.max(0, nitroCharge));
    if (this.els.nitroBar) {
      this.els.nitroBar.style.width = `${clampedNitro.toFixed(0)}%`;
      this.els.nitroBar.style.backgroundColor = isBoosting ? '#ffe224' : '#ff2eb6';
    }
    if (this.els.nitroPct) {
      this.els.nitroPct.textContent = `${Math.round(clampedNitro)}%`;
    }
    if (this.els.btnGas) {
      this.els.btnGas.style.borderColor = isAccelerating
        ? '#a3ff2e'
        : 'rgba(163, 255, 46, 0.45)';
    }
    if (this.els.btnNitro) {
      const ready = clampedNitro >= 18;
      this.els.btnNitro.style.opacity = ready || isBoosting ? '1' : '0.45';
      this.els.btnNitro.textContent = isBoosting ? 'BOOST! ⚡' : 'NITRO';
    }

    // Shield integrity bars
    if (this.els.hullText) {
      this.els.hullText.textContent = `${health}/${maxHealth}`;
    }
    for (let i = 0; i < this.els.hullBars.length; i++) {
      const bar = this.els.hullBars[i];
      if (!bar) continue;
      if (i < health) {
        bar.style.backgroundColor =
          health === 1 ? '#ff2442' : health === 2 ? '#ffe224' : '#a3ff2e';
      } else {
        bar.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
      }
    }

    // Rainbow Virtual Steering Wheel & Direction Indicator (±115° full arcade sweep!)
    const visualRotation = Math.max(-115, Math.min(115, steer * 115));
    if (this.els.wheelSvg) {
      this.els.wheelSvg.style.transform = `rotate(${visualRotation.toFixed(1)}deg)`;
    }

    const isLeft = steer < -0.08;
    const isRight = steer > 0.08;
    if (this.els.dirLeft) {
      this.els.dirLeft.style.color = isLeft ? '#ff8c1a' : '#64748b';
    }
    if (this.els.dirRight) {
      this.els.dirRight.style.color = isRight ? '#22e4ff' : '#64748b';
    }

    if (this.els.steerFill) {
      const pctMag = Math.min(50, Math.abs(steer) * 50);
      if (steer < 0) {
        this.els.steerFill.style.left = `${(50 - pctMag).toFixed(1)}%`;
        this.els.steerFill.style.width = `${pctMag.toFixed(1)}%`;
        this.els.steerFill.style.backgroundColor = '#ff8c1a';
      } else {
        this.els.steerFill.style.left = '50%';
        this.els.steerFill.style.width = `${pctMag.toFixed(1)}%`;
        this.els.steerFill.style.backgroundColor = '#22e4ff';
      }
    }

    if (this.els.steerText) {
      const roundedDeg = Math.round(Math.abs(wheelAngleDeg));
      const dirWord = isLeft ? 'LEFT' : isRight ? 'RIGHT' : 'CENTER';
      this.els.steerText.textContent = `${dirWord} · ${roundedDeg}°`;
    }

    // Gesture & Tracking Banner
    if (this.els.gestureStatus && this.els.gestureBanner) {
      if (controlMode === 'camera') {
        const label = gestureStatus || GESTURE_STATUS.HANDS_DETECTED;
        this.els.gestureStatus.textContent = label;
        const isLost = label === GESTURE_STATUS.TRACKING_LOST;
        this.els.gestureBanner.style.borderColor = isLost
          ? 'rgba(255, 226, 36, 0.7)'
          : 'rgba(34, 228, 255, 0.35)';
        this.els.gestureStatus.style.color = isLost
          ? '#ffe224'
          : isLeft
            ? '#ff8c1a'
            : isRight
              ? '#22e4ff'
              : '#a3ff2e';

        if (this.els.pipTrackingLabel) {
          if (handCount >= 2) {
            const confPct = Math.round(confidence * 100);
            this.els.pipTrackingLabel.textContent = `2-Hand Wheel · ${confPct}%`;
            this.els.pipTrackingLabel.style.color = '#a3ff2e';
          } else if (handCount === 1) {
            const confPct = Math.round(confidence * 100);
            this.els.pipTrackingLabel.textContent = `1-Hand Steer · ${confPct}%`;
            this.els.pipTrackingLabel.style.color = '#22e4ff';
          } else {
            this.els.pipTrackingLabel.textContent = 'Raise Hands...';
            this.els.pipTrackingLabel.style.color = '#ffe224';
          }
        }
      } else {
        const modePrefix = this.hasTouchSupport ? 'TOUCH' : 'KEYS';
        const kbStatus = isBoosting
          ? 'HYPER NITRO ENGAGED ⚡'
          : isLeft
            ? `${modePrefix} · STEER LEFT`
            : isRight
              ? `${modePrefix} · STEER RIGHT`
              : `${modePrefix} CONTROLS READY`;
        this.els.gestureStatus.textContent = kbStatus;
        this.els.gestureBanner.style.borderColor = isBoosting
          ? 'rgba(255, 46, 182, 0.65)'
          : 'rgba(255, 255, 255, 0.16)';
        this.els.gestureStatus.style.color = isBoosting ? '#ff85d8' : '#22e4ff';
      }
    }
  }
}
