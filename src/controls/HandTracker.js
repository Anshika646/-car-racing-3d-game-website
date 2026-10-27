/**
 * HandTracker.js
 *
 * High-reliability browser-local MediaPipe HandLandmarker engine:
 * - Tuned low-threshold palm/fist/tilted-hand detection (0.26 / 0.26 / 0.22)
 * - Strictly monotonic timestamp guard so MediaPipe WASM never drops frames
 * - Automatic dim-room / low-light brightness & contrast boost fallback
 * - Short-term temporal continuity buffer to eliminate single-frame flicker
 * - Pixel-accurate object-cover aspect-ratio skeleton & wheel-axle overlay
 */

import { computeWheelGeometry } from './SteeringCalibration.js';

const PRIMARY_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const FALLBACK_WASM_CDN = 'https://unpkg.com/@mediapipe/tasks-vision@1.1.1/wasm';
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Standard 21-point MediaPipe hand skeleton bone connections
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],         // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],         // Index
  [5, 9], [9, 10], [10, 11], [11, 12],    // Middle
  [9, 13], [13, 14], [14, 15], [15, 16],  // Ring
  [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [0, 17],                                // Palm base
];

export class HandTracker {
  constructor(options = {}) {
    this.visionModuleLoader =
      options.visionModuleLoader || (() => import('@mediapipe/tasks-vision'));
    this.handLandmarker = null;
    this.isReady = false;
    this.isLoading = false;
    this.loadError = null;

    this.lastVideoTime = -1;
    this.lastDetectWallMs = 0;
    this.lastTimestampMs = 0;
    this.lastValidDetectMs = 0;
    this.zeroHandStreak = 0;
    this.useLowLightBoost = false;

    this.sourceVideoWidth = 640;
    this.sourceVideoHeight = 480;
    this._enhanceCanvas = null;
    this._enhanceCtx = null;

    this.latestGeometry = computeWheelGeometry([], []);
    this.latestRawResult = null;
  }

