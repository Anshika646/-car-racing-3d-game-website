/**
 * GameOver.js
 *
 * Manages the post-crash summary screen, personal-best comparison,
 * replay action, control-mode switching, and return to Title Screen.
 */

import gsap from 'gsap';

export class GameOver {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;

    this.els = {
      root: document.getElementById('gameover-screen'),
      newBestBanner: document.getElementById('gameover-new-best'),
      score: document.getElementById('go-score'),
      best: document.getElementById('go-best'),
      distance: document.getElementById('go-distance'),
      topSpeed: document.getElementById('go-topspeed'),
      nearMisses: document.getElementById('go-nearmisses'),
      btnReplay: document.getElementById('btn-gameover-replay'),
      btnSwitch: document.getElementById('btn-gameover-switch'),
      btnMenu: document.getElementById('btn-gameover-menu'),
    };

    this.els.btnReplay?.addEventListener('click', () => this.callbacks.onReplay?.());
    this.els.btnSwitch?.addEventListener('click', () => this.callbacks.onSwitchMode?.());
    this.els.btnMenu?.addEventListener('click', () => this.callbacks.onMainMenu?.());
  }

  show({
    score = 0,
    bestScore = 0,
    isNewBest = false,
    distanceMeters = 0,
    topSpeedKmh = 0,
    nearMisses = 0,
    controlMode = 'keyboard',
  }) {
    if (!this.els.root) return;

    if (this.els.score) this.els.score.textContent = Math.floor(score).toLocaleString();
    if (this.els.best) this.els.best.textContent = Math.floor(bestScore).toLocaleString();
    if (this.els.distance) {
      this.els.distance.textContent = `${(distanceMeters / 1000).toFixed(2)} km`;
    }
    if (this.els.topSpeed) {
      this.els.topSpeed.textContent = `${Math.round(topSpeedKmh)} km/h`;
    }
    if (this.els.nearMisses) {
      this.els.nearMisses.textContent = String(nearMisses);
    }
    if (this.els.newBestBanner) {
      this.els.newBestBanner.classList.toggle('hidden', !isNewBest);
    }
    if (this.els.btnSwitch) {
      this.els.btnSwitch.textContent =
        controlMode === 'camera' ? 'Switch to Keyboard' : 'Play with Camera';
    }

    this.els.root.classList.remove('hidden');
    if (this.els.root.firstElementChild) {
      gsap.fromTo(
        this.els.root.firstElementChild,
        { scale: 0.96, y: 14, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.25, ease: 'power2.out' },
      );
    }
  }

  hide() {
    this.els.root?.classList.add('hidden');
  }
}
