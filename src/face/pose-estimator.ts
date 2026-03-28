import type { FaceLandmarks, HeadPose, SmoothedPose, Point3D } from '../types.js';
import {
  NOSE_TIP_INDEX,
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
  POSE_SCALING_FACTOR,
} from '../config.js';

// ---------------------------------------------------------------------------
// PoseEstimator
// ---------------------------------------------------------------------------

/**
 * Computes head yaw and pitch from MediaPipe 468-point face landmarks.
 *
 * Algorithm:
 *  1. Locate nose tip, left eye centre, right eye centre.
 *  2. Normalise all coordinates by interpupillary distance (IPD) for
 *     scale invariance (robust to distance from camera).
 *  3. Estimate yaw from horizontal nose offset relative to eye midpoint.
 *  4. Estimate pitch from vertical nose offset relative to eye midpoint.
 *
 * Also maintains an EMA (exponential moving average) for smoothing.
 */
export class PoseEstimator {
  private lastYaw: number | null = null;
  private lastPitch: number | null = null;

  constructor(private readonly smoothingFactor: number = 0.3) {}

  /**
   * Estimate yaw and pitch from face landmarks.
   * Returns a frozen SmoothedPose (EMA applied).
   */
  estimate(landmarks: FaceLandmarks): SmoothedPose {
    const rawYaw = this.computeYaw(landmarks.keypoints);
    const rawPitch = this.computePitch(landmarks.keypoints);

    const smoothedYaw = this.ema(rawYaw, this.lastYaw);
    const smoothedPitch = this.ema(rawPitch, this.lastPitch);

    this.lastYaw = smoothedYaw;
    this.lastPitch = smoothedPitch;

    return Object.freeze({
      yaw: smoothedYaw,
      pitch: smoothedPitch,
      timestamp: landmarks.frameTimestamp,
      isSmoothed: true as const,
    });
  }

  /** Estimate raw yaw without updating internal EMA state. */
  estimateRaw(landmarks: FaceLandmarks): HeadPose {
    return Object.freeze({
      yaw: this.computeYaw(landmarks.keypoints),
      pitch: this.computePitch(landmarks.keypoints),
      timestamp: landmarks.frameTimestamp,
    });
  }

  /** Reset the EMA state (call when face is lost and re-acquired). */
  reset(): void {
    this.lastYaw = null;
    this.lastPitch = null;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private computeYaw(keypoints: ReadonlyArray<Point3D>): number {
    const noseTip = keypoints[NOSE_TIP_INDEX];
    const leftEye = averagePoints(keypoints, LEFT_EYE_INDICES);
    const rightEye = averagePoints(keypoints, RIGHT_EYE_INDICES);

    const ipd = euclidean2D(leftEye, rightEye);
    if (ipd < 1e-6) return 0;

    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const offsetX = (noseTip.x - eyeMidX) / ipd;

    return radToDeg(Math.atan(offsetX * POSE_SCALING_FACTOR));
  }

  private computePitch(keypoints: ReadonlyArray<Point3D>): number {
    const noseTip = keypoints[NOSE_TIP_INDEX];
    const leftEye = averagePoints(keypoints, LEFT_EYE_INDICES);
    const rightEye = averagePoints(keypoints, RIGHT_EYE_INDICES);

    const ipd = euclidean2D(leftEye, rightEye);
    if (ipd < 1e-6) return 0;

    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    // Invert Y: canvas Y grows downward, but pitch-up should be positive
    const offsetY = (eyeMidY - noseTip.y) / ipd;

    return radToDeg(Math.atan(offsetY * POSE_SCALING_FACTOR));
  }

  /**
   * Exponential Moving Average.
   * If prev is null (first sample), return current unmodified.
   */
  private ema(current: number, prev: number | null): number {
    if (prev === null) return current;
    return prev + this.smoothingFactor * (current - prev);
  }
}

// ---------------------------------------------------------------------------
// Pure utility functions (exported for testing)
// ---------------------------------------------------------------------------

export function averagePoints(
  keypoints: ReadonlyArray<Point3D>,
  indices: Readonly<readonly number[]>,
): Point3D {
  const sum = indices.reduce(
    (acc, idx) => ({
      x: acc.x + (keypoints[idx]?.x ?? 0),
      y: acc.y + (keypoints[idx]?.y ?? 0),
      z: acc.z + (keypoints[idx]?.z ?? 0),
    }),
    { x: 0, y: 0, z: 0 },
  );
  const n = indices.length || 1;
  return Object.freeze({ x: sum.x / n, y: sum.y / n, z: sum.z / n });
}

export function euclidean2D(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
