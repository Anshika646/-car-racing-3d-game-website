/**
 * CollisionSystem.js
 *
 * Pure, deterministic AABB collision & near-miss overtake detector
 * between the player's car and active highway traffic vehicles.
 */

export class CollisionSystem {
  constructor(options = {}) {
    this.maxHealth = options.maxHealth || 3;
    this.health = this.maxHealth;
    this.nearMissLateralMargin = options.nearMissLateralMargin || 1.45;
  }

  reset() {
    this.health = this.maxHealth;
  }

  /**
   * Checks whether two axis-aligned vehicle bounding boxes overlap on the XZ plane
   * (with a slight 8% forgiveness trim so grazing mirrors feels fair).
   */
  static intersectsAABB(a, b, forgiveness = 0.92) {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    const combinedHalfW = (a.halfWidth + b.halfWidth) * forgiveness;
    const combinedHalfL = (a.halfLength + b.halfLength) * forgiveness;
    return dx < combinedHalfW && dz < combinedHalfL;
  }

  /**
   * Evaluates all active traffic vehicles against the player's bounds.
   * Returns { hitVehicle, fatalCrash, nearMissCount, health }.
   */
  evaluate(playerBounds, trafficVehicles = [], isInvulnerable = false, playerSpeedMps = 0) {
    let hitVehicle = null;
    let fatalCrash = false;
    let nearMissCount = 0;

    for (let i = 0; i < trafficVehicles.length; i++) {
      const v = trafficVehicles[i];
      if (v.collided) continue;

      if (CollisionSystem.intersectsAABB(playerBounds, v)) {
        v.collided = true;
        if (!isInvulnerable) {
          hitVehicle = v;
          this.health = Math.max(0, this.health - 1);
          if (this.health <= 0) {
            fatalCrash = true;
          }
          break;
        }
      } else if (
        !v.nearMissAwarded &&
        playerSpeedMps > 20 &&
        v.z > playerBounds.z + 1.2 &&
        v.z < playerBounds.z + 8.5
      ) {
        // Vehicle just passed close alongside the player without hitting
        const lateralGap =
          Math.abs(playerBounds.x - v.x) - (playerBounds.halfWidth + v.halfWidth);
        if (lateralGap >= 0 && lateralGap <= this.nearMissLateralMargin) {
          v.nearMissAwarded = true;
          nearMissCount++;
        }
      }
    }

    return {
      hitVehicle,
      fatalCrash,
      nearMissCount,
      health: this.health,
    };
  }
}
