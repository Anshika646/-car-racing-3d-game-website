/**
 * HandTracker.js
 *
 * High-reliability browser-local MediaPipe HandLandmarker engine:
 * - Per-landmark 1-Euro velocity-adaptive smoothing (zero jitter at rest, zero lag on turns)
 * - Tuned high-recall palm/fist/tilted-hand detection (0.28 / 0.28 / 0.24)
 * - Strictly monotonic timestamp guard so MediaPipe WASM never drops frames
 * - Automatic dim-room / low-light brightness & contrast boost fallback
 * - Vibrant Chroma Confetti multi-color skeleton & rainbow virtual steering wheel overlay
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

const SKELETON_NEON_PALETTE = ['#22e4ff', '#ff8c1a', '#a3ff2e', '#ff2eb6'];

function oneEuroAlpha(cutoffHz, dt) {
  const tau = 1 / (2 * Math.PI * Math.max(0.05, cutoffHz));
  return 1 / (1 + tau / Math.max(0.004, dt));
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
    this.lastDetectWallMs = 0;
    this.lastTimestampMs = 0;
    this.lastValidDetectMs = 0;
    this.zeroHandStreak = 0;
    this.useLowLightBoost = false;

    this.sourceVideoWidth = 640;
    this.sourceVideoHeight = 480;
    this._enhanceCanvas = null;
    this._enhanceCtx = null;

    // Per-hand 1-Euro landmark filter tracks
    this._trackedHands = [];

    this.latestGeometry = computeWheelGeometry([], []);
    this.latestSmoothedLandmarks = [];
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
        minHandDetectionConfidence: 0.28,
        minHandPresenceConfidence: 0.28,
        minTrackingConfidence: 0.24,
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
   * Applies velocity-adaptive 1-Euro filtering per landmark across frames so hand skeletons
   * and palm centers stay silky-smooth with zero lag during quick turns.
   */
  _smoothLandmarksList(rawLandmarksList, timestampMs) {
    if (!Array.isArray(rawLandmarksList) || rawLandmarksList.length === 0) {
      this._trackedHands = [];
      return [];
    }

    const usedPrev = new Set();
    const nextTracks = [];
    const smoothedList = [];

    for (let h = 0; h < rawLandmarksList.length; h++) {
      const lm = rawLandmarksList[h];
      if (!Array.isArray(lm) || lm.length < 21) continue;

      let bestTrack = null;
      let bestDist = 0.26;
      let bestIdx = -1;

      for (let p = 0; p < this._trackedHands.length; p++) {
        if (usedPrev.has(p)) continue;
        const candidate = this._trackedHands[p];
        const d = Math.hypot(lm[0].x - candidate.lm[0].x, lm[0].y - candidate.lm[0].y);
        if (d < bestDist) {
          bestDist = d;
          bestTrack = candidate;
          bestIdx = p;
        }
      }

      if (bestTrack && bestIdx !== -1) {
        usedPrev.add(bestIdx);
        const dt = Math.min(0.1, Math.max(0.008, (timestampMs - bestTrack.t) / 1000));
        const dAlpha = oneEuroAlpha(1.0, dt);
        const minCutoff = 1.25;
        const beta = 1.45;

        const vel = bestTrack.vel;
        const filteredLm = lm.map((pt, idx) => {
          const prevPt = bestTrack.lm[idx];
          const vx = (pt.x - prevPt.x) / dt;
          const vy = (pt.y - prevPt.y) / dt;
          vel[idx].dx += dAlpha * (vx - vel[idx].dx);
          vel[idx].dy += dAlpha * (vy - vel[idx].dy);
          const speed = Math.hypot(vel[idx].dx, vel[idx].dy);
          const posAlpha = oneEuroAlpha(minCutoff + beta * speed, dt);
          return {
            x: prevPt.x + posAlpha * (pt.x - prevPt.x),
            y: prevPt.y + posAlpha * (pt.y - prevPt.y),
            z: pt.z ?? 0,
          };
        });

        nextTracks.push({ lm: filteredLm, vel, t: timestampMs });
        smoothedList.push(filteredLm);
      } else {
        const cloned = lm.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z ?? 0 }));
        const vel = lm.map(() => ({ dx: 0, dy: 0 }));
        nextTracks.push({ lm: cloned, vel, t: timestampMs });
        smoothedList.push(cloned);
      }
    }

    this._trackedHands = nextTracks;
    return smoothedList;
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
      this._enhanceCtx.filter = 'brightness(1.25) contrast(1.25) saturate(1.08)';
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

    if (videoEl.paused && typeof videoEl.play === 'function') {
      const p = videoEl.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }

    this.sourceVideoWidth = videoEl.videoWidth || 640;
    this.sourceVideoHeight = videoEl.videoHeight || 480;

    const wallElapsed = timestampMs - this.lastDetectWallMs;
    if (
      videoEl.currentTime === this.lastVideoTime &&
      wallElapsed < 24 &&
      this.latestRawResult
    ) {
      return this.latestGeometry;
    }
    this.lastVideoTime = videoEl.currentTime;
    this.lastDetectWallMs = timestampMs;

    const safeTimestampMs = Math.max(this.lastTimestampMs + 1, Math.round(timestampMs));
    this.lastTimestampMs = safeTimestampMs;

    try {
      const inputSource = this.useLowLightBoost
        ? this._prepareEnhancedInput(videoEl)
        : videoEl;

      const result = this.handLandmarker.detectForVideo(inputSource, safeTimestampMs);
      const rawLandmarks = result?.landmarks || [];
      const handednesses = result?.handednesses || [];

      if (rawLandmarks.length > 0) {
        this.zeroHandStreak = 0;
        this.lastValidDetectMs = timestampMs;
        this.latestRawResult = result;
        const smoothedLandmarks = this._smoothLandmarksList(rawLandmarks, timestampMs);
        this.latestSmoothedLandmarks = smoothedLandmarks;
        this.latestGeometry = computeWheelGeometry(smoothedLandmarks, handednesses);
      } else {
        this.zeroHandStreak++;
        if (this.zeroHandStreak === 16 && !this.useLowLightBoost) {
          this.useLowLightBoost = true;
        } else if (this.zeroHandStreak === 48 && this.useLowLightBoost) {
          this.useLowLightBoost = false;
          this.zeroHandStreak = 0;
        }

        // Hold last valid hand pose for up to 110ms to bridge single-frame motion blur
        if (this.latestRawResult && timestampMs - this.lastValidDetectMs <= 110) {
          return this.latestGeometry;
        }

        this._trackedHands = [];
        this.latestSmoothedLandmarks = [];
        this.latestRawResult = result;
        this.latestGeometry = computeWheelGeometry([], []);
      }
    } catch {
      if (timestampMs - this.lastValidDetectMs > 160) {
        this.latestSmoothedLandmarks = [];
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
      renderH = canvasHeight;
      renderW = canvasHeight * vidAspect;
      offsetX = (canvasWidth - renderW) * 0.5;
    } else {
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
   * Draws colorful mirrored 21-point hand skeletons, grip hubs, and a rainbow virtual steering wheel
   * onto an overlay <canvas>.
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

    const landmarksList =
      this.latestSmoothedLandmarks.length > 0
        ? this.latestSmoothedLandmarks
        : this.latestRawResult?.landmarks || [];
    const geo = this.latestGeometry;

    // Subtle center steering wheel target guide
    const cx = width * 0.5;
    const cy = height * 0.54;
    const guideRadius = Math.min(width, height) * 0.28;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.3;
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

    // Draw each detected hand skeleton in vibrant Chroma Confetti neon colors
    for (let h = 0; h < landmarksList.length; h++) {
      const lm = landmarksList[h];
      const mirroredX0 = 1.0 - lm[0].x;
      const isLeftScreenSide = mirroredX0 < 0.5;
      const boneColor = isLeftScreenSide
        ? SKELETON_NEON_PALETTE[0]
        : SKELETON_NEON_PALETTE[1];
      const tipAccent = isLeftScreenSide
        ? SKELETON_NEON_PALETTE[2]
        : SKELETON_NEON_PALETTE[3];

      ctx.save();
      ctx.strokeStyle = boneColor;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let c = 0; c < HAND_CONNECTIONS.length; c++) {
        const [a, b] = HAND_CONNECTIONS[c];
        const pa = this._projectMirroredPoint(1.0 - lm[a].x, lm[a].y, width, height);
        const pb = this._projectMirroredPoint(1.0 - lm[b].x, lm[b].y, width, height);
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
      }
      ctx.stroke();

      for (let j = 0; j < lm.length; j++) {
        const pj = this._projectMirroredPoint(1.0 - lm[j].x, lm[j].y, width, height);
        const isTip = j === 4 || j === 8 || j === 12 || j === 16 || j === 20;
        ctx.fillStyle = isTip ? tipAccent : '#ffffff';
        ctx.beginPath();
        ctx.arc(pj.x, pj.y, j === 0 ? 4.2 : isTip ? 3.2 : 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw rainbow virtual steering wheel connecting both palm hubs when 2 hands are visible
    if (geo && geo.hasBothHands && geo.leftHub && geo.rightHub) {
      const pl = this._projectMirroredPoint(geo.leftHub.x, geo.leftHub.y, width, height);
      const pr = this._projectMirroredPoint(geo.rightHub.x, geo.rightHub.y, width, height);
      const mx = (pl.x + pr.x) * 0.5;
      const my = (pl.y + pr.y) * 0.5;
      const wheelRadius = Math.max(22, Math.hypot(pr.x - pl.x, pr.y - pl.y) * 0.5);

      ctx.save();
      const grad = ctx.createLinearGradient(pl.x, pl.y, pr.x, pr.y);
      grad.addColorStop(0, '#ff8c1a');
      grad.addColorStop(0.5, '#ff2eb6');
      grad.addColorStop(1, '#22e4ff');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(pl.x, pl.y);
      ctx.lineTo(pr.x, pr.y);
      ctx.stroke();

      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(mx, my, wheelRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Top 12-o'clock yellow wheel marker perpendicular to hand axle
      const axleAngle = Math.atan2(pr.y - pl.y, pr.x - pl.x);
      const topX = mx + Math.sin(axleAngle) * wheelRadius;
      const topY = my - Math.cos(axleAngle) * wheelRadius;
      ctx.fillStyle = '#ffe224';
      ctx.beginPath();
      ctx.arc(topX, topY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22e4ff';
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, 6.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff8c1a';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (geo && geo.handCount === 1 && geo.leftHub) {
      const ph = this._projectMirroredPoint(geo.leftHub.x, geo.leftHub.y, width, height);
      ctx.save();
      ctx.strokeStyle = '#a3ff2e';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(ph.x, ph.y, 19, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffe224';
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
    this._trackedHands = [];
    this.latestSmoothedLandmarks = [];
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
