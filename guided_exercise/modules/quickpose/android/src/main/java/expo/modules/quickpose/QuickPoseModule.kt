package expo.modules.quickpose

import android.graphics.BitmapFactory
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import ai.quickpose.core.QuickPosePostProcessor

class QuickPoseModule : Module() {

  private var postProcessor: QuickPosePostProcessor? = null

  override fun definition() = ModuleDefinition {
    Name("QuickPose")

    AsyncFunction("initialize") {
      val context = appContext.reactContext
        ?: throw Exception("React context not available")
      postProcessor = QuickPosePostProcessor(context)
    }

    AsyncFunction("processFrame") { base64Image: String ->
      val processor = postProcessor
        ?: throw Exception("QuickPose not initialized. Call initialize() first.")
      val imageBytes = Base64.decode(base64Image, Base64.DEFAULT)
      val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
      processor.process(bitmap)
    }
  }
}
