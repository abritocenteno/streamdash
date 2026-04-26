import { requireNativeModule } from "expo-modules-core";

export type GpsSample = {
  t: number;     // seconds since recording start
  speed: number; // km/h integer
  lat: number;
  lng: number;
};

const VideoHudNative = requireNativeModule("VideoHud");

/**
 * Burns GPS HUD overlay into a video file using Android MediaCodec + OpenGL ES.
 * Returns the output path on success.
 */
export async function burnHud(
  srcPath: string,
  dstPath: string,
  samples: GpsSample[]
): Promise<void> {
  return VideoHudNative.burnHud(srcPath, dstPath, samples);
}
