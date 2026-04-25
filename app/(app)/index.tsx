import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
} from "react-native-vision-camera";
import * as MediaLibrary from "expo-media-library";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { StreamView, StreamViewRef, StreamStatus } from "@/components/StreamView";
import { HUDOverlay } from "@/components/HUDOverlay";
import { MiniMap } from "@/components/MiniMap";
import { useGPS, GPSPoint } from "@/hooks/useGPS";
import { useMediaPermissions } from "@/hooks/useMediaPermissions";
import { useStreamTimer } from "@/hooks/useStreamTimer";
import { useOrientation } from "@/hooks/useOrientation";
import { Colors, Typography, Radius, StreamPlatforms, StreamPlatform } from "@/constants/theme";
import { FontAwesome5 } from "@expo/vector-icons";
import { LandscapeHUD } from "@/components/LandscapeHUD";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useCameraState } from "@/contexts/CameraContext";

type CameraMode = "record" | "live";

// ─── Permission gate ────────────────────────────────────────────────────────

function PermissionScreen({ status }: { status: "checking" | "denied" }) {
  if (status === "checking") {
    return (
      <View style={styles.permScreen}>
        <ActivityIndicator color={Colors.tertiaryContainer} size="large" />
        <Text style={styles.permTitle}>Checking permissions…</Text>
      </View>
    );
  }
  return (
    <View style={styles.permScreen}>
      <FontAwesome5 name="camera" size={40} color={Colors.outline} solid />
      <Text style={styles.permTitle}>Camera access needed</Text>
      <Text style={styles.permBody}>
        StreamDash needs camera and microphone access to stream live video.
        Please allow both in your device settings.
      </Text>
      <TouchableOpacity
        style={styles.permButtonWrapper}
        onPress={() => Linking.openSettings()}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.permButton}
        >
          <Text style={styles.permButtonText}>OPEN SETTINGS</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Error boundary ─────────────────────────────────────────────────────────

class CameraErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ color: "#FF4444", fontWeight: "700", fontSize: 14, marginBottom: 12 }}>
            Camera Error
          </Text>
          <Text style={{ color: "#E2E2E8", fontSize: 12, textAlign: "center", fontFamily: "monospace" }}>
            {this.state.error.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function DashcamScreen() {
  const permissions = useMediaPermissions();

  if (permissions !== "granted") {
    return <PermissionScreen status={permissions} />;
  }

  return (
    <CameraErrorBoundary>
      <DashcamView />
    </CameraErrorBoundary>
  );
}

// ─── Camera view ────────────────────────────────────────────────────────────

function DashcamView() {
  const router = useRouter();
  const orientation = useOrientation();

  const [mode, setMode] = useState<CameraMode>("record");
  // "vision" = VisionCamera preview/recording; "stream" = NodePublisher RTMP
  const [activeCamera, setActiveCamera] = useState<"vision" | "stream">("vision");
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [gpsTrail, setGpsTrail] = useState<GPSPoint[]>([]);
  const [pendingStreamKey, setPendingStreamKey] = useState<string | null>(null);

  // Track screen focus so VisionCamera pauses when switching tabs (safe to do
  // since setting isActive=false while recording keeps the recording going)
  const [isFocused, setIsFocused] = useState(true);
  const isRecordingRef = useRef(false);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        // Keep camera active if a recording is in progress
        if (!isRecordingRef.current) setIsFocused(false);
      };
    }, [])
  );

  const cameraRef = useRef<Camera>(null);
  const streamRef = useRef<StreamViewRef>(null);

  // ── Camera device + 4K format ─────────────────────────────────────────────

  const settings = useQuery(api.queries.getUserSettings);
  const facing = (settings?.cameraFacing as "front" | "back") ?? "back";
  const device = useCameraDevice(facing);

  // Prefer 4K @ 30fps; VisionCamera falls back to nearest supported format
  const format = useCameraFormat(device, [
    { videoResolution: { width: 3840, height: 2160 } },
    { fps: 30 },
  ]);

  // ── Draggable MiniMap PiP ─────────────────────────────────────────────────

  const { width: screenW } = Dimensions.get("window");
  const MINIMAP_SIZE = 130;
  const miniMapPos = useRef(
    new Animated.ValueXY({ x: screenW - MINIMAP_SIZE - 16, y: 140 })
  ).current;
  const miniMapPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        miniMapPos.setOffset({
          x: (miniMapPos.x as any)._value,
          y: (miniMapPos.y as any)._value,
        });
        miniMapPos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: miniMapPos.x, dy: miniMapPos.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        miniMapPos.flattenOffset();
      },
    })
  ).current;

  const isLive = streamStatus === "live";
  const isConnecting = streamStatus === "connecting";
  const isStreaming = isLive || isConnecting;

  const { formatted: duration } = useStreamTimer(isLive);
  const startSession = useMutation(api.sessions.startSession);
  const endSession = useMutation(api.sessions.endSession);
  const updateGPS = useMutation(api.sessions.updateGPS);

  // ── GPS ───────────────────────────────────────────────────────────────────

  const { location } = useGPS({
    enabled: true,
    onUpdate: useCallback(
      async (point: GPSPoint) => {
        setGpsTrail((prev) => [...prev, point].slice(-20));
        if (sessionId) {
          await updateGPS({
            sessionId,
            lat: point.lat,
            lng: point.lng,
            speed: point.speed,
            ts: point.ts,
          });
        }
      },
      [sessionId, updateGPS]
    ),
  });

  // ── Keep screen awake + signal MiniCam to yield the camera ───────────────

  const { setIsCapturing } = useCameraState();

  useEffect(() => {
    const capturing = isRecording || isStreaming;
    setIsCapturing(capturing);
    if (capturing) {
      activateKeepAwakeAsync("dashcam");
    } else {
      deactivateKeepAwake("dashcam");
    }
  }, [isRecording, isStreaming, setIsCapturing]);

  // ── Record handlers ───────────────────────────────────────────────────────

  const handleStartRecord = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow media library access to save recordings.");
      return;
    }
    setIsRecording(true);
    cameraRef.current?.startRecording({
      videoCodec: "h264",
      onRecordingFinished: async (video) => {
        setIsRecording(false);
        try {
          const asset = await MediaLibrary.createAssetAsync(video.path);
          const album = await MediaLibrary.getAlbumAsync("StreamCam");
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
          } else {
            await MediaLibrary.createAlbumAsync("StreamCam", asset, true);
          }
        } catch (err) {
          console.error("[DashcamScreen] save error", err);
        }
      },
      onRecordingError: (error) => {
        console.error("[DashcamScreen] record error", error);
        setIsRecording(false);
      },
    });
  }, []);

  const handleStopRecord = useCallback(async () => {
    await cameraRef.current?.stopRecording();
  }, []);

  // ── Stream handlers ───────────────────────────────────────────────────────

  const handleGoLive = useCallback(async () => {
    const key = settings?.youtubeStreamKey;
    const platform = (settings?.streamPlatform as StreamPlatform) ?? "youtube";
    const platformLabel = StreamPlatforms[platform]?.label ?? "streaming";

    if (!key) {
      Alert.alert(
        "No Stream Key",
        `Add your ${platformLabel} stream key in Settings before going live.`,
        [{ text: "OK" }]
      );
      return;
    }

    try {
      const sid = await startSession({ resolution: settings?.resolution });
      setSessionId(sid);
      setGpsTrail([]);
      setPendingStreamKey(key);
      setActiveCamera("stream"); // hand camera to NodePublisher
    } catch (err) {
      console.error("[DashcamScreen] start error", err);
      Alert.alert("Error", "Failed to start stream. Please try again.");
    }
  }, [settings, startSession]);

  const handleStopStream = useCallback(async () => {
    streamRef.current?.stopStream();
    if (sessionId) {
      await endSession({ sessionId });
      setSessionId(null);
    }
    setStreamStatus("idle");
    setPendingStreamKey(null);
    setActiveCamera("vision"); // hand camera back to VisionCamera
  }, [sessionId, endSession]);

  // ── Landscape: Driving Mode HUD ───────────────────────────────────────────

  if (orientation === "landscape") {
    return (
      <LandscapeHUD
        isLive={isLive}
        isConnecting={isConnecting}
        duration={duration}
        location={location}
        gpsTrail={gpsTrail}
        streamRef={streamRef}
        settings={settings}
        onStartStream={handleGoLive}
        onStopStream={handleStopStream}
        onStatusChange={setStreamStatus}
      />
    );
  }

  // ── Portrait ──────────────────────────────────────────────────────────────

  // Camera is active when this screen is focused, or when recording (to keep
  // the recording alive even if the user briefly switches tabs)
  const cameraIsActive = activeCamera === "vision" && (isFocused || isRecording || isStreaming);

  return (
    <View style={styles.container}>
      {/* VisionCamera — preview + frame processor HUD burned into recordings */}
      {activeCamera === "vision" && device && (
        <Camera
          ref={cameraRef}
          device={device}
          format={format}
          isActive={cameraIsActive}
          video={true}
          audio={!isMuted}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* NodePublisher — only mounts when GO LIVE is pressed */}
      {activeCamera === "stream" && pendingStreamKey && (
        <StreamView
          ref={streamRef}
          resolution={settings?.resolution ?? "720p"}
          cameraFacing={facing}
          onStatusChange={setStreamStatus}
          autoStart={{ key: pendingStreamKey, platform: settings?.streamPlatform ?? "youtube" }}
        />
      )}

      {/* Status bar gradient — keeps time/battery readable over camera */}
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent"]}
        style={styles.statusBarScrim}
      />

      {/* HUD overlay — always visible; shows REC/LIVE badge and GPS data */}
      <HUDOverlay
        isLive={isLive}
        isRecording={isRecording}
        duration={duration}
        location={location}
      />

      {/* Draggable MiniMap PiP */}
      <Animated.View
        style={[styles.miniMapFloat, { left: miniMapPos.x, top: miniMapPos.y }]}
        {...miniMapPanResponder.panHandlers}
      >
        <MiniMap current={location} trail={gpsTrail} size={MINIMAP_SIZE} />
      </Animated.View>

      {/* Mic mute toggle */}
      <SafeAreaView style={styles.topControls} edges={["top"]}>
        <TouchableOpacity
          style={[styles.voiceBtn, isMuted && styles.voiceBtnMuted]}
          onPress={() => setIsMuted((m) => !m)}
          activeOpacity={0.8}
        >
          <FontAwesome5
            name={isMuted ? "microphone-slash" : "microphone"}
            size={16}
            color={isMuted ? Colors.error : Colors.tertiaryContainer}
            solid
          />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Mode toggle + action button */}
      <SafeAreaView style={styles.controlsWrapper} edges={["bottom"]}>
        {/* RECORD / GO LIVE toggle — hidden while streaming or recording */}
        {!isStreaming && !isRecording && (
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "record" && styles.modeBtnActiveRecord]}
              onPress={() => setMode("record")}
              activeOpacity={0.8}
            >
              <FontAwesome5
                name="circle"
                size={8}
                color={mode === "record" ? Colors.error : Colors.outline}
                solid
              />
              <Text style={[styles.modeBtnText, mode === "record" && styles.modeBtnTextRecord]}>
                RECORD
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "live" && styles.modeBtnActiveLive]}
              onPress={() => setMode("live")}
              activeOpacity={0.8}
            >
              <FontAwesome5
                name="broadcast-tower"
                size={8}
                color={mode === "live" ? Colors.tertiaryContainer : Colors.outline}
                solid
              />
              <Text style={[styles.modeBtnText, mode === "live" && styles.modeBtnTextLive]}>
                GO LIVE
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action button */}
        {mode === "record" ? (
          isRecording ? (
            <TouchableOpacity style={styles.recStopBtn} onPress={handleStopRecord} activeOpacity={0.85}>
              <View style={styles.stopSquare} />
              <Text style={styles.recStopText}>STOP REC</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.recStartBtn} onPress={handleStartRecord} activeOpacity={0.85}>
              <View style={styles.recDot} />
              <Text style={styles.recStartText}>REC</Text>
            </TouchableOpacity>
          )
        ) : (
          isConnecting ? (
            <View style={[styles.streamButton, styles.streamButtonConnecting]}>
              <ActivityIndicator color={Colors.onSurface} size="small" style={{ marginRight: 4 }} />
              <Text style={[styles.streamButtonText, { color: Colors.onSurface }]}>
                CONNECTING…
              </Text>
            </View>
          ) : isLive ? (
            <View style={styles.liveControls}>
              <TouchableOpacity
                style={styles.streamButtonWrapper}
                onPress={handleStopStream}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.streamButton}
                >
                  <View style={styles.stopSquare} />
                  <Text style={styles.streamButtonText}>STOP STREAM</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewerBtn}
                onPress={() => router.push("/(app)/viewer")}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="eye" size={18} color={Colors.tertiaryContainer} solid />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.streamButtonWrapper}
              onPress={handleGoLive}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.streamButton}
              >
                <FontAwesome5 name="broadcast-tower" size={12} color={Colors.primaryFixed} solid />
                <Text style={styles.streamButtonText}>GO LIVE</Text>
              </LinearGradient>
            </TouchableOpacity>
          )
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  statusBarScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    zIndex: 5,
  },
  miniMapFloat: {
    position: "absolute",
    zIndex: 10,
  },
  // ── Permission screen
  permScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 16,
  },
  permTitle: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  permBody: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  permButtonWrapper: {
    marginTop: 8,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  permButton: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: "center",
  },
  permButtonText: {
    color: Colors.primaryFixed,
    fontFamily: Typography.headline,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
  // ── Top controls
  topControls: {
    position: "absolute",
    top: 0,
    right: 16,
    alignItems: "flex-end",
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  voiceBtnMuted: {
    backgroundColor: Colors.recordRedDim,
    borderColor: Colors.error,
  },
  // ── Bottom controls
  controlsWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 12,
    paddingHorizontal: 24,
    gap: 12,
  },
  // ── Mode toggle
  modeToggle: {
    flexDirection: "row",
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  modeBtnActiveRecord: {
    backgroundColor: "rgba(191,0,43,0.18)",
  },
  modeBtnActiveLive: {
    backgroundColor: Colors.electricCyanDim,
  },
  modeBtnText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  modeBtnTextRecord: {
    color: Colors.error,
  },
  modeBtnTextLive: {
    color: Colors.tertiaryContainer,
  },
  // ── Record buttons
  recStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: Radius.full,
    backgroundColor: "rgba(191,0,43,0.2)",
    borderWidth: 1.5,
    borderColor: Colors.error,
    minWidth: 160,
    justifyContent: "center",
  },
  recStartText: {
    color: Colors.error,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
  },
  recStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.glassBg,
    borderWidth: 1.5,
    borderColor: Colors.outline,
    minWidth: 160,
    justifyContent: "center",
  },
  recStopText: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
  },
  // ── Stream buttons
  liveControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  streamButtonWrapper: {
    borderRadius: Radius.full,
    overflow: "hidden",
    minWidth: 200,
    shadowColor: Colors.inversePrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  streamButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: Radius.full,
    minWidth: 200,
  },
  streamButtonConnecting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: Radius.full,
    minWidth: 200,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  streamButtonText: {
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    color: Colors.primaryFixed,
  },
  viewerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  stopSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: Colors.primaryFixed,
  },
});
