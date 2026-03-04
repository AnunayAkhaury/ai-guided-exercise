import { NativeModules } from 'react-native';

const { QuickPoseVideoModule } = NativeModules;

export type PoseAngles = {
  elbowLeft?: number;
  elbowRight?: number;
  kneeLeft?: number;
  kneeRight?: number;
  hipLeft?: number;
  hipRight?: number;
  shoulderLeft?: number;
  shoulderRight?: number;
};

export type PoseFrame = {
  timestamp: number; // seconds into the video
  angles: PoseAngles;
};

/**
 * Analyzes an exercise video for pose/angle data.
 * Accepts the S3 presigned HTTPS URL directly — no local download needed.
 *
 * @param videoUrl  S3 presigned HTTPS URL
 * @param exercise  Exercise name, e.g. "Push Up" or "Mountain Climber"
 * @returns         Array of pose frames sampled from the video
 */
export function analyzeVideo(videoUrl: string, exercise: string): Promise<PoseFrame[]> {
  if (!QuickPoseVideoModule) {
    return Promise.reject(
      new Error('QuickPoseVideoModule is not available on this platform.')
    );
  }
  return QuickPoseVideoModule.analyzeVideo(videoUrl, exercise);
}
