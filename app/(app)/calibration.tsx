import React, { useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Typography, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

// ─── Precision slider ───────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;         // 0–1
  displayValue: string;
  trackColor?: string;
  onChange: (v: number) => void;
}

function PrecisionSlider({ label, value, displayValue, trackColor, onChange }: SliderProps) {
  const TRACK_WIDTH = 150;
  const thumbX = useRef(new Animated.Value(value * TRACK_WIDTH)).current;
  const lastValue = useRef(value);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      thumbX.setOffset((thumbX as any)._value);
      thumbX.setValue(0);
    },
    onPanResponderMove: (_, gs) => {
      const next = Math.max(0, Math.min(TRACK_WIDTH, (thumbX as any)._offset + gs.dx));
      thumbX.setValue(next - (thumbX as any)._offset);
      lastValue.current = next / TRACK_WIDTH;
      onChange(lastValue.current);
    },
    onPanResponderRelease: () => {
      thumbX.flattenOffset();
    },
  });

  const fillWidth = thumbX.interpolate({
    inputRange: [0, TRACK_WIDTH],
    outputRange: [0, TRACK_WIDTH],
    extrapolate: "clamp",
  });

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.labelRow}>
        <Text style={sliderStyles.label}>{label}</Text>
        <Text style={[sliderStyles.value, { color: trackColor ?? Colors.tertiaryContainer }]}>
          {displayValue}
        </Text>
      </View>
      <View style={[sliderStyles.track, { width: TRACK_WIDTH }]}>
        {/* Filled portion */}
        <Animated.View
          style={[
            sliderStyles.fill,
            {
              width: fillWidth,
              backgroundColor: trackColor ?? Colors.tertiaryContainer,
            },
          ]}
        />
        {/* Thumb */}
        <Animated.View
          style={[
            sliderStyles.thumb,
            {
              transform: [{ translateX: thumbX }],
              borderColor: trackColor ?? Colors.tertiaryContainer,
            },
          ]}
          {...panResponder.panHandlers}
        />
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
  },
  value: {
    fontFamily: Typography.headline,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceContainerHighest,
    position: "relative",
  },
  fill: {
    position: "absolute",
    height: 4,
    borderRadius: 2,
    left: 0,
    top: 0,
  },
  thumb: {
    position: "absolute",
    top: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surfaceContainerHighest,
    borderWidth: 2,
    marginLeft: -10,
    shadowColor: Colors.tertiaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────

export default function CalibrationScreen() {
  const router = useRouter();

  const [gain, setGain]       = useState(0.62);  // Sensor Gain  → +12.4 dB range
  const [iso, setIso]         = useState(0.50);  // Digital ISO  → 3200
  const [shadow, setShadow]   = useState(0.42);  // Shadow Recovery → 42%
  const [noise, setNoise]     = useState(0.70);  // Noise Reduction → 7/10
  const [optimizing, setOptimizing] = useState(false);

  const gainDb    = ((gain * 20) - 10).toFixed(1);
  const isoValue  = Math.round(iso * 6400);
  const shadowPct = Math.round(shadow * 100);
  const noiseVal  = (noise * 10).toFixed(0);

  const handleAutoOptimize = () => {
    setOptimizing(true);
    // Simulate optimization
    setTimeout(() => {
      setGain(0.72);
      setIso(0.40);
      setShadow(0.55);
      setNoise(0.60);
      setOptimizing(false);
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.inner} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Night Mode</Text>
            <Text style={styles.subtitle}>SENSOR CALIBRATION</Text>
          </View>
          <TouchableOpacity style={styles.backBtn}>
            <Ionicons name="refresh-outline" size={18} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* Split-screen preview */}
        <View style={styles.preview}>
          {/* Left: Source RAW */}
          <View style={[styles.previewHalf, styles.previewLeft]}>
            <View style={styles.previewFeedDim}>
              <Ionicons name="videocam" size={28} color={Colors.outlineVariant} />
            </View>
            <View style={styles.previewLabel}>
              <Text style={styles.previewLabelText}>SOURCE_RAW</Text>
            </View>
          </View>

          {/* Divider line */}
          <View style={styles.previewDivider} />

          {/* Right: Processed NV */}
          <View style={[styles.previewHalf, styles.previewRight]}>
            <View style={styles.previewFeedBright}>
              <Ionicons name="videocam" size={28} color={Colors.tertiaryContainer} />
            </View>
            <View style={[styles.previewLabel, styles.previewLabelRight]}>
              <Text style={[styles.previewLabelText, { color: Colors.tertiaryContainer }]}>
                PROC_NV_HUD
              </Text>
            </View>
            {/* HUD overlay on processed side */}
            <View style={styles.previewHud}>
              <Text style={styles.previewHudSpeed}>75 KM/H</Text>
              <Text style={styles.previewHudCoords}>37.7749° N</Text>
            </View>
          </View>

          {/* Scanning line effect */}
          <View style={styles.scanLine} />

          {/* Live indicator */}
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTagText}>LIVE PREVIEW</Text>
          </View>
        </View>

        {/* Controls panel */}
        <View style={styles.controls}>
          <Text style={styles.controlsTitle}>PRECISION CONTROLS</Text>

          <View style={styles.slidersGrid}>
            <PrecisionSlider
              label="Sensor Gain"
              value={gain}
              displayValue={`${gainDb} dB`}
              trackColor={Colors.tertiaryContainer}
              onChange={setGain}
            />
            <PrecisionSlider
              label="Digital ISO"
              value={iso}
              displayValue={String(isoValue)}
              trackColor={Colors.secondary}
              onChange={setIso}
            />
            <PrecisionSlider
              label="Shadow Recovery"
              value={shadow}
              displayValue={`${shadowPct}%`}
              trackColor={Colors.tertiaryFixedDim}
              onChange={setShadow}
            />
            <PrecisionSlider
              label="Noise Reduction"
              value={noise}
              displayValue={`${noiseVal}/10`}
              trackColor={Colors.onSurfaceVariant}
              onChange={setNoise}
            />
          </View>

          {/* Auto-optimize */}
          <TouchableOpacity
            style={styles.autoOptWrapper}
            onPress={handleAutoOptimize}
            disabled={optimizing}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.electricCyanDim, "rgba(0,229,255,0.22)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.autoOptBtn, optimizing && { opacity: 0.6 }]}
            >
              <Ionicons
                name={optimizing ? "sync-outline" : "flash-outline"}
                size={16}
                color={Colors.tertiaryContainer}
              />
              <Text style={styles.autoOptText}>
                {optimizing ? "OPTIMIZING…" : "AUTO-OPTIMIZE"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity
            style={styles.saveWrapper}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>SAVE PROFILE</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerLow,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 2.5,
    textAlign: "center",
    marginTop: 2,
  },
  // ── Split preview
  preview: {
    height: 200,
    flexDirection: "row",
    backgroundColor: Colors.surfaceContainerLowest,
    position: "relative",
    overflow: "hidden",
  },
  previewHalf: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  previewLeft: {
    backgroundColor: Colors.surfaceContainerLowest,
  },
  previewRight: {
    backgroundColor: Colors.surfaceContainer,
  },
  previewFeedDim: {
    opacity: 0.3,
  },
  previewFeedBright: {
    opacity: 1,
  },
  previewDivider: {
    width: 1.5,
    backgroundColor: Colors.tertiaryContainer,
    opacity: 0.5,
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    zIndex: 10,
  },
  previewLabel: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: Colors.glassBg,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  previewLabelRight: {
    left: undefined,
    right: 8,
  },
  previewLabelText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 8,
    letterSpacing: 1.5,
  },
  previewHud: {
    position: "absolute",
    bottom: 10,
    left: 8,
    gap: 2,
  },
  previewHudSpeed: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  previewHudCoords: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.headlineRegular,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  scanLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    left: "50%",
    backgroundColor: Colors.tertiaryContainer,
    opacity: 0.8,
    zIndex: 11,
  },
  liveTag: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    zIndex: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.tertiaryContainer,
  },
  liveTagText: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 2,
  },
  // ── Controls panel
  controls: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 18,
  },
  controlsTitle: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2.5,
  },
  slidersGrid: {
    gap: 20,
  },
  autoOptWrapper: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
  },
  autoOptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: Radius.lg,
  },
  autoOptText: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
  saveWrapper: {
    borderRadius: Radius.full,
    overflow: "hidden",
    shadowColor: Colors.inversePrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  saveBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: Radius.full,
  },
  saveBtnText: {
    color: Colors.primaryFixed,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
