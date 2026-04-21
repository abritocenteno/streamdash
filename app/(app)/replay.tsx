import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import * as Sharing from "expo-sharing";
import { Colors, Typography, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatTs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Filmstrip ─────────────────────────────────────────────────────────────
// Represents the timeline as a row of thumbnail placeholders

const STRIP_FRAMES = 12;

function Filmstrip({
  totalMs,
  trimStart,
  trimEnd,
  onTrimChange,
}: {
  totalMs: number;
  trimStart: number;
  trimEnd: number;
  onTrimChange: (start: number, end: number) => void;
}) {
  return (
    <View style={filmStyles.container}>
      {/* Track */}
      <View style={filmStyles.track}>
        {/* Frames */}
        {Array.from({ length: STRIP_FRAMES }).map((_, i) => (
          <View key={i} style={filmStyles.frame}>
            <Ionicons name="film-outline" size={12} color={Colors.outlineVariant} />
          </View>
        ))}
        {/* Selection overlay */}
        <View
          style={[
            filmStyles.selection,
            {
              left: `${(trimStart / totalMs) * 100}%` as any,
              right: `${((totalMs - trimEnd) / totalMs) * 100}%` as any,
            },
          ]}
        />
        {/* Left handle */}
        <TouchableOpacity
          style={[filmStyles.handle, filmStyles.handleLeft, { left: `${(trimStart / totalMs) * 100}%` as any }]}
          onPress={() => onTrimChange(Math.max(0, trimStart - 5000), trimEnd)}
        >
          <View style={filmStyles.handleBar} />
        </TouchableOpacity>
        {/* Right handle */}
        <TouchableOpacity
          style={[filmStyles.handle, filmStyles.handleRight, { right: `${((totalMs - trimEnd) / totalMs) * 100}%` as any }]}
          onPress={() => onTrimChange(trimStart, Math.min(totalMs, trimEnd + 5000))}
        >
          <View style={filmStyles.handleBar} />
        </TouchableOpacity>
      </View>
      {/* Time labels */}
      <View style={filmStyles.timeLabels}>
        <Text style={filmStyles.timeLabel}>{formatTs(trimStart)}</Text>
        <Text style={filmStyles.timeDuration}>
          {formatTs(trimEnd - trimStart)} selected
        </Text>
        <Text style={filmStyles.timeLabel}>{formatTs(trimEnd)}</Text>
      </View>
    </View>
  );
}

const filmStyles = StyleSheet.create({
  container: { gap: 6 },
  track: {
    height: 56,
    borderRadius: 6,
    overflow: "hidden",
    flexDirection: "row",
    position: "relative",
    backgroundColor: Colors.surfaceContainerLowest,
  },
  frame: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: Colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  selection: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,229,255,0.15)",
    borderWidth: 1.5,
    borderColor: Colors.tertiaryContainer,
  },
  handle: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.tertiaryContainer,
    zIndex: 5,
  },
  handleLeft: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  handleRight: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  handleBar: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  timeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeLabel: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  timeDuration: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
});

// ─── Social platform buttons ────────────────────────────────────────────────

interface Platform {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
}

const PLATFORMS: Platform[] = [
  { label: "Instagram", icon: "logo-instagram", color: "#E1306C" },
  { label: "TikTok",    icon: "logo-tiktok",    color: Colors.onSurface },
  { label: "YouTube",   icon: "logo-youtube",   color: "#FF0000" },
  { label: "X.COM",     icon: "logo-twitter",   color: Colors.onSurface },
];

// ─── Screen ────────────────────────────────────────────────────────────────