  /**
   * Loads MediaPipe HandLandmarker with high-recall thresholds suited for closed fists,
   * rotated hands, indoor room lighting, and mobile front cameras.
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

      let visionFileset = null;
      try {
        visionFileset = await FilesetResolver.forVisionTasks(PRIMARY_WASM_CDN);
      } catch {
        visionFileset = await FilesetResolver.forVisionTasks(FALLBACK_WASM_CDN);
      }

      const detectorConfig = {
        runningMode: 'VIDEO',
        numHands: 2,
        // Lower thresholds ensure closed fists, sideways grips & dim indoor rooms stay locked
        minHandDetectionConfidence: 0.26,
        minHandPresenceConfidence: 0.26,
        minTrackingConfidence: 0.22,
      };

      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(visionFileset, {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: 'GPU',
          },
          ...detectorConfig,
        });
      } catch {
        // Fallback to CPU delegate on systems where WebGL GPU delegate is restricted
        this.handLandmarker = await HandLandmarker.createFromOptions(visionFileset, {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: 'CPU',
          },
          ...detectorConfig,
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
        'MediaPipe hand-tracking model could not be loaded. Check your network connection or use Touch / Keyboard Controls.';
      const wrapped = new Error(this.loadError);
      wrapped.title = 'Hand Tracking Unavailable';
      throw wrapped;
    }
  }

  /**
   * Prepares an exposure/contrast-enhanced frame when operating in dim indoor lighting.
   */
  _prepareEnhancedInput(videoEl) {
    if (typeof document === 'undefined') return videoEl;
    const vw = videoEl.videoWidth || 640;
    const vh = videoEl.videoHeight || 480;
    const scale = Math.min(1, 480 / Math.max(vw, vh));
    const targetW = Math.max(160, Math.round(vw * scale));
    const targetH = Math.max(120, Math.round(vh * scale));

    if (!this._enhanceCanvas) {
      this._enhanceCanvas = document.createElement('canvas');
      this._enhanceCtx = this._enhanceCanvas.getContext('2d', { willReadFrequently: false });
    }
    if (!this._enhanceCtx) return videoEl;

    if (this._enhanceCanvas.width !== targetW || this._enhanceCanvas.height !== targetH) {
      this._enhanceCanvas.width = targetW;
      this._enhanceCanvas.height = targetH;
    }

    try {
      this._enhanceCtx.filter = 'brightness(1.26) contrast(1.26) saturate(1.08)';
      this._enhanceCtx.drawImage(videoEl, 0, 0, targetW, targetH);
      return this._enhanceCanvas;
    } catch {
      return videoEl;
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

    // Ensure video continues playing if mobile browser momentarily paused it
    if (videoEl.paused && typeof videoEl.play === 'function') {
      const p = videoEl.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }

    this.sourceVideoWidth = videoEl.videoWidth || 640;
    this.sourceVideoHeight = videoEl.videoHeight || 480;

    // Run whenever video time advances OR at least every 28ms (~35 Hz) for browsers with coarse currentTime
    const wallElapsed = timestampMs - this.lastDetectWallMs;
    if (
      videoEl.currentTime === this.lastVideoTime &&
      wallElapsed < 28 &&
      this.latestRawResult
    ) {
      return this.latestGeometry;
    }
    this.lastVideoTime = videoEl.currentTime;
    this.lastDetectWallMs = timestampMs;

    // MediaPipe VIDEO mode strictly requires monotonically increasing timestamps
    const safeTimestampMs = Math.max(this.lastTimestampMs + 1, Math.round(timestampMs));
    this.lastTimestampMs = safeTimestampMs;

    try {
      const inputSource = this.useLowLightBoost
        ? this._prepareEnhancedInput(videoEl)
        : videoEl;

      const result = this.handLandmarker.detectForVideo(inputSource, safeTimestampMs);
      const landmarks = result?.landmarks || [];
      const handednesses = result?.handednesses || [];

      if (landmarks.length > 0) {
        this.zeroHandStreak = 0;
        this.lastValidDetectMs = timestampMs;
        this.latestRawResult = result;
        this.latestGeometry = computeWheelGeometry(landmarks, handednesses);
      } else {
        this.zeroHandStreak++;
        // Toggle low-light contrast boost automatically if raw stream sees 0 hands for ~16 frames
        if (this.zeroHandStreak === 16 && !this.useLowLightBoost) {
          this.useLowLightBoost = true;
        } else if (this.zeroHandStreak === 48 && this.useLowLightBoost) {
          // Periodically alternate back to raw stream in case lighting is already bright
          this.useLowLightBoost = false;
          this.zeroHandStreak = 0;
        }

        // Hold last valid hand pose for up to 95ms to bridge single-frame motion blur
        if (this.latestRawResult && timestampMs - this.lastValidDetectMs <= 95) {
          return this.latestGeometry;
        }

        this.latestRawResult = result;
        this.latestGeometry = computeWheelGeometry([], []);
      }
    } catch {
      // Preserve last valid pose briefly on transient WebGL/WASM hiccup instead of hard drop
      if (timestampMs - this.lastValidDetectMs > 150) {
        this.latestGeometry = computeWheelGeometry([], []);
      }
    }

    return this.latestGeometry;
  }

  /**
   * Maps normalized [0..1] mirrored landmarks to exact pixel coordinates on an `object-cover` canvas.
   */
  _projectMirroredPoint(mirroredX, normY, canvasWidth, canvasHeight) {
    const vidAspect =
      this.sourceVideoHeight > 0 ? this.sourceVideoWidth / this.sourceVideoHeight : 4 / 3;
    const boxAspect = canvasHeight > 0 ? canvasWidth / canvasHeight : 4 / 3;

    let renderW = canvasWidth;
    let renderH = canvasHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (vidAspect > boxAspect) {
      // Video is wider than box -> cropped horizontally
      renderH = canvasHeight;
      renderW = canvasHeight * vidAspect;
      offsetX = (canvasWidth - renderW) * 0.5;
    } else {
      // Video is taller than box (e.g., portrait phone camera) -> cropped vertically
      renderW = canvasWidth;
      renderH = canvasWidth / vidAspect;
      offsetY = (canvasHeight - renderH) * 0.5;
    }

    return {
      x: offsetX + mirroredX * renderW,
      y: offsetY + normY * renderH,
    };
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

    // Subtle center steering wheel target guide
    const cx = width * 0.5;
    const cy = height * 0.54;
    const guideRadius = Math.min(width, height) * 0.28;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, guideRadius, 0, Math.PI * 2);
    ctx.stroke();

    const neutralRad = (neutralAngleDeg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(
      cx - Math.cos(neutralRad) * (guideRadius + 14),
      cy - Math.sin(neutralRad) * (guideRadius + 14),
    );
    ctx.lineTo(
      cx + Math.cos(neutralRad) * (guideRadius + 14),
      cy + Math.sin(neutralRad) * (guideRadius + 14),
    );
    ctx.stroke();
    ctx.restore();

    // Draw each detected hand skeleton with object-cover aspect compensation
    for (let h = 0; h < landmarksList.length; h++) {
      const lm = landmarksList[h];
      const mirroredX0 = 1.0 - lm[0].x;
      const isLeftScreenSide = mirroredX0 < 0.5;
      const boneColor = isLeftScreenSide ? '#22d3ee' : '#f59e0b';

      ctx.strokeStyle = boneColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let c = 0; c < HAND_CONNECTIONS.length; c++) {
        const [a, b] = HAND_CONNECTIONS[c];
        const pa = this._projectMirroredPoint(1.0 - lm[a].x, lm[a].y, width, height);
        const pb = this._projectMirroredPoint(1.0 - lm[b].x, lm[b].y, width, height);
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
      }
      ctx.stroke();

      // Draw joints
      ctx.fillStyle = '#ffffff';
      for (let j = 0; j < lm.length; j++) {
        const pj = this._projectMirroredPoint(1.0 - lm[j].x, lm[j].y, width, height);
        ctx.beginPath();
        ctx.arc(pj.x, pj.y, j === 0 ? 3.8 : 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw virtual steering axle connecting both palm hubs when both hands are visible
    if (geo && geo.hasBothHands && geo.leftHub && geo.rightHub) {
      const pl = this._projectMirroredPoint(geo.leftHub.x, geo.leftHub.y, width, height);
      const pr = this._projectMirroredPoint(geo.rightHub.x, geo.rightHub.y, width, height);
      const mx = (pl.x + pr.x) * 0.5;
      const my = (pl.y + pr.y) * 0.5;
      const wheelRadius = Math.max(22, Math.hypot(pr.x - pl.x, pr.y - pl.y) * 0.5);

      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(pl.x, pl.y);
      ctx.lineTo(pr.x, pr.y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, wheelRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, 6.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (geo && geo.handCount === 1 && geo.leftHub) {
      // Active 1-hand steering ring indicator
      const ph = this._projectMirroredPoint(geo.leftHub.x, geo.leftHub.y, width, height);
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ph.x, ph.y, 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(ph.x, ph.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  resetFrameCache() {
    this.lastVideoTime = -1;
    this.lastDetectWallMs = 0;
    this.lastValidDetectMs = 0;
    this.zeroHandStreak = 0;
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
