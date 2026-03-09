import ExpoModulesCore

// QuickPoseCore and QuickPoseMP are added to the Xcode project via the
// `withQuickPose` Expo config plugin (plugins/withQuickPose.js).
#if canImport(QuickPoseCore)
import QuickPoseCore
#endif

public class QuickPosePostProcessorModule: Module {

  public func definition() -> ModuleDefinition {
    Name("QuickPosePostProcessor")

    // Progress events emitted while processing frames
    Events("onProgress")

    // processVideo(inputPath: String, sdkKey: String) -> { feedbacks, outputPath }
    AsyncFunction("processVideo") { [weak self] (inputPath: String, sdkKey: String, promise: Promise) in
      #if canImport(QuickPoseCore)
      DispatchQueue.global(qos: .userInitiated).async {
        let inputURL = URL(fileURLWithPath: inputPath)

        guard FileManager.default.fileExists(atPath: inputPath) else {
          promise.reject("FILE_NOT_FOUND", "Input video not found at path: \(inputPath)")
          return
        }

        let outputURL = FileManager.default.temporaryDirectory
          .appendingPathComponent(UUID().uuidString)
          .appendingPathExtension("mov")

        let pp = QuickPosePostProcessor(sdkKey: sdkKey)

        let request = QuickPosePostProcessor.Request(
          input: inputURL,
          output: outputURL,
          outputType: .mov
        )

        // Accumulate unique feedback messages across all frames
        var collectedFeedbacks: [String] = []
        var seenFeedbacks: Set<String> = []

        do {
          // Features can be customised – squatCounter is used here as a
          // representative fitness feature that triggers rich body feedback.
          // See QuickPose docs for the full feature list.
          try pp.process(
            features: [.fitness(.squatCounter)],
            isFrontCamera: true,
            request: request
          ) { [weak self] progress, _, _, _, feedbacks, _, _ in
            // Emit progress to JavaScript (0–100)
            self?.sendEvent("onProgress", ["progress": Int(progress)])

            for feedback in feedbacks {
              let text = Self.feedbackText(feedback)
              if !text.isEmpty && !seenFeedbacks.contains(text) {
                seenFeedbacks.insert(text)
                collectedFeedbacks.append(text)
              }
            }
          }

          promise.resolve([
            "feedbacks": collectedFeedbacks,
            "outputPath": outputURL.path,
          ])
        } catch {
          promise.reject("QUICKPOSE_ERROR", error.localizedDescription)
        }
      }
      #else
      promise.reject(
        "NOT_AVAILABLE",
        "QuickPoseCore is not linked. Run `expo prebuild` with the withQuickPose plugin enabled."
      )
      #endif
    }
  }

  // MARK: - Feedback → String

  #if canImport(QuickPoseCore)
  /// Converts a QuickPoseFeedback enum case into a human-readable string.
  ///
  /// QuickPoseFeedback cases and their associated types:
  ///   .body(feedback: BodyFeedback, isRequired: Bool)
  ///   .joint(action: ActionChange, joint: Body, direction: DirectionChange?, isRequired: Bool)
  ///   .group(action: ActionChange, group: Group, direction: DirectionChange?, isRequired: Bool)
  ///
  /// If the SDK exposes a `displayString` property directly on QuickPoseFeedback,
  /// you can replace the entire switch with: `return feedback.displayString`
  private static func feedbackText(_ feedback: QuickPoseFeedback) -> String {
    switch feedback {
    case .body(let bodyFeedback, _):
      // BodyFeedback is an enum – use .description if available, else .rawValue
      return bodyFeedback.description

    case .joint(let action, let joint, let direction, _):
      if let dir = direction {
        return "\(action.description) your \(joint.description) \(dir.description)"
      }
      return "\(action.description) your \(joint.description)"

    case .group(let action, let group, let direction, _):
      let groupName = group.description.lowercased()
      if let dir = direction {
        return "\(action.description) \(groupName) \(dir.description)"
      }
      return "\(action.description) \(groupName)"

    @unknown default:
      return ""
    }
  }
  #endif
}
