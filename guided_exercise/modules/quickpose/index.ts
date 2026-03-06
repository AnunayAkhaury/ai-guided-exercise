import { requireNativeModule } from 'expo-modules-core';

const QuickPoseModule = requireNativeModule('QuickPose');

export async function initialize(): Promise<void> {
  return QuickPoseModule.initialize();
}

export async function processFrame(base64Jpeg: string): Promise<unknown> {
  return QuickPoseModule.processFrame(base64Jpeg);
}
