import type { PoseFrame, PoseAngles } from '@/src/api/quickpose';

// ─── Threshold definitions ─────────────────────────────────────────────────

type Range = { min?: number; max?: number };

const inRange = (value: number | undefined, range: Range): boolean => {
  if (value === undefined) return false;
  if (range.min !== undefined && value < range.min) return false;
  if (range.max !== undefined && value > range.max) return false;
  return true;
};

// ─── Push Up rules ────────────────────────────────────────────────────────
// Good descent: elbow reaches 80–100°
// Good lockout:  elbow extends to 160–180°
// Body alignment: hip angle should stay above 160° (no sagging/piking)

function analyzePushUp(frames: PoseFrame[]): string[] {
  const feedback: string[] = [];

  const elbowAngles = frames
    .map((f) => f.angles.elbowLeft ?? f.angles.elbowRight)
    .filter((a): a is number => a !== undefined);

  const hipAngles = frames
    .map((f) => f.angles.hipLeft ?? f.angles.hipRight)
    .filter((a): a is number => a !== undefined);

  if (elbowAngles.length === 0) {
    feedback.push('Could not detect arm position — make sure your full body is visible.');
    return feedback;
  }

  const minElbow = Math.min(...elbowAngles);
  const maxElbow = Math.max(...elbowAngles);

  // Descent depth
  if (minElbow < 80) {
    feedback.push('Improve: Arms went past 90° — reduce depth slightly to protect your joints.');
  } else if (minElbow <= 100) {
    feedback.push('Great depth! Your elbows reached the correct 80–100° range on the way down.');
  } else {
    feedback.push('Improve: Not going low enough — aim to bend your elbows to 90° at the bottom.');
  }

  // Lockout at the top
  if (maxElbow >= 160) {
    feedback.push('Good lockout — arms are fully extended at the top of each rep.');
  } else {
    feedback.push('Improve: Fully extend your arms at the top of each rep for complete range of motion.');
  }

  // Hip/core alignment
  if (hipAngles.length > 0) {
    const minHip = Math.min(...hipAngles);
    if (minHip < 150) {
      feedback.push('Improve: Hips are dropping or piking — keep your core tight to maintain a straight body line.');
    } else {
      feedback.push('Solid body alignment — core is engaged and hips are level throughout.');
    }
  }

  return feedback;
}

// ─── Mountain Climber rules ───────────────────────────────────────────────
// Hip should stay near extended (165°+) between drives
// Knee drive should tuck to < 90°

function analyzeMountainClimber(frames: PoseFrame[]): string[] {
  const feedback: string[] = [];

  const hipAngles = frames
    .map((f) => f.angles.hipLeft ?? f.angles.hipRight)
    .filter((a): a is number => a !== undefined);

  const kneeAngles = frames
    .map((f) => f.angles.kneeLeft ?? f.angles.kneeRight)
    .filter((a): a is number => a !== undefined);

  if (hipAngles.length === 0 && kneeAngles.length === 0) {
    feedback.push('Could not detect leg position — make sure your full body is visible.');
    return feedback;
  }

  // Hip position (should stay mostly extended except during knee drive)
  if (hipAngles.length > 0) {
    const minHip = Math.min(...hipAngles);
    if (minHip < 140) {
      feedback.push('Improve: Hips are rising too high — keep them level with your shoulders.');
    } else {
      feedback.push('Good hip position — staying level throughout the movement.');
    }
  }

  // Knee drive depth
  if (kneeAngles.length > 0) {
    const minKnee = Math.min(...kneeAngles);
    if (minKnee <= 90) {
      feedback.push('Great knee drive — bringing the knee past 90° for full range of motion.');
    } else {
      feedback.push('Improve: Drive your knee further toward your chest on each rep for better range of motion.');
    }
  }

  return feedback;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Generates rule-based coaching feedback from QuickPose frame data.
 *
 * @param frames    Pose frames returned by analyzeVideo()
 * @param exercise  Exercise name ("Push Up" | "Mountain Climber")
 * @returns         Array of human-readable feedback strings
 */
export function generateFeedback(frames: PoseFrame[], exercise: string): string[] {
  if (frames.length === 0) {
    return ['No pose data was detected — check that your body is fully in frame.'];
  }

  switch (exercise) {
    case 'Push Up':
      return analyzePushUp(frames);
    case 'Mountain Climber':
      return analyzeMountainClimber(frames);
    default:
      return ['Pose analysis complete. Exercise-specific feedback is not yet configured for this movement.'];
  }
}
