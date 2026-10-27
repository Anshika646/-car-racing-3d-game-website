/**
 * HUD.js
 *
 * Manages the active racing Heads-Up Display:
 * - Score, Personal Best, Distance & Live Combo Multiplier Badge
 * - Speedometer + Interactive Nitro Boost Gauge ([Space] or click/hold)
 * - Camera View Switcher ([C]: Chase / Action Close / Hood)
 * - Virtual Steering Wheel & Gesture Tracking Status Banner
 * - Collapsible Bottom Gauge Dock & Mirrored Webcam PiP Panel
 */

import gsap from 'gsap';
import { GESTURE_STATUS } from '../controls/SteeringCalibration.js';

export class HUD {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.isDockCollapsed = false;
    this.isPipMinimized = false;
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
      btnRecalibrate: document.getElementById('btn-hud-recalibrate'),
      btnMute: document.getElementById('btn-hud-mute'),
      btnPause: document.getElementById('btn-hud-pause'),
      speedPanel: document.getElementById('hud-speed-panel'),
      speed: document.getElementById('hud-speed'),
      speedBar: document.getElementById('hud-speed-bar'),
      pedalState: document.getElementById('hud-pedal-state'),
      difficultyTier: document.getElementById('hud-difficulty-tier'),
      nitroBar: document.getElementById('hud-nitro-bar'),
      nitroPct: document.getElementById('hud-nitro-pct'),
      btnNitro: document.getElementById('btn-hud-nitro'),
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
    this.els.btnRecalibrate?.addEventListener('click', () => this.callbacks.onRecalibrate?.());
    this.els.btnCameraView?.addEventListener('click', () => this.callbacks.onCycleCamera?.());
    this.els.btnToggleDock?.addEventListener('click', () => this.toggleDock());
    this.els.btnTogglePipSize?.addEventListener('click', () => this.togglePipMinimize());

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
    const isCamera = controlMode === 'camera';
    if (this.els.controlMode) {
      this.els.controlMode.textContent = isCamera ? 'Camera Steering' : 'Keyboard Controls';
    }
    if (this.els.cameraPip) {
      this.els.cameraPip.classList.toggle('hidden', !isCamera);
    }
    if (this.els.btnRecalibrate) {
      this.els.btnRecalibrate.classList.toggle('hidden', !isCamera);
    }
  }

  setCameraViewLabel(viewId = 'chase') {
    if (!this.els.btnCameraView) return;
    const labels = {
      chase: 'Cam: Chase [C]',
      close: 'Cam: Action [C]',
      hood: 'Cam: Hood [C]',
    };
    this.els.btnCameraView.textContent = labels[viewId] || 'Cam: Chase [C]';
  }

  setMutedState(isMuted) {
    if (this.els.btnMute) {
      this.els.btnMute.textContent = isMuted ? 'Sound: Off' : 'Sound: On';
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
        ? '▴ Show Gauge [H]'
        : '▾ Hide Gauge [H]';
    }
  }

  togglePipMinimize() {
    this.isPipMinimized = !this.isPipMinimized;
    if (this.els.pipVideoWrapper) {
      this.els.pipVideoWrapper.classList.toggle('hidden', this.isPipMinimized);
    }
    if (this.els.btnTogglePipSize) {
      this.els.btnTogglePipSize.textContent = this.isPipMinimized ? 'Show Video' : 'Minimize';
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
    }, 1200);
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
        ? '#e879f9'
        : isBraking
          ? '#f59e0b'
          : '#06b6d4';
    }
    if (this.els.pedalState) {
      this.els.pedalState.textContent = isBoosting
        ? 'HYPER NITRO'
        : isBraking
          ? 'Braking'
          : isAccelerating
            ? 'Accelerating'
            : 'Cruising';
      this.els.pedalState.style.color = isBoosting
        ? '#e879f9'
        : isBraking
          ? '#fbbf24'
          : isAccelerating
            ? '#67e8f9'
            : '#94a3b8';
    }
    if (this.els.difficultyTier) {
      this.els.difficultyTier.textContent = `Tier ${difficultyTier}`;
    }

    // Nitro Boost Bar & Button
    const clampedNitro = Math.min(100, Math.max(0, nitroCharge));
    if (this.els.nitroBar) {
      this.els.nitroBar.style.width = `${clampedNitro.toFixed(0)}%`;
      this.els.nitroBar.style.backgroundColor = isBoosting ? '#e879f9' : '#38bdf8';
    }
    if (this.els.nitroPct) {
      this.els.nitroPct.textContent = `${Math.round(clampedNitro)}%`;
    }
    if (this.els.btnNitro) {
      const ready = clampedNitro >= 18;
      this.els.btnNitro.style.opacity = ready || isBoosting ? '1' : '0.45';
      this.els.btnNitro.textContent = isBoosting ? 'BOOSTING!' : 'NITRO [Space]';
    }

    // Hull integrity bars
    if (this.els.hullText) {
      this.els.hullText.textContent = `${health}/${maxHealth}`;
    }
    for (let i = 0; i < this.els.hullBars.length; i++) {
      const bar = this.els.hullBars[i];
      if (!bar) continue;
      if (i < health) {
        bar.style.backgroundColor =
          health === 1 ? '#ef4444' : health === 2 ? '#f59e0b' : '#10b981';
      } else {
        bar.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
      }
    }

    // Virtual steering wheel & direction indicator
    const visualRotation = Math.max(-85, Math.min(85, wheelAngleDeg * 1.55));
    if (this.els.wheelSvg) {
      this.els.wheelSvg.style.transform = `rotate(${visualRotation.toFixed(1)}deg)`;
    }

    const isLeft = steer < -0.1;
    const isRight = steer > 0.1;
    if (this.els.dirLeft) {
      this.els.dirLeft.style.color = isLeft ? '#22d3ee' : '#64748b';
    }
    if (this.els.dirRight) {
      this.els.dirRight.style.color = isRight ? '#22d3ee' : '#64748b';
    }

    if (this.els.steerFill) {
      const pctMag = Math.min(50, Math.abs(steer) * 50);
      if (steer < 0) {
        this.els.steerFill.style.left = `${(50 - pctMag).toFixed(1)}%`;
        this.els.steerFill.style.width = `${pctMag.toFixed(1)}%`;
      } else {
        this.els.steerFill.style.left = '50%';
        this.els.steerFill.style.width = `${pctMag.toFixed(1)}%`;
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
          ? 'rgba(245, 158, 11, 0.65)'
          : 'rgba(255, 255, 255, 0.12)';
        this.els.gestureStatus.style.color = isLost ? '#fbbf24' : '#22d3ee';

        if (this.els.pipTrackingLabel) {
          if (handCount >= 2) {
            const confPct = Math.round(confidence * 100);
            this.els.pipTrackingLabel.textContent = `2 Hands · ${confPct}% Conf`;
            this.els.pipTrackingLabel.style.color = '#22d3ee';
          } else if (handCount === 1) {
            this.els.pipTrackingLabel.textContent = '1 Hand — Show Both Hands';
            this.els.pipTrackingLabel.style.color = '#fbbf24';
          } else {
            this.els.pipTrackingLabel.textContent = 'Searching for Hands...';
            this.els.pipTrackingLabel.style.color = '#fbbf24';
          }
        }
      } else {
        const kbStatus = isBoosting
          ? 'HYPER NITRO ENGAGED'
          : isLeft
            ? 'KEYBOARD · STEER LEFT'
            : isRight
              ? 'KEYBOARD · STEER RIGHT'
              : 'KEYBOARD CONTROLS ACTIVE';
        this.els.gestureStatus.textContent = kbStatus;
        this.els.gestureBanner.style.borderColor = isBoosting
          ? 'rgba(232, 121, 249, 0.55)'
          : 'rgba(255, 255, 255, 0.12)';
        this.els.gestureStatus.style.color = isBoosting ? '#f0abfc' : '#e2e8f0';
      }
    }
  }
}
