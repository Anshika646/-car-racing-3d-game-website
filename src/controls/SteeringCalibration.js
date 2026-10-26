/**
 * SteeringCalibration.js
 *
 * Pure mathematical steering wheel gesture analyzer, neutral-grip calibrator,
 * low-pass jitter smoother, dead-zone processor, and tracking-loss safety controller.
 *
 * STEERING GEOMETRY & MIRRORING EXPLANATION:
 * 1. Raw webcam frames represent an unmirrored camera sensor view: the player's physical
 *    LEFT hand appears on the RIGHT side of the raw image (rawX ~ 0.70), while their
 *    physical RIGHT hand appears on the LEFT side (rawX ~ 0.30).
 * 2. Because the preview is mirrored horizontally for natural human feedback, we map
 *    every landmark into mirrored screen coordinates first:
 *      mirroredX = 1.0 - rawLandmark.x
 *      mirroredY = rawLandmark.y   (0 = top of frame, 1 = bottom of frame)
 * 3. We sort the two detected palm hubs by `mirroredX` so `leftHand` is always the
 *    leftmost hand in the mirrored view (the player's physical left hand) and `rightHand`
 *    is the rightmost hand (the player's physical right hand).
 * 4. The imaginary steering axle vector from `leftHand` to `rightHand` is:
 *      dx = rightHand.x - leftHand.x   (positive horizontal hand separation)
 *      dy = rightHand.y - leftHand.y   (vertical tilt between hands)
 *    - Turning LEFT (counter-clockwise): left hand moves DOWN (+y), right hand moves UP (-y),
 *      making `dy < 0` and `atan2(dy, dx) < 0` -> negative steer value -> car steers LEFT.
 *    - Turning RIGHT (clockwise): left hand moves UP (-y), right hand moves DOWN (+y),
 *      making `dy > 0` and `atan2(dy, dx) > 0` -> positive steer value -> car steers RIGHT.
 *    This depends purely on the relative angle between the two hands rather than where
 *    the player sits horizontally in front of the webcam.
 */

const STORAGE_KEY = 'motion_drive_3d_steering_settings_v1';

export const GESTURE_STATUS = {
  HANDS_DETECTED: 'HANDS DETECTED',
  CALIBRATE: 'CALIBRATE STEERING',
  STEER_LEFT: 'STEER LEFT',
  STEER_RIGHT: 'STEER RIGHT',
  CENTER_HANDS: 'CENTER YOUR HANDS',
  TRACKING_LOST: 'TRACKING LOST — SHOW BOTH HANDS',
};

export const DEFAULT_STEERING_SETTINGS = {
  neutralAngleDeg: 0,
  sensitivity: 1.15,
  deadZoneDeg: 4.0,
  maxAngleDeg: 38.0,
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
 * Scale-invariant check for whether a hand has fingers extended (open palm)
 * vs curled around an imaginary steering wheel rim (closed grip).
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
    if (tipDist > pipDist * 1.16) {
      extendedCount++;
    }
  }
  return extendedCount >= 3;
}

