/**
 * SteeringCalibration.js
 *
 * Mathematical steering wheel gesture analyzer (supporting BOTH 2-Hand Wheel Axle
 * and seamless 1-Hand Tilt/Shift Steering for phone & laptop ergonomics),
 * auto-neutral calibrator, 1-Euro adaptive jitter filter, and tracking-loss safety controller.
 */

const STORAGE_KEY = 'motion_drive_3d_steering_settings_v1';

export const GESTURE_STATUS = {
  HANDS_DETECTED: 'HANDS DETECTED',
  ONE_HAND_ACTIVE: '1-HAND STEER ACTIVE',
  CALIBRATE: 'CALIBRATE STEERING',
  STEER_LEFT: 'STEER LEFT',
  STEER_RIGHT: 'STEER RIGHT',
  CENTER_HANDS: 'CENTER YOUR HANDS',
  TRACKING_LOST: 'TRACKING LOST — SHOW HANDS',
};

export const DEFAULT_STEERING_SETTINGS = {
  neutralAngleDeg: 0,
  neutralSingleAngleDeg: 0,
  neutralSingleX: 0.5,
  sensitivity: 1.2,
  deadZoneDeg: 3.5,
  maxAngleDeg: 36.0,
  smoothingRate: 12.0,
  pedalMode: 'auto_palm_brake',
  isCalibrated: false,
};

/**
 * Computes a stable palm grip center in mirrored normalized coordinates [0..1]
 * using the wrist (0) and knuckle MCP joints (5, 9, 17).
 */
export function computePalmHubMirrored(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) {
    return null;
  }
  const indices = [0, 5, 9, 17];
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
 * Scale-invariant check for whether a hand has all 4 fingers clearly spread open
 * (deliberate "STOP" brake gesture) vs a relaxed or closed steering grip.
 */
