import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
// react-native-nodemediaclient 0.3.x exports NodePublisher for streaming
// NodePublisher props: url, audioParam, videoParam, frontCamera,
//   videoOrientation, onEvent(code, msg), keyFrameInterval
// Methods (via ref): start(), stop(), startPreview(), stopPreview()
import { NodePublisher } from "react-native-nodemediaclient";
import { Colors, ResolutionPresets, buildStreamUrl } from "@/constants/theme";

export type StreamStatus =
  | "idle"
  | "connecting"
  | "live"
  | "disconnected"
  | "error";

export interface StreamViewRef {
  startStream: (streamKey: string, platform?: string) => Promise<void>;
  stopStream: () => void;
}

interface StreamViewProps {
  resolution?: string;
  cameraFacing?: "front" | "back";
  onStatusChange?: (status: StreamStatus) => void;
  autoStart?: { key: string; platform?: string };
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// NodeMedia status codes
const NMC_CODE_CONNECTED = 2000;
const NMC_CODE_DISCONNECTED = 2001;
const NMC_CODE_ERROR = 2002;

export const StreamView = forwardRef<StreamViewRef, StreamViewProps>(
  function StreamView(
    { resolution = "720p", cameraFacing = "back", onStatusChange, autoStart },
    ref
  ) {
    const publisherRef = useRef<NodePublisher>(null);
    const [status, setStatus] = useState<StreamStatus>("idle");
    // url state drives the native component's url prop
    const [streamUrl, setStreamUrl] = useState<string>("");
    const retryCountRef = useRef(0);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const streamKeyRef = useRef<string>("");
    const streamPlatformRef = useRef<string>("youtube");
    // Track status in a ref so the onEvent closure always sees current value
    const statusRef = useRef<StreamStatus>("idle");

    const updateStatus = useCallback(
      (s: StreamStatus) => {
        statusRef.current = s;
        setStatus(s);
        onStatusChange?.(s);
      },
      [onStatusChange]
    );

    const doStart = useCallback(
      (key: string) => {
        const url = buildStreamUrl(streamPlatformRef.current, key);
        setStreamUrl(url); // updates the native url prop
        // start() dispatches the native command to begin streaming
        publisherRef.current?.start();
        updateStatus("connecting");
      },
      [updateStatus]
    );

    const startStream = useCallback(
      async (streamKey: string, platform = "youtube") => {
        if (!streamKey.trim()) {
          Alert.alert(
            "Missing Stream Key",
            "Please add your stream key in Settings before going live."
          );
          return;
        }
        streamKeyRef.current = streamKey;
        streamPlatformRef.current = platform;
        retryCountRef.current = 0;
        doStart(streamKey);
      },
      [doStart]
    );

    const stopStream = useCallback(() => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      retryCountRef.current = MAX_RETRIES; // block auto-retry
      publisherRef.current?.stop();
      updateStatus("idle");
    }, [updateStatus]);

    useEffect(() => {
      if (autoStart) {
        const timer = setTimeout(() => {
          startStream(autoStart.key, autoStart.platform ?? "youtube");
        }, 150);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          publisherRef.current?.startPreview();
        }, 150);
        return () => {
          clearTimeout(timer);
          publisherRef.current?.stopPreview();
        };
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({ startStream, stopStream }), [
      startStream,
      stopStream,
    ]);

    const preset = ResolutionPresets[resolution] ?? ResolutionPresets["720p"];

    const audioParam = {
      codecid: 10,   // AAC
      bitrate: 96000,
      profile: 1,    // AAC-LC
      samplerate: 44100,
      channels: 2,
    };

    const videoParam = {
      codecid: 27,   // H.264
      profile: 66,   // Baseline (best compatibility for YouTube)
      width: preset.width,
      height: preset.height,
      fps: 30,
      bitrate: preset.bitrate,
    };

    const handleEvent = useCallback(
      (code: number, msg: string) => {
        console.log("[StreamView] event", code, msg);
        switch (code) {
          case NMC_CODE_CONNECTED:
            retryCountRef.current = 0;
            updateStatus("live");
            break;
          case NMC_CODE_DISCONNECTED:
            if (
              statusRef.current === "live" ||
              statusRef.current === "connecting"
            ) {
              if (retryCountRef.current < MAX_RETRIES) {
                retryCountRef.current += 1;
                updateStatus("connecting");
                retryTimerRef.current = setTimeout(() => {
                  doStart(streamKeyRef.current);
                }, RETRY_DELAY_MS);
              } else {
                updateStatus("error");
                Alert.alert(
                  "Stream Disconnected",
                  "Could not reconnect after multiple attempts. Check your stream key and internet connection.",
                  [{ text: "OK" }]
                );
              }
            }
            break;
          case NMC_CODE_ERROR:
            updateStatus("error");
            Alert.alert(
              "Stream Error",
              `An error occurred (${msg}). Please check your stream key and try again.`
            );
            break;
          default:
            break;
        }
      },
      [updateStatus, doStart]
    );

    return (
      <View style={styles.container}>
        <NodePublisher
          ref={publisherRef}
          style={StyleSheet.absoluteFill}
          url={streamUrl}
          audioParam={audioParam}
          videoParam={videoParam}
          frontCamera={cameraFacing === "front"}
          videoOrientation={1} // portrait
          keyFrameInterval={2}
          onEvent={handleEvent}
        />

        {status === "connecting" && (
          <View style={styles.connectingOverlay}>
            <ActivityIndicator color={Colors.neonGreen} size="small" />
            <Text style={styles.connectingText}>
              {retryCountRef.current > 0
                ? `Reconnecting… (${retryCountRef.current}/${MAX_RETRIES})`
                : "Connecting to YouTube…"}
            </Text>
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  connectingOverlay: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  connectingText: {
    color: Colors.white,
    fontFamily: "SpaceMono",
    fontSize: 13,
  },
});