/**
 * Extracts two-hand wheel angle, hand hubs, confidence, and open-palm state
 * from MediaPipe HandLandmarker detections.
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

  if (handCount < 2) {
    const singleHub = handCount === 1 ? computePalmHubMirrored(landmarksList[0]) : null;
    return {
      handCount,
      hasBothHands: false,
      leftHub: singleHub,
      rightHub: null,
      rawAngleDeg: 0,
      handSpan: 0,
      openPalmCount: handCount === 1 && isHandOpenPalm(landmarksList[0]) ? 1 : 0,
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
  const safeDx = Math.max(0.06, dx);
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
    this.missingHandsTimer = 0;
    this.calibrationHoldTime = 0;
    this.calibrationSamples = [];
    this.calibrationRequiredSeconds = 1.1;
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
  }

  /**
   * Immediately sets the neutral reference angle from the latest detected angle
   * (or an explicit angle in degrees).
   */
  captureNeutral(explicitAngleDeg = null) {
    const angle =
      typeof explicitAngleDeg === 'number' ? explicitAngleDeg : this.lastRawAngleDeg;
    const clampedNeutral = Math.max(-25, Math.min(25, angle));
    this.settings.neutralAngleDeg = Number(clampedNeutral.toFixed(2));
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
   * once the player holds two hands reasonably level for ~1.1 seconds.
   */
  feedCalibrationSample(geometry, dt) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt || 0.016));
    if (!geometry || !geometry.hasBothHands || geometry.handSpan < 0.12) {
      this.calibrationHoldTime = Math.max(0, this.calibrationHoldTime - safeDt * 1.5);
      if (this.calibrationHoldTime === 0) {
        this.calibrationSamples = [];
      }
      return {
        progress: Math.min(1, this.calibrationHoldTime / this.calibrationRequiredSeconds),
        completedJustNow: false,
        neutralAngleDeg: this.settings.neutralAngleDeg,
      };
    }

    this.lastRawAngleDeg = geometry.rawAngleDeg;

    // Check that hands are held reasonably steady and near horizontal (-22° to +22°)
    if (Math.abs(geometry.rawAngleDeg) <= 22) {
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
        return {
          progress: 1,
          completedJustNow: true,
          neutralAngleDeg: this.settings.neutralAngleDeg,
        };
      }
    } else {
      this.calibrationHoldTime = Math.max(0, this.calibrationHoldTime - safeDt);
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
      sensitivity,
      deadZoneDeg,
      maxAngleDeg,
      smoothingRate,
      pedalMode,
      isCalibrated,
    } = this.settings;

    // 1. Handle missing hands / tracking loss safely by decaying steering to neutral (0)
    if (!geometry || !geometry.hasBothHands) {
      this.missingHandsTimer += safeDt;
      this.hasAngleSeed = false;
      const returnAlpha = 1 - Math.exp(-8.5 * safeDt);
      this.smoothedSteer += (0 - this.smoothedSteer) * returnAlpha;
      this.smoothedWheelDeg += (0 - this.smoothedWheelDeg) * returnAlpha;
      if (Math.abs(this.smoothedSteer) < 0.005) this.smoothedSteer = 0;
      if (Math.abs(this.smoothedWheelDeg) < 0.1) this.smoothedWheelDeg = 0;

      // Short 100ms grace period avoids flickering on a single dropped frame
      const isLost = this.missingHandsTimer >= 0.1 || (geometry?.handCount ?? 0) < 2;
      return {
        steer: this.smoothedSteer,
        wheelAngleDeg: this.smoothedWheelDeg,
        throttle: false,
        brake: false,
        trackingLost: isLost,
        handCount: geometry?.handCount ?? 0,
        confidence: geometry?.confidence ?? 0,
        status: GESTURE_STATUS.TRACKING_LOST,
      };
    }

    // Both hands visible
    this.missingHandsTimer = 0;
    this.lastRawAngleDeg = geometry.rawAngleDeg;

    // 2. Adaptive 1-Euro pre-filter on raw wheel angle:
    //    Calm cutoff at rest suppresses webcam landmark micro-tremor, while rapid hand
    //    rotations automatically boost cutoff frequency for instant, lag-free steering.
    if (!this.hasAngleSeed) {
      this.filteredAngleDeg = geometry.rawAngleDeg;
      this.filteredAngleVel = 0;
      this.hasAngleSeed = true;
    } else {
      const rawVel = (geometry.rawAngleDeg - this.filteredAngleDeg) / safeDt;
      const velAlpha = 1 - Math.exp(-16.0 * safeDt);
      this.filteredAngleVel += (rawVel - this.filteredAngleVel) * velAlpha;

      const minRate = Math.max(4.5, smoothingRate * 0.65);
      const adaptiveRate = minRate + Math.min(24.0, Math.abs(this.filteredAngleVel) * 0.14);
      const angleAlpha = 1 - Math.exp(-adaptiveRate * safeDt);
      this.filteredAngleDeg += (geometry.rawAngleDeg - this.filteredAngleDeg) * angleAlpha;
    }

    // 3. Relative angle from calibrated neutral reference
    const relativeDeg = this.filteredAngleDeg - neutralAngleDeg;

    // 4. Apply smooth center dead zone so natural micro-tremors don't drift the car
    let effectiveDeg = 0;
    const absRel = Math.abs(relativeDeg);
    if (absRel > deadZoneDeg) {
      effectiveDeg = Math.sign(relativeDeg) * (absRel - deadZoneDeg);
    }

    // 5. Normalize against maximum steering lock & apply progressive precision curve
    const usableRange = Math.max(10, maxAngleDeg - deadZoneDeg);
    const linearNorm = Math.max(-1, Math.min(1, (effectiveDeg / usableRange) * sensitivity));
    const absLin = Math.abs(linearNorm);
    // Blend 58% linear + 42% power-1.55 curve for fine center control and crisp full lock
    const curvedMag = 0.58 * absLin + 0.42 * Math.pow(absLin, 1.55);
    const targetSteer = Math.sign(linearNorm) * Math.min(1, curvedMag);
    const targetWheelDeg = Math.max(-maxAngleDeg, Math.min(maxAngleDeg, relativeDeg * sensitivity));

    // 6. Frame-rate independent output smoothing
    const alpha = 1 - Math.exp(-Math.max(3, smoothingRate * 1.15) * safeDt);
    this.smoothedSteer += (targetSteer - this.smoothedSteer) * alpha;
    this.smoothedWheelDeg += (targetWheelDeg - this.smoothedWheelDeg) * alpha;

    if (Math.abs(this.smoothedSteer) < 0.003 && targetSteer === 0) {
      this.smoothedSteer = 0;
    }

    // 6. Evaluate gesture throttle & brake according to user's selected pedal mode
    const bothOpen = geometry.openPalmCount === 2;
    const bothGripped = geometry.openPalmCount === 0;
    let throttle = true;
    let brake = false;

    if (pedalMode === 'auto_palm_brake') {
      brake = bothOpen;
      throttle = !brake;
    } else if (pedalMode === 'grip_gas_palm_brake') {
      brake = bothOpen;
      throttle = bothGripped;
    } else if (pedalMode === 'palm_gas_fist_brake') {
      throttle = bothOpen;
      brake = bothGripped;
    } else {
      // 'auto_only' — hands strictly steer, car accelerates automatically
      throttle = true;
      brake = false;
    }

    // 7. Determine accurate real-time gesture feedback status
    let status = GESTURE_STATUS.HANDS_DETECTED;
    if (!isCalibrated) {
      status = GESTURE_STATUS.CALIBRATE;
    } else if (this.smoothedSteer < -0.14) {
      status = GESTURE_STATUS.STEER_LEFT;
    } else if (this.smoothedSteer > 0.14) {
      status = GESTURE_STATUS.STEER_RIGHT;
    } else if (absRel <= deadZoneDeg * 1.25) {
      status = GESTURE_STATUS.HANDS_DETECTED;
    } else {
      status = GESTURE_STATUS.CENTER_HANDS;
    }

    return {
      steer: this.smoothedSteer,
      wheelAngleDeg: this.smoothedWheelDeg,
      throttle,
      brake,
      trackingLost: false,
      handCount: 2,
      confidence: geometry.confidence,
      status,
    };
  }
}
