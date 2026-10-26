/**
 * main.js
 *
 * Application entry point for MOTION DRIVE 3D.
 * Initializes styles, instantiates the 3D racing engine, and registers clean teardown.
 */

import './styles.css';
import { Game } from './game/Game.js';

let gameInstance = null;

function boot() {
  const container = document.getElementById('canvas-container');
  gameInstance = new Game({ container });

  // Clean up camera tracks, audio context, and WebGL resources if page unloads
  window.addEventListener('beforeunload', () => {
    gameInstance?.dispose();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export { gameInstance };
