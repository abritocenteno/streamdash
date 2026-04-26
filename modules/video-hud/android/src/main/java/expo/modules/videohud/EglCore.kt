package expo.modules.videohud

import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.opengl.EGLContext
import android.opengl.EGLExt
import android.view.Surface

internal class EglCore {
  lateinit var display: EGLDisplay
    private set
  lateinit var surface: EGLSurface
    private set
  private lateinit var context: EGLContext

  fun setup(windowSurface: Surface) {
    display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
    EGL14.eglInitialize(display, null, 0, null, 0)

    val attribs = intArrayOf(
      EGL14.EGL_RED_SIZE,          8,
      EGL14.EGL_GREEN_SIZE,        8,
      EGL14.EGL_BLUE_SIZE,         8,
      EGL14.EGL_ALPHA_SIZE,        8,
      EGL14.EGL_RENDERABLE_TYPE,   EGL14.EGL_OPENGL_ES2_BIT,
      EGLExt.EGL_RECORDABLE_ANDROID, 1,   // required for MediaCodec encoder surface
      EGL14.EGL_NONE
    )
    val configs = arrayOfNulls<EGLConfig>(1)
    val numConfigs = IntArray(1)
    EGL14.eglChooseConfig(display, attribs, 0, configs, 0, 1, numConfigs, 0)
    val config = configs[0]!!

    val ctxAttribs = intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE)
    context = EGL14.eglCreateContext(display, config, EGL14.EGL_NO_CONTEXT, ctxAttribs, 0)

    val surfAttribs = intArrayOf(EGL14.EGL_NONE)
    surface = EGL14.eglCreateWindowSurface(display, config, windowSurface, surfAttribs, 0)
  }

  fun makeCurrent() {
    EGL14.eglMakeCurrent(display, surface, surface, context)
  }

  fun setPresentationTime(ptsNs: Long) {
    EGLExt.eglPresentationTimeANDROID(display, surface, ptsNs)
  }

  fun swapBuffers() {
    EGL14.eglSwapBuffers(display, surface)
  }

  fun release() {
    EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
    EGL14.eglDestroySurface(display, surface)
    EGL14.eglDestroyContext(display, context)
    EGL14.eglReleaseThread()
    EGL14.eglTerminate(display)
  }
}