export function isHandOpenPalm(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return false;
  const wrist = landmarks[0];
  const fingerPairs = [
    [8, 6],   // Index tip vs PIP
    [12, 10], // Middle tip vs PIP
    [16, 14], // Ring tip vs PIP
    [20, 18], // Pinky tip vs PIP
  ];

  let extendedCount = 0;
  for (let i = 0; i < fingerPairs.length; i++) {
    const tip = landmarks[fingerPairs[i][0]];
    const pip = landmarks[fingerPairs[i][1]];
    const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    if (tipDist > pipDist * 1.32) {
      extendedCount++;
    }
  }
  return extendedCount >= 4;
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
    avgConfidence = count > 0 ? totalScore / count : 0.85;
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

  // Prevent wild angle spikes if hands cross vertically directly over one another
  const safeDx = Math.max(0.04, dx);
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
    this.filteredAngleDeg = 0;
    this.filteredAngleVel = 0;
    this.hasAngleSeed = false;
    this.lastRawAngleDeg = 0;
    this.lastSingleTiltDeg = 0;
    this.lastSingleX = 0.5;
    this.missingHandsTimer = 0;
    this.calibrationHoldTime = 0;
    this.calibrationSamples = [];
    this.calibrationSingleSamples = [];
    this.calibrationRequiredSeconds = 0.72;
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
    this.resetCalibrationProgress();
    this.saveSettings();
  }

  resetCalibrationProgress() {
    this.calibrationHoldTime = 0;
    this.calibrationSamples = [];
    this.calibrationSingleSamples = [];
  }

  /**
   * Immediately sets the neutral reference angle from the latest detected angle
   * (or an explicit angle in degrees).
   */
  captureNeutral(explicitAngleDeg = null) {
    const angle =
      typeof explicitAngleDeg === 'number' ? explicitAngleDeg : this.lastRawAngleDeg;
    const clampedNeutral = Math.max(-28, Math.min(28, angle));
    this.settings.neutralAngleDeg = Number(clampedNeutral.toFixed(2));
    this.settings.neutralSingleAngleDeg = Number(
      Math.max(-28, Math.min(28, this.lastSingleTiltDeg)).toFixed(2),
    );
    this.settings.neutralSingleX = Number(
      Math.max(0.2, Math.min(0.8, this.lastSingleX)).toFixed(3),
    );
    this.settings.isCalibrated = true;
    this.smoothedSteer = 0;
    this.smoothedWheelDeg = 0;
    this.filteredAngleDeg = this.settings.neutralAngleDeg;
    this.filteredAngleVel = 0;
    this.hasAngleSeed = false;
    this.saveSettings();
    return this.settings.neutralAngleDeg;
  }

  /**
   * Feeds live hand geometry during the calibration screen to auto-lock neutral
   * once the player holds 2 hands (or 1 hand on mobile) steady for ~0.72 seconds.
   */
  feedCalibrationSample(geometry, dt) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt || 0.016));

    // 2-Hand calibration (Primary)
    if (geometry && geometry.hasBothHands && geometry.handSpan >= 0.055) {
      this.lastRawAngleDeg = geometry.rawAngleDeg;

      if (Math.abs(geometry.rawAngleDeg) <= 30) {
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

    // 1-Hand calibration (Phone selfie / single-hand comfort support)
    if (geometry && geometry.handCount === 1 && geometry.leftHub) {
      this.lastSingleTiltDeg = geometry.singleHandTiltDeg || 0;
      this.lastSingleX = geometry.leftHub.x;

      if (Math.abs(this.lastSingleTiltDeg) <= 32) {
        this.calibrationHoldTime += safeDt * 0.85;
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

    // 0 Hands visible
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
      isCalibrated,
    } = this.settings;

    const handCount = geometry?.handCount ?? 0;

    // 1. Handle 0 hands (complete tracking loss) safely by decaying steering to neutral (0)
    if (!geometry || handCount === 0 || (!geometry.hasBothHands && !geometry.leftHub)) {
      this.missingHandsTimer += safeDt;
      this.hasAngleSeed = false;

      // Brief 110ms micro-dropout hold prevents jitter if webcam drops 1-2 frames mid-turn
      if (this.missingHandsTimer > 0.11) {
        const returnAlpha = 1 - Math.exp(-9.2 * safeDt);
        this.smoothedSteer += (0 - this.smoothedSteer) * returnAlpha;
        this.smoothedWheelDeg += (0 - this.smoothedWheelDeg) * returnAlpha;
        if (Math.abs(this.smoothedSteer) < 0.005) this.smoothedSteer = 0;
        if (Math.abs(this.smoothedWheelDeg) < 0.1) this.smoothedWheelDeg = 0;
      }

      const isLost = this.missingHandsTimer >= 0.11;
      return {
        steer: this.smoothedSteer,
        wheelAngleDeg: this.smoothedWheelDeg,
        throttle: true,
        brake: false,
        trackingLost: isLost,
        handCount: 0,
        confidence: 0,
        status: isLost ? GESTURE_STATUS.TRACKING_LOST : GESTURE_STATUS.HANDS_DETECTED,
      };
    }

    // At least 1 hand is visible!
    this.missingHandsTimer = 0;

    let measuredRelativeDeg = 0;
    if (geometry.hasBothHands) {
      this.lastRawAngleDeg = geometry.rawAngleDeg;
      measuredRelativeDeg = geometry.rawAngleDeg - neutralAngleDeg;
    } else {
      // Seamless 1-Hand Steering: combines wrist-to-knuckle tilt + horizontal shift from center
      const singleTilt = geometry.singleHandTiltDeg || 0;
      const singleX = geometry.leftHub.x;
      this.lastSingleTiltDeg = singleTilt;
      this.lastSingleX = singleX;
      const tiltDelta = (singleTilt - neutralSingleAngleDeg) * 0.85;
      const posDelta = (singleX - neutralSingleX) * 78.0;
      measuredRelativeDeg = Math.max(-52, Math.min(52, tiltDelta + posDelta));
    }

    // 2. Adaptive 1-Euro pre-filter on relative steering angle
    if (!this.hasAngleSeed) {
      this.filteredAngleDeg = measuredRelativeDeg;
      this.filteredAngleVel = 0;
      this.hasAngleSeed = true;
    } else {
      const rawVel = (measuredRelativeDeg - this.filteredAngleDeg) / safeDt;
      const velAlpha = 1 - Math.exp(-16.0 * safeDt);
      this.filteredAngleVel += (rawVel - this.filteredAngleVel) * velAlpha;

      const minRate = Math.max(5.0, smoothingRate * 0.7);
      const adaptiveRate = minRate + Math.min(26.0, Math.abs(this.filteredAngleVel) * 0.15);
      const angleAlpha = 1 - Math.exp(-adaptiveRate * safeDt);
      this.filteredAngleDeg += (measuredRelativeDeg - this.filteredAngleDeg) * angleAlpha;
    }

    const relativeDeg = this.filteredAngleDeg;

    // 3. Smooth center dead zone
    let effectiveDeg = 0;
    const absRel = Math.abs(relativeDeg);
    if (absRel > deadZoneDeg) {
      effectiveDeg = Math.sign(relativeDeg) * (absRel - deadZoneDeg);
    }

    // 4. Normalize against maximum steering lock & apply progressive precision curve
    const usableRange = Math.max(10, maxAngleDeg - deadZoneDeg);
    const linearNorm = Math.max(-1, Math.min(1, (effectiveDeg / usableRange) * sensitivity));
    const absLin = Math.abs(linearNorm);
    const curvedMag = 0.62 * absLin + 0.38 * Math.pow(absLin, 1.45);
    const targetSteer = Math.sign(linearNorm) * Math.min(1, curvedMag);
    const targetWheelDeg = Math.max(-maxAngleDeg, Math.min(maxAngleDeg, relativeDeg * sensitivity));

    // 5. Frame-rate independent output smoothing
    const alpha = 1 - Math.exp(-Math.max(4, smoothingRate * 1.2) * safeDt);
    this.smoothedSteer += (targetSteer - this.smoothedSteer) * alpha;
    this.smoothedWheelDeg += (targetWheelDeg - this.smoothedWheelDeg) * alpha;

    if (Math.abs(this.smoothedSteer) < 0.003 && targetSteer === 0) {
      this.smoothedSteer = 0;
    }

    // 6. Evaluate gesture throttle & brake (requires deliberate open palm(s))
    const allVisibleOpen =
      geometry.hasBothHands ? geometry.openPalmCount === 2 : false;
    const bothGripped = geometry.openPalmCount === 0;
    let throttle = true;
    let brake = false;

    if (pedalMode === 'auto_palm_brake') {
      brake = allVisibleOpen;
      throttle = !brake;
    } else if (pedalMode === 'grip_gas_palm_brake') {
      brake = allVisibleOpen;
      throttle = bothGripped;
    } else if (pedalMode === 'palm_gas_fist_brake') {
      throttle = allVisibleOpen;
      brake = bothGripped;
    } else {
      throttle = true;
      brake = false;
    }

    // 7. Real-time gesture feedback status
    let status = geometry.hasBothHands
      ? GESTURE_STATUS.HANDS_DETECTED
      : GESTURE_STATUS.ONE_HAND_ACTIVE;

    if (!isCalibrated && Math.abs(this.smoothedSteer) < 0.14) {
      status = GESTURE_STATUS.CALIBRATE;
    } else if (this.smoothedSteer < -0.13) {
      status = GESTURE_STATUS.STEER_LEFT;
    } else if (this.smoothedSteer > 0.13) {
      status = GESTURE_STATUS.STEER_RIGHT;
    } else if (absRel <= deadZoneDeg * 1.35) {
      status = geometry.hasBothHands
        ? GESTURE_STATUS.HANDS_DETECTED
        : GESTURE_STATUS.ONE_HAND_ACTIVE;
    } else {
      status = GESTURE_STATUS.CENTER_HANDS;
    }

    return {
      steer: this.smoothedSteer,
      wheelAngleDeg: this.smoothedWheelDeg,
      throttle,
      brake,
      trackingLost: false,
      handCount,
      confidence: geometry.confidence,
      status,
    };
  }
}
