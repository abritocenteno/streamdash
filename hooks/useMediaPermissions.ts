import { useEffect, useState } from "react";
import { Camera } from "react-native-vision-camera";

export type MediaPermissionStatus = "checking" | "granted" | "denied";

export function useMediaPermissions(): MediaPermissionStatus {
  const [status, setStatus] = useState<MediaPermissionStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    async function request() {
      const cam = await Camera.requestCameraPermission();
      const mic = await Camera.requestMicrophonePermission();
      if (!cancelled) {
        setStatus(cam === "granted" && mic === "granted" ? "granted" : "denied");
      }
    }
    request();
    return () => { cancelled = true; };
  }, []);

  return status;
}
