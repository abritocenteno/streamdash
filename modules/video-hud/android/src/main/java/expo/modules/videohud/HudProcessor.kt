package expo.modules.videohud

import android.graphics.*
import android.media.*
import android.media.MediaCodecInfo.CodecCapabilities
import android.opengl.*
import android.opengl.Matrix
import android.view.Surface
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit

internal class HudProcessor {

  data class GpsSample(
    val tSec: Double,
    val speedKph: Int,
    val lat: Double,
    val lng: Double
  )

  // ── GL shader sources ───────────────────────────────────────────────────────

  private val VERT_SRC = """
    attribute vec4 aPosition;
    attribute vec2 aTexCoord;
    varying vec2 vTexCoord;
    uniform mat4 uMVP;
    uniform mat4 uTexMatrix;
    void main() {
      gl_Position = uMVP * aPosition;
      vTexCoord = (uTexMatrix * vec4(aTexCoord, 0.0, 1.0)).xy;
    }
  """.trimIndent()

  // OES external texture — receives decoded video frames from SurfaceTexture
  private val FRAG_VIDEO = """
    #extension GL_OES_EGL_image_external : require
    precision mediump float;
    varying vec2 vTexCoord;
    uniform samplerExternalOES sTexture;
    void main() {
      gl_FragColor = texture2D(sTexture, vTexCoord);
    }
  """.trimIndent()

  // Regular 2D texture — HUD overlay bitmap
  private val FRAG_HUD = """
    precision mediump float;
    varying vec2 vTexCoord;
    uniform sampler2D sTexture;
    void main() {
      gl_FragColor = texture2D(sTexture, vTexCoord);
    }
  """.trimIndent()

  // Full-screen quad: position (x,y) + texcoord (u,v) interleaved, 4 bytes per float
  // Vertices ordered for GL_TRIANGLE_STRIP
  private val QUAD = floatArrayOf(
    -1f, -1f,  0f, 0f,
     1f, -1f,  1f, 0f,
    -1f,  1f,  0f, 1f,
     1f,  1f,  1f, 1f,
  )

  // Pre-built flip-V matrix (maps UV v → 1-v) to correct Bitmap→GL orientation
  // Column-major: transforms (u,v,0,1) → (u, 1-v, 0, 1)
  private val FLIP_V = floatArrayOf(
    1f, 0f, 0f, 0f,
    0f, -1f, 0f, 0f,
    0f, 0f, 1f, 0f,
    0f, 1f, 0f, 1f
  )

  private val IDENTITY = FloatArray(16).also { Matrix.setIdentityM(it, 0) }

  private val TIMEOUT_US = 10_000L   // 10 ms per dequeue attempt
  private val FRAME_TIMEOUT_S = 3L   // 3 s max wait for a decoded frame

  // ── Public entry point ──────────────────────────────────────────────────────

