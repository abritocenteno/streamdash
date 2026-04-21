import { useEffect, useRef, useState, useCallback } from "react";
import * as Location from "expo-location";
import { StreamConfig } from "@/constants/theme";

export interface GPSPoint {
  lat: number;
  lng: number;
  speed: number; // m/s
  ts: number;
}

interface UseGPSOptions {
  onUpdate?: (point: GPSPoint) => void;
  enabled?: boolean;
}

export function useGPS({ onUpdate, enabled = true }: UseGPSOptions = {}) {
  const [location, setLocation] = useState<GPSPoint | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const requestPermissions = useCallback(async () => {
    const { status: fgStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") {
      setError("Foreground location permission denied");
      return false;
    }
    const { status: bgStatus } =
      await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== "granted") {
      setError("Background location permission denied — GPS may pause when app is backgrounded");
    }
    setPermissionGranted(true);
    return true;
  }, []);

  const startWatching = useCallback(async () => {
    if (!permissionGranted) {
      const granted = await requestPermissions();
      if (!granted) return;
    }

    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: StreamConfig.GPS_POLL_MS,
        distanceInterval: 0,
      },
      (loc) => {
        const point: GPSPoint = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          speed: Math.max(0, loc.coords.speed ?? 0),
          ts: loc.timestamp,
        };
        setLocation(point);
        onUpdate?.(point);
      }
    );
  }, [permissionGranted, onUpdate, requestPermissions]);

  const stopWatching = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  // Auto-start/stop based on enabled flag
  useEffect(() => {
    if (enabled) {
      startWatching();
    } else {
      stopWatching();
    }
    return () => stopWatching();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    location,
    permissionGranted,
    error,
    requestPermissions,
    startWatching,
    stopWatching,
  };
}
