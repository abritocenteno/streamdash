import React, { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Colors, Typography, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

// ─── Helpers ───────────────────────────────────────────────────────────────

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function totalKm(log: { lat: number; lng: number }[]): number {
  let d = 0;
  for (let i = 1; i < log.length; i++) d += haversineKm(log[i - 1], log[i]);
  return d;
}

function totalMiles(log: { lat: number; lng: number }[]): number {
  return totalKm(log) * 0.621371;
}

function formatDuration(startedAt: number, endedAt?: number): string {
  const ms = (endedAt ?? Date.now()) - startedAt;
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateRange(start: number, end?: number): string {
  const s = new Date(start);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!end) return fmt(s);
  return `${fmt(s)} — ${fmt(new Date(end))}`;
}

/** Safety Index: 0–100 score based on speed consistency and max speed.
 *  Higher score = safer driving. */
function calcSafetyScore(sessions: Doc<"sessions">[]): number {
  if (sessions.length === 0) return 100;

  let totalPenalty = 0;
  let sampledSessions = 0;

  for (const s of sessions) {
    const log = s.gpsLog;
    if (log.length === 0) continue;
    sampledSessions++;

    const speedsKph = log.map((p) => p.speed * 3.6);
    const maxSpd = Math.max(...speedsKph);
    const avgSpd = speedsKph.reduce((a, b) => a + b, 0) / speedsKph.length;

    // Penalty for high max speed (> 130 km/h)
    if (maxSpd > 130) totalPenalty += Math.min(30, (maxSpd - 130) / 3);
    // Penalty for very high average speed (> 100 km/h)
    if (avgSpd > 100) totalPenalty += Math.min(15, (avgSpd - 100) / 2);
  }

  if (sampledSessions === 0) return 100;
  const avgPenalty = totalPenalty / sampledSessions;
  return Math.max(0, Math.round(100 - avgPenalty));
}

function safetyLabel(score: number): string {
  if (score >= 90) return "Optimal";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Review";
}

function safetyColor(score: number): string {
  if (score >= 90) return Colors.tertiaryContainer;
  if (score >= 75) return Colors.secondary;
  if (score >= 60) return Colors.error;
  return Colors.inversePrimary;
}

// ─── Trip card ─────────────────────────────────────────────────────────────

function TripCard({ session, index }: { session: Doc<"sessions">; index: number }) {
  const distMi = totalMiles(session.gpsLog).toFixed(1);
  const distKm = totalKm(session.gpsLog).toFixed(1);
  const maxSpd = session.gpsLog.length
    ? (Math.max(...session.gpsLog.map((p) => p.speed)) * 3.6).toFixed(0)
    : "0";
  const dur = formatDuration(session.startedAt, session.endedAt);
  const isLive = session.status === "live";

  return (
    <TouchableOpacity style={styles.tripCard} activeOpacity={0.85}>
      {/* Route map placeholder */}
      <View style={styles.tripMapBg}>
        <Ionicons name="map-outline" size={24} color={Colors.outlineVariant} />
        {/* GPS trail mini-visualization */}
        {session.gpsLog.length > 1 && (
          <View style={styles.trailIndicator}>
            <View style={styles.trailDot} />
            <View style={styles.trailLine} />
            <View style={[styles.trailDot, { backgroundColor: Colors.inversePrimary }]} />
          </View>
        )}
        {isLive && (
          <View style={styles.liveTag}>
            <View style={styles.liveTagDot} />
            <Text style={styles.liveTagText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Trip details */}
      <View style={styles.tripDetails}>
        <View style={styles.tripHeader}>
          <Text style={styles.tripId}>TRIP-{String(index + 1).padStart(3, "0")}</Text>
          <Text style={styles.tripDate}>{formatDateRange(session.startedAt, session.endedAt)}</Text>
        </View>
        <View style={styles.tripStats}>
          <View style={styles.tripStat}>
            <Text style={styles.tripStatValue}>{distMi} <Text style={styles.tripStatUnit}>MI</Text></Text>
          </View>
          <View style={styles.tripStatDivider} />
          <View style={styles.tripStat}>
            <Text style={styles.tripStatValue}>{maxSpd} <Text style={styles.tripStatUnit}>KM/H MAX</Text></Text>
          </View>
          <View style={styles.tripStatDivider} />
          <View style={styles.tripStat}>
            <Text style={styles.tripStatValue}>{dur} <Text style={styles.tripStatUnit}>DUR</Text></Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.tripOpenBtn}>
        <Ionicons name="open-outline" size={16} color={Colors.outline} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function LogsScreen() {
  const sessions = useQuery(api.queries.getSessionHistory, { limit: 30 });

  const stats = useMemo(() => {
    if (!sessions) return null;
    const totalMi = sessions.reduce((acc, s) => acc + totalMiles(s.gpsLog), 0);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekMi = sessions
      .filter((s) => s.startedAt >= weekAgo)
      .reduce((acc, s) => acc + totalMiles(s.gpsLog), 0);
    const safetyScore = calcSafetyScore(sessions);
    return { totalMi, weekMi, safetyScore };
  }, [sessions]);

  const score = stats?.safetyScore ?? 100;
  const scoreColor = safetyColor(score);
  const scoreLabel = safetyLabel(score);
  // SVG circle progress — circumference of r=48: 2πr ≈ 301.6
  const circumference = 301.6;
  const strokeDashoffset = circumference * (1 - score / 100);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Trip Logs</Text>
        <Text style={styles.subtitle}>JOURNEY ANALYTICS</Text>
      </View>

      {!sessions ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.tertiaryContainer} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Summary bento cards */}
          <View style={styles.bentoRow}>
            {/* Safety Index */}
            <View style={[styles.bentoCard, styles.safetyCard]}>
              <Text style={styles.bentoLabel}>SAFETY INDEX</Text>
              {/* Circular progress */}
              <View style={styles.circleWrap}>
                <View style={styles.circleOuter}>
                  <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}</Text>
                  <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
                </View>
              </View>
              <Text style={styles.safetyHint}>Based on speed patterns across all trips</Text>
            </View>

            {/* Mileage */}
            <View style={[styles.bentoCard, styles.mileageCard]}>
              <Text style={styles.bentoLabel}>TOTAL DISTANCE</Text>
              <Text style={styles.mileageValue}>
                {(stats?.totalMi ?? 0).toFixed(0)}
              </Text>
              <Text style={styles.mileageUnit}>MI</Text>
              <View style={styles.weekBadge}>
                <Ionicons name="trending-up-outline" size={12} color={Colors.tertiaryContainer} />
                <Text style={styles.weekText}>
                  +{(stats?.weekMi ?? 0).toFixed(1)} this week
                </Text>
              </View>
            </View>
          </View>

          {/* Sessions count */}
          <View style={styles.countRow}>
            <View style={styles.countCard}>
              <Text style={styles.countValue}>{sessions.length}</Text>
              <Text style={styles.countLabel}>Total Sessions</Text>
            </View>
            <View style={styles.countCard}>
              <Text style={styles.countValue}>
                {sessions.filter((s) => s.status === "live").length}
              </Text>
              <Text style={styles.countLabel}>Currently Live</Text>
            </View>
            <View style={styles.countCard}>
              <Text style={styles.countValue}>
                {sessions.filter((s) => s.startedAt >= Date.now() - 24 * 60 * 60 * 1000).length}
              </Text>
              <Text style={styles.countLabel}>Today</Text>
            </View>
          </View>

          {/* Recent journeys */}
          <View style={styles.journeysHeader}>
            <Text style={styles.journeysTitle}>RECENT JOURNEYS</Text>
            <TouchableOpacity>
              <Text style={styles.journeysSortText}>ALL ↓</Text>
            </TouchableOpacity>
          </View>

          {sessions.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="map-outline" size={52} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptyBody}>Start streaming to record your first trip.</Text>
            </View>
          ) : (
            <View style={styles.tripList}>
              {sessions.map((s, i) => (
                <TripCard key={s._id} session={s} index={i} />
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.loadMoreBtn}>
            <Text style={styles.loadMoreText}>LOAD MORE</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surfaceContainerLow,
  },
  title: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 2.5,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 32,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  scroll: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  // ── Bento cards
  bentoRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 8,
  },
  safetyCard: {
    flex: 1.2,
    alignItems: "center",
  },
  mileageCard: {
    alignItems: "center",
    justifyContent: "center",
  },
  bentoLabel: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 2,
    alignSelf: "flex-start",
  },
  circleWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Colors.tertiaryContainer,
    backgroundColor: Colors.electricCyanDim,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.tertiaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  circleOuter: {
    alignItems: "center",
  },
  scoreValue: {
    fontFamily: Typography.headline,
    fontSize: 24,
    fontWeight: "700",
  },
  scoreLabel: {
    fontFamily: Typography.headlineMedium,
    fontSize: 8,
    letterSpacing: 1,
    marginTop: -2,
  },
  safetyHint: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 9,
    textAlign: "center",
    lineHeight: 13,
  },
  mileageValue: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 40,
  },
  mileageUnit: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 12,
    letterSpacing: 2,
    marginTop: -4,
  },
  weekBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.electricCyanDim,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  weekText: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
  },
  // ── Count row
  countRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  countCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
    alignItems: "center",
  },
  countValue: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 22,
    fontWeight: "700",
  },
  countLabel: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 9,
    textAlign: "center",
    marginTop: 2,
  },
  // ── Journeys
  journeysHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  journeysTitle: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2.5,
  },
  journeysSortText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
  tripList: {
    gap: 10,
  },
  tripCard: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
    overflow: "hidden",
    alignItems: "center",
  },
  tripMapBg: {
    width: 90,
    height: 80,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  trailIndicator: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  trailDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.tertiaryContainer,
  },
  trailLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: Colors.tertiaryContainer,
    opacity: 0.5,
  },
  liveTag: {
    position: "absolute",
    top: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.recordRedDim,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.inversePrimary,
  },
  liveTagDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.inversePrimary,
  },
  liveTagText: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headline,
    fontSize: 8,
    letterSpacing: 1,
  },
  tripDetails: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tripId: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  tripDate: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 9,
  },
  tripStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tripStat: {},
  tripStatValue: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 12,
    fontWeight: "700",
  },
  tripStatUnit: {
    color: Colors.outline,
    fontFamily: Typography.headlineRegular,
    fontSize: 9,
    fontWeight: "400",
  },
  tripStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.outlineVariant,
  },
  tripOpenBtn: {
    padding: 12,
  },
  loadMoreBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
  },
  loadMoreText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 11,
    letterSpacing: 2,
  },
});
