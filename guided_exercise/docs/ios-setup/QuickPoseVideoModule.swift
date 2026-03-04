import Foundation
import AVFoundation
import QuickPoseCore

/**
 * React Native native module for QuickPose video analysis (iOS).
 *
 * INSTALLATION:
 *  1. Run `expo prebuild --platform ios` from guided_exercise/ to generate ios/
 *  2. Add to ios/Podfile inside the main target:
 *       pod 'QuickPoseCore', '~> 0.5'
 *  3. Run `pod install` inside ios/
 *  4. Copy this file to ios/<AppName>/QuickPoseVideoModule.swift
 *  5. Copy QuickPoseVideoModule.m to ios/<AppName>/QuickPoseVideoModule.m
 *  6. Add both files to the Xcode project
 *
 * Accepts the S3 presigned HTTPS URL directly — AVURLAsset handles
 * remote streaming without downloading the file to disk.
 *
 * NOTE: Replace "YOUR_QUICKPOSE_SDK_KEY" with your key from quickpose.ai
 */
@objc(QuickPoseVideoModule)
class QuickPoseVideoModule: NSObject {

  private let sdkKey = "YOUR_QUICKPOSE_SDK_KEY"

  /// Sample every 500ms of video
  private let frameIntervalSeconds: Double = 0.5

  @objc
  func analyzeVideo(_ videoUrl: String,
                    exercise: String,
                    resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {

    guard let url = URL(string: videoUrl) else {
      reject("INVALID_URL", "Could not parse video URL", nil)
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      let asset = AVURLAsset(url: url)
      let duration = CMTimeGetSeconds(asset.duration)

      guard duration > 0 else {
        reject("METADATA_ERROR", "Could not read video duration", nil)
        return
      }

      let generator = AVAssetImageGenerator(asset: asset)
      generator.appliesPreferredTrackTransform = true
      generator.requestedTimeToleranceBefore = CMTime(seconds: 0.1, preferredTimescale: 600)
      generator.requestedTimeToleranceAfter  = CMTime(seconds: 0.1, preferredTimescale: 600)

      let quickPose = QuickPose(sdkKey: self.sdkKey)
      let features  = self.featuresForExercise(exercise)
      var results: [[String: Any]] = []

      var timeSeconds = 0.0
      while timeSeconds <= duration {
        let cmTime = CMTime(seconds: timeSeconds, preferredTimescale: 600)
        if let cgImage = try? generator.copyCGImage(at: cmTime, actualTime: nil) {
          let uiImage = UIImage(cgImage: cgImage)
          if let poseResult = quickPose.process(image: uiImage, features: features) {
            results.append(self.buildFrameMap(timestamp: timeSeconds, result: poseResult))
          }
        }
        timeSeconds += self.frameIntervalSeconds
      }

      resolve(results)
    }
  }

  private func featuresForExercise(_ exercise: String) -> [QuickPoseFeature] {
    switch exercise {
    case "Push Up":
      return [
        .measureAngle(.elbowLeft),
        .measureAngle(.elbowRight),
        .measureAngle(.shoulderLeft),
        .measureAngle(.shoulderRight),
        .measureAngle(.hipLeft)
      ]
    case "Mountain Climber":
      return [
        .measureAngle(.hipLeft),
        .measureAngle(.hipRight),
        .measureAngle(.kneeLeft),
        .measureAngle(.kneeRight)
      ]
    default:
      return [
        .measureAngle(.elbowLeft),
        .measureAngle(.kneeLeft),
        .measureAngle(.hipLeft),
        .measureAngle(.shoulderLeft)
      ]
    }
  }

  private func buildFrameMap(timestamp: Double, result: QuickPoseResult) -> [String: Any] {
    var angles: [String: Double] = [:]

    // Adjust key names to match the actual QuickPoseResult API
    if let v = result.angle(for: .measureAngle(.elbowLeft))   { angles["elbowLeft"]    = v }
    if let v = result.angle(for: .measureAngle(.elbowRight))  { angles["elbowRight"]   = v }
    if let v = result.angle(for: .measureAngle(.kneeLeft))    { angles["kneeLeft"]     = v }
    if let v = result.angle(for: .measureAngle(.kneeRight))   { angles["kneeRight"]    = v }
    if let v = result.angle(for: .measureAngle(.hipLeft))     { angles["hipLeft"]      = v }
    if let v = result.angle(for: .measureAngle(.hipRight))    { angles["hipRight"]     = v }
    if let v = result.angle(for: .measureAngle(.shoulderLeft)){ angles["shoulderLeft"] = v }
    if let v = result.angle(for: .measureAngle(.shoulderRight)){angles["shoulderRight"]= v }

    return ["timestamp": timestamp, "angles": angles]
  }

  @objc
  static func requiresMainQueueSetup() -> Bool { false }
}
