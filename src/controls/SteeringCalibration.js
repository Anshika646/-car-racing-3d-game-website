/**
 * SteeringCalibration.js
 *
 * Crisp, zero-lag Chroma Arcade hand-steering analyzer:
 * - Supports 2-Hand Virtual Steering Wheel (horizontal = straight 0°, right hand down = turn right)
 * - Supports 1-Hand Move/Tilt Steering (move/tilt hand left or right from center)
 * - Smart 2-Hand -> 1-Hand transition guard so a single hand briefly leaving frame never jerks the car
 * - Instant one-tap neutral recentering + safe return-to-center on tracking loss
 */

const STORAGE_KEY = 'motion_drive_3d_steering_settings_v3';

export const GESTURE_STATUS = {
  HANDS_DETECTED: 'STRAIGHT · LOCKED',
  ONE_HAND_ACTIVE: '1-HAND STEER ACTIVE',
  CALIBRATE: 'STRAIGHT · READY',
  STEER_LEFT: 'STEERING LEFT',
  STEER_RIGHT: 'STEERING RIGHT',
  CENTER_HANDS: 'STRAIGHT',
  TRACKING_LOST: 'HANDS LOST — COASTING',
};

export const DEFAULT_STEERING_SETTINGS = {
  neutralAngleDeg: 0,
  neutralSingleAngleDeg: 0,
  neutralSingleX: 0.5,
  sensitivity: 1.25,
  deadZoneDeg: 2.2,
  maxAngleDeg: 32.0,
  smoothingRate: 16.0,
  pedalMode: 'grip_gas_palm_brake',
  isCalibrated: false,
};

/**
 * Computes a stable 5-point palm center in mirrored normalized coordinates [0..1]
 * using the wrist (0) and all four knuckle MCP joints (5, 9, 13, 17).
 */
export function computePalmHubMirrored(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) {
    return null;
  }
  const indices = [0, 5, 9, 13, 17];
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < indices.length; i++) {
    const pt = landmarks[indices[i]];
    sumX += 1.0 - pt.x; // Mirror horizontally to match mirrored webcam preview
    sumY += pt.y;
  }
  return {
    x: sumX / indices.length,
    y: sumY / indices.length,
  };
}

/**
 * Computes natural single-hand tilt angle in degrees in mirrored coordinates:
 * Upright hand = 0°, tilting top of hand left < 0°, tilting top of hand right > 0°.
 */
export function computeSingleHandTiltDeg(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return 0;
  const wrist = landmarks[0];
  const midMcp = landmarks[9];
  const dx = (1.0 - midMcp.x) - (1.0 - wrist.x);
  const dy = Math.max(0.035, wrist.y - midMcp.y);
  const rad = Math.atan2(dx, dy);
  return Math.max(-55, Math.min(55, rad * (180 / Math.PI)));
}

/**
 * Scale-invariant check for whether a hand has fingers spread open
 * (deliberate "STOP / OPEN PALM" gesture) vs a closed steering wheel grip.
 * Works reliably even when the hand is slightly angled toward the webcam.
 */
export function isHandOpenPalm(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return false;
  const wrist = landmarks[0];
  const fingerTriples = [
    [8, 6, 5],    // Index tip, PIP, MCP
    [12, 10, 9],  // Middle tip, PIP, MCP
    [16, 14, 13], // Ring tip, PIP, MCP
    [20, 18, 17], // Pinky tip, PIP, MCP
  ];

  let extendedCount = 0;
  for (let i = 0; i < fingerTriples.length; i++) {
    const [tipIdx, pipIdx, mcpIdx] = fingerTriples[i];
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];
    const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    const mcpDist = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
    if (tipDist > pipDist * 1.22 && tipDist > mcpDist * 1.38) {
      extendedCount++;
    }
  }
  return extendedCount >= 3;
}

/**
 * Extracts two-hand wheel angle (plus single-hand fallback geometry), palm hubs,
 * confidence, and open-palm state from MediaPipe HandLandmarker detections.
 */
