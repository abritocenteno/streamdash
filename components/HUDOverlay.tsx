import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Colors, Typography } from "@/constants/theme";
import { GPSPoint } from "@/hooks/useGPS";

interface HUDOverlayProps {
  isLive: boolean;
  duration: string;
  location: GPSPoint | null;
}

// ─── Live Badge ─────────────────────────────────────────────────────────────
// Per design: record states use onErrorContainer red with pulsing opacity 1.0→0.6

function LiveBadge({ isLive }: { isLive: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isLive) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isLive, pulseAnim]);

  if (isLive) {
    return (
      <Animated.View style={[styles.liveBadge, styles.liveBadgeActive, { opacity: pulseAnim }]}>
        <View style={styles.liveDot} />
        <Text style={styles.liveBadgeTextActive}>LIVE</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.liveBadge}>
      <Text style={styles.liveBadgeText}>OFFLINE</Text>
    </View>
  );
}

// ─── HUD Overlay ────────────────────────────────────────────────────────────

export function HUDOverlay({ isLive, duration, location }: HUDOverlayProps) {
  const speedKph = location ? (location.speed * 3.6).toFixed(0) : "0";
  const lat = location ? location.lat.toFixed(5) : "0.00000";
  const lng = location ? location.lng.toFixed(5) : "0.00000";

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Top row — Live badge + Timer */}
      <View style={styles.topRow}>
        <LiveBadge isLive={isLive} />
        {isLive && (
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{duration}</Text>
          </View>
        )}
      </View>

      {/* Bottom row — Speed | Coords */}
      <View style={styles.bottomRow}>
        <View style={styles.speedBlock}>
          <Text style={styles.speedValue}>{speedKph}</Text>
          <Text style={styles.speedUnit}>KM/H</Text>
        </View>

        <View style={styles.coordsBlock}>
          <Text style={styles.coordLabel}>LAT</Text>
          <Text style={styles.coordValue}>{lat}</Text>
          <Text style={styles.coordLabel}>LNG</Text>
          <Text style={styles.coordValue}>{lng}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 16,
  },

  // ── Top row
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  // Live badge — glass panel per design: surfaceBright @ 40% + blur (simulated)
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.glassBg,
    borderRadius: 4,  // sm radius for "LIVE" tags
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  liveBadgeActive: {
    backgroundColor: "rgba(191,0,43,0.25)",  // record red glass
    borderColor: "rgba(191,0,43,0.4)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inversePrimary,
  },
  liveBadgeText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  liveBadgeTextActive: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headline,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },

  // Timer badge — glass panel
  timerBadge: {
    backgroundColor: Colors.glassBg,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  timerText: {
    color: Colors.tertiaryContainer,  // electric cyan — data stream indicator
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  // ── Bottom row
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  // Speed — no container, floats directly on feed per design "No containers" rule
  // Ambient outer glow via shadow
  speedBlock: {
    alignItems: "center",
    // Ghost border fallback for legibility against complex video bg
    backgroundColor: Colors.glassBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: Colors.tertiaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  speedValue: {
    color: Colors.tertiaryContainer,  // electric cyan — critical data
    fontFamily: Typography.headline,
    fontSize: 40,
    fontWeight: "700",
    lineHeight: 44,
  },
  speedUnit: {
    color: Colors.tertiaryFixedDim,
    fontFamily: Typography.headlineMedium,
    fontSize: 11,
    letterSpacing: 2,
  },

  // Coords — HUD label style: all-caps, tracked out per design spec
  coordsBlock: {
    backgroundColor: Colors.glassBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "flex-end",
    minWidth: 100,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  coordLabel: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 3,  // tracked out per design spec for HUD coordinates
    textTransform: "uppercase",
  },
  coordValue: {
    color: Colors.onSurface,
    fontFamily: Typography.headlineRegular,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
});
