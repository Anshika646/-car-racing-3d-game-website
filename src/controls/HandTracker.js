/**
 * HandTracker.js
 *
 * Browser-local MediaPipe HandLandmarker wrapper with graceful fallback,
 * local WASM loading (with CDN backup), and mirrored 21-point hand skeleton
 * + virtual steering axle overlay rendering.
 */

import { computeWheelGeometry } from './SteeringCalibration.js';

const LOCAL_WASM_PATH = './wasm';
const CDN_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Standard 21-point MediaPipe hand skeleton bone connections
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [9, 13], [13, 14], [14, 15], [15, 16],// Ring
  [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [0, 17],                              // Palm base
];

async function hasLocalWasmAssets() {
  if (typeof window !== 'undefined' && window.__MOTION_DRIVE_SINGLE_FILE__) {
    return false;
  }
  if (typeof fetch !== 'function') return false;
  try {
    const res = await fetch(`${LOCAL_WASM_PATH}/vision_wasm_internal.js`, { method: 'HEAD' });
    if (!res.ok) return false;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    // Guard against SPA fallback returning index.html with 200 OK
    return !contentType.includes('text/html');
  } catch {
    return false;
  }
}

export class HandTracker {
  constructor(options = {}) {
    this.visionModuleLoader =
      options.visionModuleLoader || (() => import('@mediapipe/tasks-vision'));
    this.handLandmarker = null;
    this.isReady = false;
    this.isLoading = false;
    this.loadError = null;
    this.lastVideoTime = -1;
    this.latestGeometry = computeWheelGeometry([], []);
    this.latestRawResult = null;
  }

  /**
   * Loads MediaPipe HandLandmarker. Uses local ./wasm when present, or falls back
   * to version-matched 1.1.1 WASM on jsDelivr CDN for lightweight ZIP / single-HTML deploys.
   */
  async initialize() {
    if (this.isReady && this.handLandmarker) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    this.loadError = null;

    try {
      const visionModule = await this.visionModuleLoader();
      const FilesetResolver = visionModule.FilesetResolver;
      const HandLandmarker = visionModule.HandLandmarker;

      if (!FilesetResolver || !HandLandmarker) {
        throw new Error('MediaPipe Tasks Vision module did not export HandLandmarker.');
      }

      const preferLocal = await hasLocalWasmAssets();
      const primaryWasmPath = preferLocal ? LOCAL_WASM_PATH : CDN_WASM_PATH;

      let visionFileset = null;
      try {
        visionFileset = await FilesetResolver.forVisionTasks(primaryWasmPath);
      } catch {
        visionFileset = await FilesetResolver.forVisionTasks(CDN_WASM_PATH);
      }

      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(visionFileset, {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch {
        // Fallback to CPU delegate on systems where GPU delegate fails
        this.handLandmarker = await HandLandmarker.createFromOptions(visionFileset, {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      this.isReady = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      this.isReady = false;
      this.isLoading = false;
      this.loadError =
        err?.message ||
        'MediaPipe hand-tracking model could not be loaded. Check your network connection or use Keyboard Controls.';
      const wrapped = new Error(this.loadError);
      wrapped.title = 'Hand Tracking Unavailable';
      throw wrapped;
    }
  }

  /**
   * Runs real-time hand landmark detection on the current video frame locally in-browser.
   */
  detect(videoEl, timestampMs = performance.now()) {
    if (
      !this.isReady ||
      !this.handLandmarker ||
      !videoEl ||
      videoEl.readyState < 2 ||
      videoEl.videoWidth === 0
    ) {
      return this.latestGeometry;
    }

    if (videoEl.currentTime === this.lastVideoTime && this.latestRawResult) {
      return this.latestGeometry;
    }
    this.lastVideoTime = videoEl.currentTime;

    try {
      const result = this.handLandmarker.detectForVideo(videoEl, timestampMs);
      this.latestRawResult = result;
      this.latestGeometry = computeWheelGeometry(
        result?.landmarks || [],
        result?.handednesses || [],
      );
    } catch {
      this.latestGeometry = computeWheelGeometry([], []);
    }

    return this.latestGeometry;
  }

  /**
   * Draws mirrored 21-point hand skeletons, grip hubs, neutral horizon reference,
   * and the virtual steering wheel axle onto an overlay <canvas>.
   */
  renderOverlay(canvas, neutralAngleDeg = 0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 240;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const landmarksList = this.latestRawResult?.landmarks || [];
    const geo = this.latestGeometry;

    // Subtle center steering crosshair & neutral angle guide
    const cx = width * 0.5;
    const cy = height * 0.54;
    const guideRadius = Math.min(width, height) * 0.28;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, guideRadius, 0, Math.PI * 2);
    ctx.stroke();

    const neutralRad = (neutralAngleDeg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(neutralRad) * (guideRadius + 14), cy - Math.sin(neutralRad) * (guideRadius + 14));
    ctx.lineTo(cx + Math.cos(neutralRad) * (guideRadius + 14), cy + Math.sin(neutralRad) * (guideRadius + 14));
    ctx.stroke();
    ctx.restore();

    // Draw each detected hand skeleton in mirrored screen coordinates
    for (let h = 0; h < landmarksList.length; h++) {
      const lm = landmarksList[h];
      const mirroredX0 = 1.0 - lm[0].x;
      const isLeftScreenSide = mirroredX0 < 0.5;
      const boneColor = isLeftScreenSide ? '#22d3ee' : '#f59e0b';

      ctx.strokeStyle = boneColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let c = 0; c < HAND_CONNECTIONS.length; c++) {
        const [a, b] = HAND_CONNECTIONS[c];
        const ax = (1.0 - lm[a].x) * width;
        const ay = lm[a].y * height;
        const bx = (1.0 - lm[b].x) * width;
        const by = lm[b].y * height;
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      ctx.stroke();

      // Draw joints
      ctx.fillStyle = '#ffffff';
      for (let j = 0; j < lm.length; j++) {
        const jx = (1.0 - lm[j].x) * width;
        const jy = lm[j].y * height;
        ctx.beginPath();
        ctx.arc(jx, jy, j === 0 ? 3.5 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw virtual steering axle connecting both palm hubs when both hands are visible
    if (geo && geo.hasBothHands && geo.leftHub && geo.rightHub) {
      const lx = geo.leftHub.x * width;
      const ly = geo.leftHub.y * height;
      const rx = geo.rightHub.x * width;
      const ry = geo.rightHub.y * height;
      const mx = (lx + rx) * 0.5;
      const my = (ly + ry) * 0.5;
      const wheelRadius = Math.max(24, Math.hypot(rx - lx, ry - ly) * 0.5);

      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.stroke();

      // Imaginary wheel rim ring anchored between the player's two hands
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, wheelRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Grip hub markers
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rx, ry, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (geo && geo.handCount === 1 && geo.leftHub) {
      // Single-hand prompt indicator
      const hx = geo.leftHub.x * width;
      const hy = geo.leftHub.y * height;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  resetFrameCache() {
    this.lastVideoTime = -1;
    this.latestRawResult = null;
    this.latestGeometry = computeWheelGeometry([], []);
  }

  dispose() {
    this.resetFrameCache();
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch {
        // Ignore WASM teardown exception
      }
      this.handLandmarker = null;
    }
    this.isReady = false;
  }
}