export function computeWheelGeometry(landmarksList = [], handednesses = []) {
  const handCount = Array.isArray(landmarksList) ? landmarksList.length : 0;

  let avgConfidence = 0;
  if (Array.isArray(handednesses) && handednesses.length > 0) {
    let totalScore = 0;
    let count = 0;
    for (let i = 0; i < handednesses.length; i++) {
      const cat = handednesses[i]?.[0];
      if (cat && typeof cat.score === 'number') {
        totalScore += cat.score;
        count++;
      }
    }
    avgConfidence = count > 0 ? totalScore / count : 0.88;
  } else if (handCount > 0) {
    avgConfidence = 0.9;
  }

  if (handCount === 0) {
    return {
      handCount: 0,
      hasBothHands: false,
      leftHub: null,
      rightHub: null,
      rawAngleDeg: 0,
      singleHandTiltDeg: 0,
      handSpan: 0,
      openPalmCount: 0,
      confidence: 0,
    };
  }

  if (handCount === 1) {
    const singleHub = computePalmHubMirrored(landmarksList[0]);
    const singleTilt = computeSingleHandTiltDeg(landmarksList[0]);
    return {
      handCount: 1,
      hasBothHands: false,
      leftHub: singleHub,
      rightHub: null,
      rawAngleDeg: singleTilt,
      singleHandTiltDeg: singleTilt,
      handSpan: 0,
      openPalmCount: isHandOpenPalm(landmarksList[0]) ? 1 : 0,
      confidence: avgConfidence,
    };
  }

  const h0 = computePalmHubMirrored(landmarksList[0]);
  const h1 = computePalmHubMirrored(landmarksList[1]);
  if (!h0 || !h1) {
    return {
      handCount: 0,
      hasBothHands: false,
      leftHub: null,
      rightHub: null,
      rawAngleDeg: 0,
      singleHandTiltDeg: 0,
      handSpan: 0,
      openPalmCount: 0,
      confidence: 0,
    };
  }

  // Sort by mirrored screen X so leftHub is always the screen-left hand
  let leftHub = h0;
  let rightHub = h1;
  if (h0.x > h1.x) {
    leftHub = h1;
    rightHub = h0;
  }

  const dx = rightHub.x - leftHub.x;
  const dy = rightHub.y - leftHub.y;
  const handSpan = Math.hypot(dx, dy);

  // Clamp minimum horizontal denominator so hands crossing vertically never flip 180°
  const safeDx = Math.max(0.075, dx);
  const rawAngleRad = Math.atan2(dy, safeDx);
  const rawAngleDeg = rawAngleRad * (180 / Math.PI);

  const open0 = isHandOpenPalm(landmarksList[0]) ? 1 : 0;
  const open1 = isHandOpenPalm(landmarksList[1]) ? 1 : 0;

  return {
    handCount: 2,
    hasBothHands: true,
    leftHub,
    rightHub,
    rawAngleDeg,
    singleHandTiltDeg: 0,
    handSpan,
    openPalmCount: open0 + open1,
    confidence: avgConfidence,
  };
}

export class SteeringCalibration {
  constructor(storage = typeof window !== 'undefined' ? window.localStorage : null) {
    this.storage = storage;
    this.settings = { ...DEFAULT_STEERING_SETTINGS };
    this.loadSettings();

    // Runtime state
    this.smoothedSteer = 0;
    this.smoothedWheelDeg = 0;
    this.lastRawAngleDeg = 0;
    this.lastSingleTiltDeg = 0;
    this.lastSingleX = 0.5;
    this.lastObservedHandCount = 0;
    this.recentTwoHandsTimer = 0;
    this.missingHandsTimer = 0;
    this.calibrationHoldTime = 0;
    this.calibrationSamples = [];
    this.calibrationSingleSamples = [];
    this.calibrationRequiredSeconds = 0.65;
  }