export default function ReplayScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useQuery(api.queries.getSession, {
    sessionId: id as Id<"sessions">,
  });

  const totalMs = useMemo(() => {
    if (!session) return 60000;
    return (session.endedAt ?? Date.now()) - session.startedAt;
  }, [session]);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd]     = useState(Math.min(30000, totalMs));
  const [playing, setPlaying]     = useState(false);
  const [burnTelemetry, setBurnTelemetry] = useState(true);

  const maxSpeedKph = session?.gpsLog.length
    ? (Math.max(...session.gpsLog.map((p) => p.speed)) * 3.6).toFixed(0)
    : "0";

  const handleShare = async () => {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Sharing unavailable", "This device does not support file sharing.");
      return;
    }
    // In production, export the trimmed video file and share it.
    // For now, share a text summary of the session.
    Alert.alert(
      "Export Clip",
      `Would export ${formatTs(trimEnd - trimStart)} clip from this session.\n\nFull video export requires native recording integration.`,
      [{ text: "OK" }]
    );
  };

  if (!session) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.centered} edges={["top"]}>
          <ActivityIndicator color={Colors.tertiaryContainer} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Instant Replay</Text>
            <Text style={styles.subtitle}>TIMELINE PRECISION</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="share-outline" size={18} color={Colors.tertiaryContainer} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Video player placeholder */}
          <View style={styles.player}>
            <View style={styles.playerFeed}>
              <Ionicons name="videocam" size={40} color={Colors.outlineVariant} />
            </View>

            {/* Playback HUD overlay */}
            <View style={styles.playerHud}>
              <View style={styles.playerHudLeft}>
                <Text style={styles.hudSpeed}>{maxSpeedKph} <Text style={styles.hudUnit}>KM/H</Text></Text>
                {session.gpsLog.length > 0 && (
                  <Text style={styles.hudCoords}>
                    {session.gpsLog[0].lat.toFixed(4)}° N
                  </Text>
                )}
              </View>
              <View style={styles.playerHudRight}>
                {burnTelemetry && (
                  <View style={styles.burnBadge}>
                    <Text style={styles.burnBadgeText}>HUD BURN-IN</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Replay timer */}
            <View style={styles.playerTimer}>
              <Text style={styles.playerTimerText}>
                {formatTs(trimStart)} / {formatTs(totalMs)}
              </Text>
            </View>

            {/* Play/pause button */}
            <TouchableOpacity
              style={styles.playBtn}
              onPress={() => setPlaying((v) => !v)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={playing ? "pause" : "play"}
                size={28}
                color={Colors.onSurface}
              />
            </TouchableOpacity>
          </View>

          {/* Telemetry burn-in toggle */}
          <View style={styles.burnRow}>
            <View style={styles.burnInfo}>
              <Ionicons name="layers-outline" size={16} color={Colors.tertiaryContainer} />
              <View>
                <Text style={styles.burnLabel}>Telemetry Burn-In</Text>
                <Text style={styles.burnHint}>Overlay speed + GPS on exported clip</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.toggle, burnTelemetry && styles.toggleOn]}
              onPress={() => setBurnTelemetry((v) => !v)}
            >
              <View style={[styles.toggleThumb, burnTelemetry && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {/* Filmstrip timeline */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CLIP SELECTION</Text>
            <Filmstrip
              totalMs={totalMs}
              trimStart={trimStart}
              trimEnd={trimEnd}
              onTrimChange={(s, e) => { setTrimStart(s); setTrimEnd(e); }}
            />
          </View>

          {/* Duration presets */}
          <View style={styles.presets}>
            {[15, 30, 45, 60].map((sec) => (
              <TouchableOpacity
                key={sec}
                style={[
                  styles.presetChip,
                  trimEnd - trimStart === sec * 1000 && styles.presetChipActive,
                ]}
                onPress={() => setTrimEnd(Math.min(totalMs, trimStart + sec * 1000))}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    trimEnd - trimStart === sec * 1000 && styles.presetChipTextActive,
                  ]}
                >
                  {sec}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Export actions */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EXPORT</Text>
            <View style={styles.exportBtns}>
              <TouchableOpacity style={styles.exportBtn} onPress={handleShare}>
                <Ionicons name="camera-outline" size={20} color={Colors.onSurface} />
                <Text style={styles.exportBtnText}>Snapshot</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportBtn} onPress={handleShare}>
                <Ionicons name="film-outline" size={20} color={Colors.onSurface} />
                <Text style={styles.exportBtnText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={20} color={Colors.tertiaryContainer} />
                <Text style={[styles.exportBtnText, { color: Colors.tertiaryContainer }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Social platforms */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SHARE TO</Text>
            <View style={styles.socialRow}>
              {PLATFORMS.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={styles.socialBtn}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <Ionicons name={p.icon} size={22} color={p.color} />
                  <Text style={styles.socialLabel}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Session metadata */}
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>SESSION DATA</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Started</Text>
              <Text style={styles.metaVal}>{formatDate(session.startedAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Duration</Text>
              <Text style={styles.metaVal}>{formatTs(totalMs)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Resolution</Text>
              <Text style={styles.metaVal}>{session.resolution ?? "Unknown"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Max Speed</Text>
              <Text style={[styles.metaVal, { color: Colors.tertiaryContainer }]}>
                {maxSpeedKph} km/h
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>GPS Points</Text>
              <Text style={styles.metaVal}>{session.gpsLog.length}</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerLow,
  },
  headerBtn: {
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
  scroll: {
    paddingBottom: 20,
  },
  // ── Player
  player: {
    height: 220,
    backgroundColor: Colors.surfaceContainerLowest,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  playerFeed: {
    opacity: 0.4,
  },
  playerHud: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  playerHudLeft: { gap: 2 },
  playerHudRight: {},
  hudSpeed: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 22,
    fontWeight: "700",
    textShadowColor: Colors.tertiaryContainer,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  hudUnit: {
    fontFamily: Typography.headlineMedium,
    fontSize: 11,
    color: Colors.tertiaryFixedDim,
  },
  hudCoords: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.headlineRegular,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  burnBadge: {
    backgroundColor: Colors.electricCyanDim,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
  },
  burnBadgeText: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 8,
    letterSpacing: 1.5,
  },
  playerTimer: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: Colors.glassBg,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  playerTimerText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.glassBg,
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Burn-in toggle
  burnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerLow,
  },
  burnInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  burnLabel: {
    color: Colors.onSurface,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
  },
  burnHint: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 10,
    marginTop: 1,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerHighest,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.outline,
  },
  toggleThumbOn: {
    backgroundColor: Colors.tertiaryContainer,
    alignSelf: "flex-end",
  },
  // ── Section
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  sectionLabel: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2.5,
  },
  // ── Duration presets
  presets: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  presetChipActive: {
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
  },
  presetChipText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 12,
  },
  presetChipTextActive: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
  },
  // ── Export
  exportBtns: {
    flexDirection: "row",
    gap: 10,
  },
  exportBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
  },
  exportBtnText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
  },
  // ── Social
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
  },
  socialLabel: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 9,
    textAlign: "center",
  },
  // ── Metadata
  metaCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
  },
  metaTitle: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaKey: {
    color: Colors.outline,
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
  },
  metaVal: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
  },
});
