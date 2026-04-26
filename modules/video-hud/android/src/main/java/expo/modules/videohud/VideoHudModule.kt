package expo.modules.videohud

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class VideoHudModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoHud")

    AsyncFunction("burnHud") { srcPath: String, dstPath: String, rawSamples: List<Map<String, Any>> ->
      val samples = rawSamples.map { m ->
        HudProcessor.GpsSample(
          tSec     = (m["t"]     as Number).toDouble(),
          speedKph = (m["speed"] as Number).toInt(),
          lat      = (m["lat"]   as Number).toDouble(),
          lng      = (m["lng"]   as Number).toDouble()
        )
      }
      withContext(Dispatchers.IO) {
        HudProcessor().process(srcPath, dstPath, samples)
      }
    }
  }
}
