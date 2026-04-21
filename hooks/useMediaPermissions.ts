import { useEffect, useState } from "react";
import { Camera } from "expo-camera";

export type MediaPermissionStatus = "checking" | "granted" | "denied";

/**
 * Requests camera + microphone permissions at runtime.
 * Returns "checking" until resolved, then "granted" or "denied".
 */
export function useMediaPermissions(): MediaPermissionStatus {
  const [status, setStatus] = useState<MediaPermissionStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    async function request() {
      const [cam, mic] = await Promise.all([
        Camera.requestCameraPermissionsAsync(),
        Camera.requestMicrophonePermissionsAsync(),
      ]);
      if (!cancelled) {
        setStatus(
          cam.status === "granted" && mic.status === "granted"
            ? "granted"
            : "denied"
        );
      }
    }
    request();
    return () => { cancelled = true; };
  }, []);

  return status;
}