  fun process(srcPath: String, dstPath: String, samples: List<GpsSample>) {
    File(dstPath).delete()
    // Guard: throw after processing if the muxer wrote nothing (e.g. silent EGL failure)
    var muxWroteFrames = false

    // ── 1. Probe input ────────────────────────────────────────────────────────
    val extractor = MediaExtractor().apply { setDataSource(srcPath) }

    var videoTrack = -1; var videoFormat: MediaFormat? = null
    var audioTrack = -1; var audioFormat: MediaFormat? = null

    for (i in 0 until extractor.trackCount) {
      val fmt  = extractor.getTrackFormat(i)
      val mime = fmt.getString(MediaFormat.KEY_MIME) ?: continue
      when {
        mime.startsWith("video/") && videoTrack < 0 -> { videoTrack = i; videoFormat = fmt }
        mime.startsWith("audio/") && audioTrack < 0 -> { audioTrack = i; audioFormat = fmt }
      }
    }
    require(videoTrack >= 0 && videoFormat != null) { "No video track in $srcPath" }

    val width    = videoFormat!!.getInteger(MediaFormat.KEY_WIDTH)
    val height   = videoFormat.getInteger(MediaFormat.KEY_HEIGHT)
    val mime     = videoFormat.getString(MediaFormat.KEY_MIME)!!
    val rotation = if (videoFormat.containsKey(MediaFormat.KEY_ROTATION))
      videoFormat.getInteger(MediaFormat.KEY_ROTATION) else 0

    // ── 2. Create encoder + EGL surface ──────────────────────────────────────
    val encFmt = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, 8_000_000)
      setInteger(MediaFormat.KEY_FRAME_RATE, 30)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }
    val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    encoder.configure(encFmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    val encoderSurface = encoder.createInputSurface()
    encoder.start()

    // ── 3. EGL + GL setup ─────────────────────────────────────────────────────
    val egl = EglCore()
    egl.setup(encoderSurface)
    egl.makeCurrent()

    val videoProg = buildProgram(VERT_SRC, FRAG_VIDEO)
    val hudProg   = buildProgram(VERT_SRC, FRAG_HUD)
    val vbo       = buildVbo()

    // OES texture for decoded frames
    val oesTex = IntArray(1).also { GLES20.glGenTextures(1, it, 0) }
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, oesTex[0])
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)

    // 2D texture for HUD bitmap
    val hudTex = IntArray(1).also { GLES20.glGenTextures(1, it, 0) }
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, hudTex[0])
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)

    val stMatrix      = FloatArray(16).also { Matrix.setIdentityM(it, 0) }
    val frameReady    = Semaphore(0)
    val surfaceTex    = SurfaceTexture(oesTex[0]).apply {
      setOnFrameAvailableListener { frameReady.release() }
    }
    val decoderSurface = Surface(surfaceTex)

    // ── 4. Decoder ────────────────────────────────────────────────────────────
    val decoder = MediaCodec.createDecoderByType(mime)
    decoder.configure(videoFormat, decoderSurface, null, 0)
    decoder.start()

    // ── 5. Muxer ─────────────────────────────────────────────────────────────
    val muxer = MediaMuxer(dstPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    muxer.setOrientationHint(rotation)
    // Add audio track first so we know its index; video track added once encoder emits FORMAT_CHANGED
    val muxAudioTrack = audioFormat?.let { muxer.addTrack(it) } ?: -1

    var muxVideoTrack = -1
    var muxStarted    = false

    // ── 6. Main encode loop ───────────────────────────────────────────────────
    extractor.selectTrack(videoTrack)

    var sampleIdx     = 0
    var lastSampleIdx = -1
    var inputDone     = false
    var outputDone    = false
    val info          = MediaCodec.BufferInfo()

    while (!outputDone) {
      // Feed compressed video into decoder
      if (!inputDone) {
        val ibIdx = decoder.dequeueInputBuffer(TIMEOUT_US)
        if (ibIdx >= 0) {
          val buf  = decoder.getInputBuffer(ibIdx)!!
          val size = extractor.readSampleData(buf, 0)
          if (size < 0) {
            decoder.queueInputBuffer(ibIdx, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            inputDone = true
          } else {
            decoder.queueInputBuffer(ibIdx, 0, size, extractor.sampleTime, 0)
            extractor.advance()
          }
        }
      }

      // Drain decoder → render to SurfaceTexture → GL → encoder
      val obIdx = decoder.dequeueOutputBuffer(info, TIMEOUT_US)
      when {
        obIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> { /* nothing */ }
        obIdx < 0 -> { /* not ready yet */ }
        else -> {
          val render = info.size > 0
          val ptsUs  = info.presentationTimeUs
          decoder.releaseOutputBuffer(obIdx, render)

          if (render) {
            if (!frameReady.tryAcquire(FRAME_TIMEOUT_S, TimeUnit.SECONDS))
              throw RuntimeException("Timeout waiting for decoded frame at pts=$ptsUs")

            surfaceTex.updateTexImage()
            surfaceTex.getTransformMatrix(stMatrix)

            // Advance GPS sample pointer
            val ptsSec = ptsUs / 1_000_000.0
            while (sampleIdx < samples.size - 1 && samples[sampleIdx + 1].tSec <= ptsSec) sampleIdx++

            // Re-upload HUD texture only when GPS sample changes
            if (sampleIdx != lastSampleIdx) {
              val s = if (samples.isNotEmpty()) samples[sampleIdx] else null
              uploadHud(hudTex[0], width, height, s)
              lastSampleIdx = sampleIdx
            }

            // Render: video + HUD
            GLES20.glViewport(0, 0, width, height)
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)

            drawOes(videoProg, vbo, oesTex[0], stMatrix, IDENTITY)

            GLES20.glEnable(GLES20.GL_BLEND)
            GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA)
            draw2D(hudProg, vbo, hudTex[0], FLIP_V, IDENTITY)
            GLES20.glDisable(GLES20.GL_BLEND)

            egl.setPresentationTime(ptsUs * 1_000L)  // µs → ns
            egl.swapBuffers()
          }

          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
            encoder.signalEndOfInputStream()
          }
        }
      }

      // Drain encoder → muxer (inner loop to keep encoder from stalling)
      var draining = true
      while (draining) {
        val eIdx = encoder.dequeueOutputBuffer(info, 0)
        when {
          eIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            muxVideoTrack = muxer.addTrack(encoder.outputFormat)
            muxer.start()
            muxStarted = true
          }
          eIdx < 0 -> draining = false
          else -> {
            if (muxStarted && info.size > 0) {
              val buf = encoder.getOutputBuffer(eIdx)!!
              buf.position(info.offset); buf.limit(info.offset + info.size)
              muxer.writeSampleData(muxVideoTrack, buf, info)
              muxWroteFrames = true
            }
            encoder.releaseOutputBuffer(eIdx, false)
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
              outputDone = true; draining = false
            }
          }
        }
      }
    }

    // ── 7. Audio passthrough ──────────────────────────────────────────────────
    if (audioTrack >= 0 && muxStarted) {
      extractor.unselectTrack(videoTrack)
      extractor.selectTrack(audioTrack)
      extractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC)

      val audioBuf  = ByteBuffer.allocate(512 * 1024)
      val audioInfo = MediaCodec.BufferInfo()
      while (true) {
        audioBuf.clear()
        val size = extractor.readSampleData(audioBuf, 0)
        if (size < 0) break
        audioInfo.set(0, size, extractor.sampleTime, extractor.sampleFlags)
        muxer.writeSampleData(muxAudioTrack, audioBuf, audioInfo)
        extractor.advance()
      }
    }

    // ── 8. Cleanup ────────────────────────────────────────────────────────────
    if (muxStarted) { muxer.stop() }
    muxer.release()

    decoder.stop(); decoder.release()
    encoder.stop(); encoder.release()
    surfaceTex.release()
    decoderSurface.release()
    encoderSurface.release()
    egl.release()
    extractor.release()

    GLES20.glDeleteTextures(1, oesTex, 0)
    GLES20.glDeleteTextures(1, hudTex, 0)
    GLES20.glDeleteProgram(videoProg)
    GLES20.glDeleteProgram(hudProg)
    GLES20.glDeleteBuffers(1, intArrayOf(vbo), 0)

    hudBitmap?.recycle(); hudBitmap = null

    check(muxWroteFrames) { "HUD processor produced 0 encoded frames — EGL/GL pipeline likely failed" }
  }

  // ── HUD bitmap upload ───────────────────────────────────────────────────────
  // Reuse a single bitmap to avoid per-frame allocations at high resolutions.
  private var hudBitmap: Bitmap? = null

  private fun uploadHud(texId: Int, width: Int, height: Int, s: GpsSample?) {
    val bmp = hudBitmap?.takeIf { it.width == width && it.height == height }
      ?: Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also { hudBitmap = it }
    bmp.eraseColor(Color.TRANSPARENT)
    val canvas = Canvas(bmp)

    if (s != null) {
      // Speed (bottom-left) ─────────────────────────────────────────────────
      val speedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color     = Color.parseColor("#00E5FF")
        textSize  = width * 0.042f
        typeface  = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
        setShadowLayer(6f, 2f, 2f, Color.BLACK)
      }
      val unitPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color    = Color.parseColor("#66C8E0")
        textSize = width * 0.016f
        typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
        setShadowLayer(4f, 1f, 1f, Color.BLACK)
      }

      val speedStr  = "${s.speedKph}"
      val speedX    = width * 0.024f
      val speedY    = height * 0.945f
      canvas.drawText(speedStr, speedX, speedY, speedPaint)

      val bounds = Rect()
      speedPaint.getTextBounds(speedStr, 0, speedStr.length, bounds)
      val unitY = speedY - bounds.height() - width * 0.006f
      canvas.drawText("KMH", speedX, unitY, unitPaint)

      // Coords (bottom-right) ───────────────────────────────────────────────
      val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color     = Color.parseColor("#00E5FF")
        textSize  = width * 0.013f
        typeface  = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
        textAlign = Paint.Align.RIGHT
        setShadowLayer(4f, 1f, 1f, Color.BLACK)
      }
      val valPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color     = Color.parseColor("#E8E2E2")
        textSize  = width * 0.018f
        textAlign = Paint.Align.RIGHT
        setShadowLayer(4f, 1f, 1f, Color.BLACK)
      }

      val rightX = width * 0.976f
      val gap    = width * 0.022f
      val base   = height * 0.945f

      // Draw from bottom up: LNG value → LNG label → LAT value → LAT label
      canvas.drawText("%.5f".format(s.lng), rightX, base,          valPaint)
      canvas.drawText("LNG",                 rightX, base - gap,    labelPaint)
      canvas.drawText("%.5f".format(s.lat), rightX, base - gap * 2, valPaint)
      canvas.drawText("LAT",                 rightX, base - gap * 3, labelPaint)
    }

    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texId)
    GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bmp, 0)
  }

  // ── GL draw calls ───────────────────────────────────────────────────────────

  private fun drawOes(prog: Int, vbo: Int, texId: Int, stMat: FloatArray, mvp: FloatArray) {
    GLES20.glUseProgram(prog)
    GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, vbo)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, texId)
    bindQuadAttribs(prog)
    GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(prog, "uMVP"),       1, false, mvp,   0)
    GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(prog, "uTexMatrix"), 1, false, stMat, 0)
    GLES20.glUniform1i(GLES20.glGetUniformLocation(prog, "sTexture"), 0)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
  }

  private fun draw2D(prog: Int, vbo: Int, texId: Int, texMat: FloatArray, mvp: FloatArray) {
    GLES20.glUseProgram(prog)
    GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, vbo)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texId)
    bindQuadAttribs(prog)
    GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(prog, "uMVP"),       1, false, mvp,    0)
    GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(prog, "uTexMatrix"), 1, false, texMat, 0)
    GLES20.glUniform1i(GLES20.glGetUniformLocation(prog, "sTexture"), 0)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
  }

  // Stride = 4 floats × 4 bytes = 16. aPosition at offset 0, aTexCoord at offset 8.
  private fun bindQuadAttribs(prog: Int) {
    val aPos = GLES20.glGetAttribLocation(prog, "aPosition")
    val aTex = GLES20.glGetAttribLocation(prog, "aTexCoord")
    GLES20.glEnableVertexAttribArray(aPos)
    GLES20.glEnableVertexAttribArray(aTex)
    GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 16, 0)
    GLES20.glVertexAttribPointer(aTex, 2, GLES20.GL_FLOAT, false, 16, 8)
  }

  // ── GL helpers ──────────────────────────────────────────────────────────────

  private fun buildProgram(vertSrc: String, fragSrc: String): Int {
    fun compile(type: Int, src: String): Int {
      val id = GLES20.glCreateShader(type)
      GLES20.glShaderSource(id, src)
      GLES20.glCompileShader(id)
      return id
    }
    val prog = GLES20.glCreateProgram()
    GLES20.glAttachShader(prog, compile(GLES20.GL_VERTEX_SHADER,   vertSrc))
    GLES20.glAttachShader(prog, compile(GLES20.GL_FRAGMENT_SHADER, fragSrc))
    GLES20.glLinkProgram(prog)
    return prog
  }

  private fun buildVbo(): Int {
    val id  = IntArray(1).also { GLES20.glGenBuffers(1, it, 0) }[0]
    val buf = ByteBuffer.allocateDirect(QUAD.size * 4)
      .order(ByteOrder.nativeOrder()).asFloatBuffer()
      .also { it.put(QUAD); it.position(0) }
    GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, id)
    GLES20.glBufferData(GLES20.GL_ARRAY_BUFFER, QUAD.size * 4, buf, GLES20.GL_STATIC_DRAW)
    return id
  }
}