  loadSettings() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = {
          ...DEFAULT_STEERING_SETTINGS,
          ...parsed,
        };
      }
    } catch {
      // Ignore storage read errors in restricted contexts
    }
  }

  saveSettings() {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage quota errors
    }
  }

  updateSettings(partial) {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    this.saveSettings();
  }

  resetDefaults() {
    this.settings = { ...DEFAULT_STEERING_SETTINGS };
    this.smoothedSteer = 0;
    this.smoothedWheelDeg = 0;
    this.resetCalibrationProgress();
    this.saveSettings();
  }

  resetCalibrationProgress() {
    this.calibrationHoldTime = 0;
    this.calibrationSamples = [];
    this.calibrationSingleSamples = [];
  }

  /**
   * Resets neutral to clean horizontal (0°) & screen center (0.5) for instant arcade play
   * unless the player explicitly clicks "Recenter Hands" during a session.
   */
  ensureDefaultNeutral() {
    if (!Number.isFinite(this.settings.neutralAngleDeg) || Math.abs(this.settings.neutralAngleDeg) > 18) {
      this.settings.neutralAngleDeg = 0;
    }
    if (!Number.isFinite(this.settings.neutralSingleX) || Math.abs(this.settings.neutralSingleX - 0.5) > 0.22) {
      this.settings.neutralSingleX = 0.5;
      this.settings.neutralSingleAngleDeg = 0;
    }
  }

  /**
   * Immediately sets the neutral reference from the currently visible hand grip
   * (or an explicit angle in degrees).
   */
  captureNeutral(explicitAngleDeg = null) {
    if (typeof explicitAngleDeg === 'number') {
      const clamped = Math.max(-24, Math.min(24, explicitAngleDeg));
      this.settings.neutralAngleDeg = Number(clamped.toFixed(2));
    } else if (this.lastObservedHandCount >= 2) {
      const clamped = Math.max(-24, Math.min(24, this.lastRawAngleDeg));
      this.settings.neutralAngleDeg = Number(clamped.toFixed(2));
    } else if (this.lastObservedHandCount === 1) {
      this.settings.neutralSingleAngleDeg = Number(
        Math.max(-24, Math.min(24, this.lastSingleTiltDeg)).toFixed(2),
      );
      this.settings.neutralSingleX = Number(
        Math.max(0.22, Math.min(0.78, this.lastSingleX)).toFixed(3),
      );
    } else {
      this.settings.neutralAngleDeg = 0;
      this.settings.neutralSingleAngleDeg = 0;
      this.settings.neutralSingleX = 0.5;
    }

    this.settings.isCalibrated = true;
    this.smoothedSteer = 0;
    this.smoothedWheelDeg = 0;
    this.saveSettings();
    return this.settings.neutralAngleDeg;
  }

  /**
   * Feeds live hand geometry during the optional Calibration Studio to auto-lock neutral
   * once the player holds 2 hands (or 1 hand) steady for ~0.65 seconds.
   */
  feedCalibrationSample(geometry, dt) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt || 0.016));

    // 2-Hand calibration
    if (geometry && geometry.hasBothHands && geometry.handSpan >= 0.055) {
      this.lastObservedHandCount = 2;
      this.lastRawAngleDeg = geometry.rawAngleDeg;

      if (Math.abs(geometry.rawAngleDeg) <= 26) {
        this.calibrationHoldTime += safeDt;
        this.calibrationSamples.push(geometry.rawAngleDeg);
        if (this.calibrationSamples.length > 90) {
          this.calibrationSamples.shift();
        }

        if (this.calibrationHoldTime >= this.calibrationRequiredSeconds) {
          const sum = this.calibrationSamples.reduce((acc, v) => acc + v, 0);
          const avg = sum / Math.max(1, this.calibrationSamples.length);
          this.captureNeutral(avg);
          this.calibrationHoldTime = 0;
          this.calibrationSamples = [];
          this.calibrationSingleSamples = [];
          return {
            progress: 1,
            completedJustNow: true,
            neutralAngleDeg: this.settings.neutralAngleDeg,
          };
        }
      } else {
        this.calibrationHoldTime = Math.max(0, this.calibrationHoldTime - safeDt * 0.8);
      }

      return {
        progress: Math.min(1, this.calibrationHoldTime / this.calibrationRequiredSeconds),
        completedJustNow: false,
        neutralAngleDeg: this.settings.neutralAngleDeg,
      };
    }

    // 1-Hand calibration
    if (geometry && geometry.handCount === 1 && geometry.leftHub) {
      this.lastObservedHandCount = 1;
      this.lastSingleTiltDeg = geometry.singleHandTiltDeg || 0;
      this.lastSingleX = geometry.leftHub.x;

      if (Math.abs(this.lastSingleTiltDeg) <= 30) {
        this.calibrationHoldTime += safeDt * 0.9;
        this.calibrationSingleSamples.push({
          tilt: this.lastSingleTiltDeg,
          x: this.lastSingleX,
        });
        if (this.calibrationSingleSamples.length > 90) {
          this.calibrationSingleSamples.shift();
        }

        if (this.calibrationHoldTime >= this.calibrationRequiredSeconds) {
          const n = Math.max(1, this.calibrationSingleSamples.length);
          const avgTilt =
            this.calibrationSingleSamples.reduce((a, s) => a + s.tilt, 0) / n;
          const avgX =
            this.calibrationSingleSamples.reduce((a, s) => a + s.x, 0) / n;
          this.lastSingleTiltDeg = avgTilt;
          this.lastSingleX = avgX;
          this.settings.neutralSingleAngleDeg = Number(
            Math.max(-24, Math.min(24, avgTilt)).toFixed(2),
          );
          this.settings.neutralSingleX = Number(
            Math.max(0.22, Math.min(0.78, avgX)).toFixed(3),
          );
          this.captureNeutral(0);
          this.calibrationHoldTime = 0;
          this.calibrationSingleSamples = [];
          return {
            progress: 1,
            completedJustNow: true,
            neutralAngleDeg: this.settings.neutralAngleDeg,
          };
        }
      } else {
        this.calibrationHoldTime = Math.max(0, this.calibrationHoldTime - safeDt * 0.8);
      }

      return {
        progress: Math.min(1, this.calibrationHoldTime / this.calibrationRequiredSeconds),
        completedJustNow: false,
        neutralAngleDeg: this.settings.neutralAngleDeg,
      };
    }

    this.calibrationHoldTime = Math.max(0, this.calibrationHoldTime - safeDt * 1.4);
    if (this.calibrationHoldTime === 0) {
      this.calibrationSamples = [];
      this.calibrationSingleSamples = [];
    }
    return {
      progress: Math.min(1, this.calibrationHoldTime / this.calibrationRequiredSeconds),
      completedJustNow: false,
      neutralAngleDeg: this.settings.neutralAngleDeg,
    };
  }

  /**
   * Evaluates normalized steering [-1..+1], visual wheel angle, throttle/brake gestures,
   * and tracking status from a `computeWheelGeometry` sample.
   */
  evaluate(geometry, dt = 0.016) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt));
    const {
      neutralAngleDeg,
      neutralSingleAngleDeg = 0,
      neutralSingleX = 0.5,
      sensitivity,
      deadZoneDeg,
      maxAngleDeg,
      smoothingRate,
      pedalMode,
    } = this.settings;

    const handCount = geometry?.handCount ?? 0;

    // 1. Handle 0 hands safely by holding briefly (140ms) then smoothly centering steering to 0
    if (!geometry || handCount === 0 || (!geometry.hasBothHands && !geometry.leftHub)) {
      this.missingHandsTimer += safeDt;
      this.recentTwoHandsTimer = Math.max(0, this.recentTwoHandsTimer - safeDt);

      if (this.missingHandsTimer > 0.14) {
        const returnAlpha = 1 - Math.exp(-8.8 * safeDt);
        this.smoothedSteer += (0 - this.smoothedSteer) * returnAlpha;
        this.smoothedWheelDeg += (0 - this.smoothedWheelDeg) * returnAlpha;
        if (Math.abs(this.smoothedSteer) < 0.005) this.smoothedSteer = 0;
        if (Math.abs(this.smoothedWheelDeg) < 0.1) this.smoothedWheelDeg = 0;
      }

      // Warn after ~0.35s so brief camera blinks don't flash alarm banners, while still catching lost hands quickly
      const isLost = this.missingHandsTimer >= 0.35;
      return {
        steer: this.smoothedSteer,
        wheelAngleDeg: this.smoothedWheelDeg,
        throttle: false,
        brake: false,
        pedalGesture: 'COAST',
        trackingLost: isLost,
        handCount: 0,
        confidence: 0,
        status: isLost ? GESTURE_STATUS.TRACKING_LOST : GESTURE_STATUS.HANDS_DETECTED,
      };
    }

    this.missingHandsTimer = 0;
    this.lastObservedHandCount = handCount;

    let relativeDeg = 0;
    if (geometry.hasBothHands) {
      // Primary 2-Hand Steering Wheel Mode (Chroma Confetti Drive Arena axle math)
      this.recentTwoHandsTimer = 0.55;
      this.lastRawAngleDeg = geometry.rawAngleDeg;
      relativeDeg = geometry.rawAngleDeg - neutralAngleDeg;
    } else {
      const singleTilt = geometry.singleHandTiltDeg || 0;
      const singleX = geometry.leftHub.x;
      this.lastSingleTiltDeg = singleTilt;
      this.lastSingleX = singleX;

      if (this.recentTwoHandsTimer > 0) {
        // One hand just dipped out of frame during 2-hand driving -> prevent sudden X-offset jump!
        this.recentTwoHandsTimer = Math.max(0, this.recentTwoHandsTimer - safeDt);
        const gentleTilt = (singleTilt - neutralSingleAngleDeg) * 0.65;
        relativeDeg = this.smoothedWheelDeg * 0.75 + gentleTilt * 0.25;
      } else {
        // Dedicated 1-Hand Mode: smooth horizontal hand shift + wrist tilt (just like Airplay 1-hand mode)
        const tiltDelta = (singleTilt - neutralSingleAngleDeg) * 0.72;
        const posDelta = (singleX - neutralSingleX) * 94.0;
        relativeDeg = Math.max(-52, Math.min(52, tiltDelta + posDelta));
      }
    }

    // 2. Crisp center dead zone
    let effectiveDeg = 0;
    const absRel = Math.abs(relativeDeg);
    if (absRel > deadZoneDeg) {
      effectiveDeg = Math.sign(relativeDeg) * (absRel - deadZoneDeg);
    }

    // 3. Direct proportional steering (zero sluggish curve suppression!)
    const usableRange = Math.max(10, maxAngleDeg - deadZoneDeg);
    const targetSteer = Math.max(-1, Math.min(1, (effectiveDeg / usableRange) * sensitivity));
    const targetWheelDeg = Math.max(-maxAngleDeg * 1.35, Math.min(maxAngleDeg * 1.35, relativeDeg * sensitivity));

    // 4. Snappy frame-rate independent output response
    const alpha = 1 - Math.exp(-Math.max(10, smoothingRate * 1.45) * safeDt);
    this.smoothedSteer += (targetSteer - this.smoothedSteer) * alpha;
    this.smoothedWheelDeg += (targetWheelDeg - this.smoothedWheelDeg) * alpha;

    if (Math.abs(this.smoothedSteer) < 0.015 && targetSteer === 0) {
      this.smoothedSteer = 0;
    }

    // 5. Gesture throttle & brake (works seamlessly for BOTH 2-hand and 1-hand modes!)
    const allVisibleOpen = geometry.hasBothHands
      ? geometry.openPalmCount >= 2
      : geometry.openPalmCount >= 1;
    const allVisibleGripped = geometry.openPalmCount === 0;
    let throttle = false;
    let brake = false;

    if (pedalMode === 'grip_gas_palm_brake') {
      // Closed wheel grip = Accelerate; Open palm(s) = Brake; Mixed (1 open, 1 grip) = Coast
      brake = allVisibleOpen;
      throttle = allVisibleGripped;
    } else if (pedalMode === 'auto_palm_brake') {
      brake = allVisibleOpen;
      throttle = !brake;
    } else if (pedalMode === 'palm_gas_fist_brake') {
      throttle = allVisibleOpen;
      brake = allVisibleGripped;
    } else {
      // 'auto_only': hands steer only; throttle/brake controlled by HUD slider or keys
      throttle = false;
      brake = false;
    }

    const pedalGesture = brake ? 'BRAKE' : throttle ? 'GAS' : 'COAST';

    // 6. Real-time gesture feedback status
    let baseStatus = geometry.hasBothHands
      ? GESTURE_STATUS.HANDS_DETECTED
      : GESTURE_STATUS.ONE_HAND_ACTIVE;

    if (this.smoothedSteer < -0.1) {
      baseStatus = GESTURE_STATUS.STEER_LEFT;
    } else if (this.smoothedSteer > 0.1) {
      baseStatus = GESTURE_STATUS.STEER_RIGHT;
    } else if (absRel > deadZoneDeg * 1.5) {
      baseStatus = GESTURE_STATUS.CENTER_HANDS;
    }

    return {
      steer: this.smoothedSteer,
      wheelAngleDeg: this.smoothedWheelDeg,
      throttle,
      brake,
      pedalGesture,
      trackingLost: false,
      handCount,
      confidence: geometry.confidence,
      status: baseStatus,
    };
  }
}
