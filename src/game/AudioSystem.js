/**
 * AudioSystem.js
 *
 * Zero-dependency Web Audio synthesizer for engine rumble, countdown tones,
 * near-miss whoosh, calibration lock chimes, and collision impacts.
 * Strictly respects browser autoplay rules — activates only on user interaction.
 */

const MUTE_STORAGE_KEY = 'motion_drive_3d_muted_v1';

export class AudioSystem {
  constructor(storage = typeof window !== 'undefined' ? window.localStorage : null) {
    this.storage = storage;
    this.ctx = null;
    this.masterGain = null;
    this.engineOsc = null;
    this.engineSubOsc = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.isUnlocked = false;
    this.isMuted = false;

    this._loadMutePreference();
  }

  _loadMutePreference() {
    if (!this.storage) return;
    try {
      this.isMuted = this.storage.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      this.isMuted = false;
    }
  }

  unlock() {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : 0.45;
        this.masterGain.connect(this.ctx.destination);
        this._setupEngineSynth();
      } catch {
        return;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.isUnlocked = true;
  }

  _setupEngineSynth() {
    if (!this.ctx || !this.masterGain) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineSubOsc = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc.type = 'sawtooth';
    this.engineSubOsc.type = 'triangle';
    this.engineOsc.frequency.value = 55;
    this.engineSubOsc.frequency.value = 27.5;

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 180;
    this.engineFilter.Q.value = 2.2;

    this.engineGain.gain.value = 0.0;

    this.engineOsc.connect(this.engineFilter);
    this.engineSubOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc.start();
    this.engineSubOsc.start();
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.storage) {
      try {
        this.storage.setItem(MUTE_STORAGE_KEY, String(this.isMuted));
      } catch {
        // Ignore storage errors
      }
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime, 0.04);
    }
  }

  updateEngine(speedKmh = 0, isRacing = false, isBraking = false, isBoosting = false) {
    if (!this.ctx || !this.engineGain || !this.isUnlocked) return;
    const now = this.ctx.currentTime;

    if (!isRacing || this.isMuted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Simulate 5-gear sports car cadence + Nitro turbine lift
    const normalized = Math.min(1.2, Math.max(0, speedKmh / 240));
    const gearMod = (speedKmh % 52) / 52;
    const boostLift = isBoosting ? 36 : 0;
    const baseFreq = 46 + normalized * 88 + gearMod * 24 + boostLift;

    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(
      isBraking ? 150 : isBoosting ? 880 : 190 + normalized * 460,
      now,
      0.08,
    );
    this.engineGain.gain.setTargetAtTime(
      (isBoosting ? 0.12 : 0.08) + normalized * 0.07,
      now,
      0.08,
    );
  }

  playNitroBoost() {
    if (!this.ctx || !this.isUnlocked || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.34);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  playOvertakeChime(combo = 1) {
    if (!this.ctx || !this.isUnlocked || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const base = 580 + Math.min(5, combo) * 65;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.22, now + 0.09);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playCountdownBeep(isGo = false) {
    if (!this.ctx || !this.isUnlocked || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    if (isGo) {
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.14);
    }
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.36 : 0.18));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.38 : 0.2));
  }

  playNearMiss() {
    if (!this.ctx || !this.isUnlocked || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  playCalibrationLock() {
    if (!this.ctx || !this.isUnlocked || this.isMuted) return;
    const now = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      gain.gain.setValueAtTime(0.15, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.24);
    });
  }

  playCrash(isFatal = false) {
    if (!this.ctx || !this.isUnlocked || this.isMuted) return;
    const now = this.ctx.currentTime;
    const duration = isFatal ? 0.65 : 0.32;

    // White noise burst through bandpass filter for authentic impact crunch
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.32));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isFatal ? 720 : 950, now);
    filter.frequency.exponentialRampToValueAtTime(110, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isFatal ? 0.55 : 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  dispose() {
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // Ignore close error
      }
      this.ctx = null;
    }
  }
}
