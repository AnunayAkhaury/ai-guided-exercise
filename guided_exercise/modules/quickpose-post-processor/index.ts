import { requireNativeModule, type EventSubscription } from 'expo-modules-core';
import { Platform } from 'react-native';

export type ProcessVideoResult = {
  /** Human-readable form-feedback messages collected across all frames */
  feedbacks: string[];
  /** File path to the output video with pose overlay */
  outputPath: string;
};

export type ProgressEvent = {
  /** Processing progress 0–100 */
  progress: number;
};

type QuickPoseNativeModule = {
  processVideo(path: string, sdkKey: string): Promise<ProcessVideoResult>;
  addListener(eventName: 'onProgress', listener: (event: ProgressEvent) => void): EventSubscription;
};

let _module: QuickPoseNativeModule | null = null;

function getNativeModule(): QuickPoseNativeModule | null {
  if (_module) return _module;
  if (Platform.OS !== 'ios') return null;
  try {
    _module = requireNativeModule<QuickPoseNativeModule>('QuickPosePostProcessor');
  } catch {
    console.warn('[QuickPosePostProcessor] Native module not found – did you run `expo prebuild`?');
  }
  return _module;
}

/** Returns true only when the native module is loaded on iOS. */
export function isAvailable(): boolean {
  return Platform.OS === 'ios' && getNativeModule() !== null;
}

/**
 * Processes a local (for now) video file on-device using QuickPose Post Processor.
 *
 * @param videoPath 
 * @param sdkKey     
 * @param onProgress Optional callback receiving progress 0–100
 * @returns          Array of written feedbacks + path to video
 */
export async function processVideo(
  videoPath: string,
  sdkKey: string,
  onProgress?: (progress: number) => void
): Promise<ProcessVideoResult> {
  const native = getNativeModule();
  if (!native) {
    throw new Error('QuickPose Post Processor is only available on iOS.');
  }

  // Strip file:// prefix – Swift expects a plain file-system path
  const filePath = videoPath.startsWith('file://') ? videoPath.slice(7) : videoPath;

  // NativeModule extends EventEmitter, so addListener is called directly on the module
  let subscription: EventSubscription | null = null;
  if (onProgress) {
    subscription = native.addListener('onProgress', (event: ProgressEvent) => {
      onProgress(event.progress);
    });
  }

  try {
    return await native.processVideo(filePath, sdkKey);
  } finally {
    subscription?.remove();
  }
}
