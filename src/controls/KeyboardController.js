/**
 * KeyboardController.js
 *
 * Smooth analog-ramped keyboard fallback and assist controller.
 * Supports Arrow keys + WASD, Escape (pause/resume), R (restart), H (toggle HUD gauge).
 */

export class KeyboardController {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      boost: false,
    };
    this.touch = {
      left: false,
      right: false,
      accelerate: false,
      brake: false,
      boost: false,
    };
    this.steerValue = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('blur', this._onBlur);
    }
  }

  _onKeyDown(event) {
    // Ignore shortcuts if focus is inside an input/select control
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (event.code === 'Escape' || event.code === 'Enter') {
        event.target.blur();
      }
      return;
    }

    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.left = true;
        event.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.right = true;
        event.preventDefault();
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.keys.up = true;
        event.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.keys.down = true;
        event.preventDefault();
        break;
      case 'Space':
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.boost = true;
        event.preventDefault();
        break;
      case 'Escape':
        event.preventDefault();
        this.callbacks.onEscape?.();
        break;
      case 'KeyR':
        event.preventDefault();
        this.callbacks.onRestart?.();
        break;
      case 'KeyH':
        event.preventDefault();
        this.callbacks.onToggleHud?.();
        break;
      case 'KeyC':
        event.preventDefault();
        this.callbacks.onCycleCamera?.();
        break;
      case 'Minus':
      case 'NumpadSubtract':
      case 'BracketLeft':
        event.preventDefault();
        this.callbacks.onAdjustSpeed?.(-0.1);
        break;
      case 'Equal':
      case 'NumpadAdd':
      case 'BracketRight':
        event.preventDefault();
        this.callbacks.onAdjustSpeed?.(0.1);
        break;
      case 'KeyM':
        event.preventDefault();
        this.callbacks.onCycleAccelMode?.();
        break;
      case 'KeyQ':
      case 'PageDown':
        event.preventDefault();
        this.callbacks.onAdjustThrottle?.(-0.1);
        break;
      case 'KeyE':
      case 'PageUp':
        event.preventDefault();
        this.callbacks.onAdjustThrottle?.(0.1);
        break;
      case 'KeyX':
        event.preventDefault();
        this.callbacks.onZeroThrottle?.();
        break;
      default:
        break;
    }
  }

  _onKeyUp(event) {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.right = false;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.keys.up = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.keys.down = false;
        break;
      case 'Space':
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.boost = false;
        break;
      default:
        break;
    }
  }

  _onBlur() {
    this.reset();
  }

  setTouchInput(control, active) {
    if (control in this.touch) {
      this.touch[control] = Boolean(active);
    }
  }

  reset() {
    this.keys.left = false;
    this.keys.right = false;
    this.keys.up = false;
    this.keys.down = false;
    this.keys.boost = false;
    this.touch.left = false;
    this.touch.right = false;
    this.touch.accelerate = false;
    this.touch.brake = false;
    this.touch.boost = false;
    this.steerValue = 0;
  }

  /**
   * Advances smooth analog keyboard + mobile touch steering value in [-1..+1].
   */
  update(dt = 0.016, sensitivity = 1.0) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt));
    const leftActive = this.keys.left || this.touch.left;
    const rightActive = this.keys.right || this.touch.right;
    const rawDir = (rightActive ? 1 : 0) - (leftActive ? 1 : 0);
    const target = rawDir;
    const isReversing =
      rawDir !== 0 &&
      Math.sign(rawDir) !== Math.sign(this.steerValue) &&
      Math.abs(this.steerValue) > 0.05;
    const rate =
      rawDir === 0
        ? 14.5
        : isReversing
          ? 16.0 * Math.max(0.7, sensitivity)
          : 9.8 * Math.max(0.65, sensitivity);
    const alpha = 1 - Math.exp(-rate * safeDt);
    this.steerValue += (target - this.steerValue) * alpha;
    if (Math.abs(this.steerValue) < 0.004 && target === 0) {
      this.steerValue = 0;
    }

    return {
      steer: Math.max(-1, Math.min(1, this.steerValue)),
      wheelAngleDeg: this.steerValue * 42,
      accelerate: this.keys.up || this.touch.accelerate,
      brake: this.keys.down || this.touch.brake,
      boost: this.keys.boost || this.touch.boost,
      hasSteerInput: rawDir !== 0,
    };
  }

  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('blur', this._onBlur);
    }
  }
}
