import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useGPS } from "@/hooks/useGPS";
import { Colors, Typography, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

// ─── Waveform ───────────────────────────────────────────────────────────────

const BAR_COUNT = 24;

function Waveform({ active }: { active: boolean }) {
  // Create an array of animated values for each bar
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (!active) {
      // Collapse all bars
      Animated.parallel(
        bars.map((b) =>
          Animated.timing(b, { toValue: 0.2, duration: 300, useNativeDriver: true })
        )
      ).start();
      return;
    }

    // Animate bars to random heights with staggered loops
    const animations = bars.map((bar, i) => {
      const delay = (i * 40) % 300;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(bar, {
            toValue: 0.3 + Math.random() * 0.7,
            duration: 200 + Math.random() * 300,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.1 + Math.random() * 0.4,
            duration: 200 + Math.random() * 300,
            useNativeDriver: true,
          }),
        ])
      );
    });
    const parallel = Animated.parallel(animations);
    parallel.start();
    return () => parallel.stop();
  }, [active]);

  return (
    <View style={styles.waveform}>
      {bars.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              transform: [{ scaleY: anim }],
              backgroundColor:
                i % 3 === 0 ? Colors.tertiaryContainer : Colors.tertiaryFixedDim,
              shadowColor: Colors.tertiaryContainer,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 4,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Quick action chips ─────────────────────────────────────────────────────

interface ActionChip {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  action: () => void;
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function VoiceScreen() {
  const router = useRouter();
  const [listening, setListening] = useState(true);
  const [commandText, setCommandText] = useState("RECORDING 10 SECONDS");
  const [commandSub, setCommandSubText] = useState("Clip saved to gallery");

  const { location } = useGPS({ enabled: true });
  const speedKph = location ? (location.speed * 3.6).toFixed(0) : "0";
  const lat = location ? location.lat.toFixed(4) : "0.0000";
  const lng = location ? location.lng.toFixed(4) : "0.0000";

  // Pulse animation for the listening orb
  const orbPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!listening) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(orbPulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [listening]);

  const chips: ActionChip[] = [
    {
      label: "Save Clip",
      icon: "bookmark-outline",
      action: () => {
        setCommandText("SAVING CLIP");
        setCommandSubText("Last 30 seconds saved to gallery");
      },
    },
    {
      label: "Go Live",
      icon: "radio-outline",
      action: () => {
        router.back();
      },
    },
    {
      label: "Stop Audio",
      icon: "volume-mute-outline",
      action: () => {
        setCommandText("AUDIO MUTED");
        setCommandSubText("Microphone disabled");
      },
    },
    {
      label: "Show Map",
      icon: "map-outline",
      action: () => {
        router.push("/(app)/map");
      },
    },
  ];

  return (
    <View style={styles.container}>
      {/* Telemetry background — faded ambient text */}
      <View style={styles.telemetryBg} pointerEvents="none">
        <Text style={styles.bgText}>{lat}° N  {lng}° W</Text>
        <Text style={styles.bgText}>{speedKph} KM/H</Text>
        <Text style={styles.bgText}>ALT 242 FT</Text>
        <Text style={styles.bgText}>HEADING 284° WNW</Text>
      </View>

      <SafeAreaView style={styles.inner} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close-outline" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>VOICE COMMAND</Text>
          <TouchableOpacity style={styles.backBtn}>
            <Ionicons name="settings-outline" size={18} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* Main content */}
        <View style={styles.main}>
          {/* Listening indicator tag */}
          <View style={[styles.statusTag, listening && styles.statusTagActive]}>
            <View style={[styles.statusDot, listening && styles.statusDotActive]} />
            <Text style={[styles.statusText, listening && styles.statusTextActive]}>
              {listening ? "LISTENING" : "IDLE"}
            </Text>
          </View>

          {/* Voice orb */}
          <Animated.View
            style={[
              styles.orbOuter,
              { transform: [{ scale: orbPulse }] },
            ]}
          >
            <View style={styles.orbInner}>
              <Ionicons
                name="mic"
                size={36}
                color={listening ? Colors.tertiaryContainer : Colors.outline}
              />
            </View>
          </Animated.View>

          {/* Waveform */}
          <Waveform active={listening} />

          {/* Command text */}
          <View style={styles.commandBlock}>
            <Text style={styles.commandText}>{commandText}</Text>
            <Text style={styles.commandSub}>{commandSub}</Text>
          </View>
        </View>

        {/* Quick-action chips */}
        <View style={styles.chips}>
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip.label}
              style={styles.chip}
              onPress={chip.action}
              activeOpacity={0.8}
            >
              <Ionicons name={chip.icon} size={14} color={Colors.tertiaryContainer} />
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Toggle mic */}
        <TouchableOpacity
          style={[styles.micToggle, !listening && styles.micToggleOff]}
          onPress={() => setListening((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons
            name={listening ? "mic-off-outline" : "mic-outline"}
            size={20}
            color={listening ? Colors.inversePrimary : Colors.tertiaryContainer}
          />
          <Text style={[styles.micToggleText, !listening && { color: Colors.tertiaryContainer }]}>
            {listening ? "STOP LISTENING" : "START LISTENING"}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Ambient telemetry text in background
  telemetryBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    opacity: 0.04,
  },
  bgText: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 4,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: Colors.onSurface,
    fontFamily: Typography.headlineMedium,
    fontSize: 12,
    letterSpacing: 3,
  },
  main: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusTagActive: {
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.outline,
  },
  statusDotActive: {
    backgroundColor: Colors.tertiaryContainer,
  },
  statusText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2.5,
  },
  statusTextActive: {
    color: Colors.tertiaryContainer,
  },
  // Orb
  orbOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 2,
    borderColor: Colors.tertiaryContainer,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.tertiaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 8,
  },
  orbInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  // Waveform
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    gap: 3,
  },
  waveBar: {
    width: 3,
    height: 40,
    borderRadius: 2,
    transformOrigin: "center",
  },
  // Command
  commandBlock: {
    alignItems: "center",
    gap: 6,
  },
  commandText: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
  },
  commandSub: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 13,
    textAlign: "center",
  },
  // Chips
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    paddingBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  chipText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
  },
  // Mic toggle
  micToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.recordRedDim,
    borderRadius: Radius.full,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.inversePrimary,
    marginBottom: 8,
  },
  micToggleOff: {
    backgroundColor: Colors.electricCyanDim,
    borderColor: Colors.tertiaryContainer,
  },
  micToggleText: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headline,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
