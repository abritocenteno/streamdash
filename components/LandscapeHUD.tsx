import React, { useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StreamView, StreamViewRef, StreamStatus } from "@/components/StreamView";
import { MiniMap } from "@/components/MiniMap";
import { GPSPoint } from "@/hooks/useGPS";
import { Colors, Typography } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

interface LandscapeHUDProps {
  isLive: boolean;
  isConnecting: boolean;
  duration: string;
  location: GPSPoint | null;
  gpsTrail: GPSPoint[];
  streamRef: React.RefObject<StreamViewRef>;
  settings: { resolution?: string; cameraFacing?: string } | null | undefined;
  onStartStream: () => void;
  onStopStream: () => void;
  onStatusChange: (status: StreamStatus) => void;
}

export function LandscapeHUD({
  isLive,
  isConnecting,
  duration,
  location,
  gpsTrail,
  streamRef,
  settings,
  onStartStream,
  onStopStream,
  onStatusChange,
}: LandscapeHUDProps) {
  const router = useRouter();
  const speedKph = location ? (location.speed * 3.6).toFixed(0) : "0";
  const lat = location ? location.lat.toFixed(4) : "0.0000";
  const lng = location ? location.lng.toFixed(4) : "0.0000";

  return (
    <View style={styles.container}>
      {/* Full-screen camera feed */}
      <StreamView
        ref={streamRef}
        resolution={settings?.resolution ?? "720p"}
        cameraFacing={(settings?.cameraFacing as "front" | "back") ?? "back"}
        onStatusChange={onStatusChange}
      />

      {/* Scanline overlay — cockpit texture */}
      <View style={styles.scanlineOverlay} pointerEvents="none" />

      {/* Top status bar */}
      <View style={styles.topBar}>
        <View style={styles.statusLeft}>
          {isLive && (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC</Text>
            </View>
          )}
          <View style={styles.signalBadge}>
            <Ionicons name="cellular-outline" size={12} color={Colors.tertiaryContainer} />
            <Text style={styles.signalText}>5G</Text>
          </View>
        </View>
        <Text style={styles.streetName}>Pacific Coast Hwy</Text>
        <View style={styles.statusRight}>
          <Ionicons name="battery-half-outline" size={16} color={Colors.outline} />
          <Text style={styles.batteryText}>82%</Text>
        </View>
      </View>

      {/* Left panel — Speed */}
      <View style={styles.speedPanel}>
        <Text style={styles.speedValue}>{speedKph}</Text>
        <Text style={styles.speedUnit}>MPH</Text>
        <View style={styles.coordsBlock}>
          <Text style={styles.coordLabel}>LAT</Text>
          <Text style={styles.coordValue}>{lat}</Text>
          <Text style={styles.coordLabel}>LNG</Text>
          <Text style={styles.coordValue}>{lng}</Text>
        </View>
      </View>

      {/* Right panel — MiniMap PiP */}
      <View style={styles.mapPanel}>
        <MiniMap current={location} trail={gpsTrail} />
        {isLive && (
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{duration}</Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {/* Voice command */}
        <TouchableOpacity
          style={styles.voiceBtn}
          onPress={() => router.push("/(app)/voice")}
          activeOpacity={0.8}
        >
          <Ionicons name="mic" size={20} color={Colors.tertiaryContainer} />
          <Text style={styles.voiceBtnText}>VOICE</Text>
        </TouchableOpacity>

        {/* Primary action — Record / Stop */}
        {isConnecting ? (
          <View style={[styles.actionBtn, styles.actionBtnConnecting]}>
            <Text style={styles.actionBtnText}>CONNECTING…</Text>
          </View>
        ) : isLive ? (
          <TouchableOpacity onPress={onStopStream} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtn}
            >
              <View style={styles.stopSquare} />
              <Text style={styles.actionBtnText}>STOP STREAM</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onStartStream} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtn}
            >
              <View style={styles.recDotLg} />
              <Text style={styles.actionBtnText}>GO LIVE</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* SOS */}
        <TouchableOpacity
          style={styles.sosBtn}
          onPress={() =>
            router.push("/(app)/voice")
          }
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.errorContainer, Colors.onPrimaryContainer]}
            style={styles.sosBtnInner}
          >
            <Text style={styles.sosBtnText}>SOS</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  scanlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Simulated scanline via opacity — actual scanlines would need a native module
    opacity: 0.03,
    backgroundColor: Colors.outline,
  },
  // ── Top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(12,14,18,0.7)",
  },
  statusLeft: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flex: 1,
  },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.recordRedDim,
    borderWidth: 1,
    borderColor: Colors.inversePrimary,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.inversePrimary,
  },
  recText: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headline,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  signalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.glassBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  signalText: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
  streetName: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    flex: 2,
    textAlign: "center",
  },
  statusRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    justifyContent: "flex-end",
  },
  batteryText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 11,
  },
  // ── Speed panel (left)
  speedPanel: {
    position: "absolute",
    left: 20,
    top: "25%",
    backgroundColor: Colors.glassBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: Colors.tertiaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
  speedValue: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 64,
    fontWeight: "700",
    lineHeight: 68,
  },
  speedUnit: {
    color: Colors.tertiaryFixedDim,
    fontFamily: Typography.headlineMedium,
    fontSize: 13,
    letterSpacing: 3,
    marginTop: -4,
  },
  coordsBlock: {
    marginTop: 12,
    alignItems: "center",
    gap: 2,
  },
  coordLabel: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 8,
    letterSpacing: 3,
  },
  coordValue: {
    color: Colors.onSurface,
    fontFamily: Typography.headlineRegular,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  // ── Map PiP (right)
  mapPanel: {
    position: "absolute",
    right: 20,
    top: "20%",
    alignItems: "center",
    gap: 8,
  },
  timerBadge: {
    backgroundColor: Colors.glassBg,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  timerText: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
  // ── Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: "rgba(12,14,18,0.7)",
  },
  voiceBtn: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.glassBg,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  voiceBtnText: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 9999,
    shadowColor: Colors.inversePrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  actionBtnConnecting: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 9999,
  },
  actionBtnText: {
    color: Colors.primaryFixed,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
  },
  recDotLg: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primaryFixed,
  },
  stopSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: Colors.primaryFixed,
  },
  sosBtn: {
    borderRadius: 9999,
    overflow: "hidden",
  },
  sosBtnInner: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  sosBtnText: {
    color: Colors.onErrorContainer,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 3,
  },
});
