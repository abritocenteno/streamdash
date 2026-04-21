import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Colors, Typography, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(startedAt: number, endedAt?: number): string {
  const ms = (endedAt ?? Date.now()) - startedAt;
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rough haversine distance in km between two GPS points */
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const x =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLon *
      sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function totalDistanceKm(log: { lat: number; lng: number }[]): number {
  let d = 0;
  for (let i = 1; i < log.length; i++) {
    d += haversineKm(log[i - 1], log[i]);
  }
  return d;
}

// ─── Card ──────────────────────────────────────────────────────────────────

function StatPill({
  icon,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
}) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={12} color={Colors.outline} />
      <Text style={styles.statPillText}>{value}</Text>
    </View>
  );
}

function SessionCard({ session, index }: { session: Doc<"sessions">; index: number }) {
  const isLive = session.status === "live";
  const gpsLog = session.gpsLog;
  const maxSpeedKph =
    gpsLog.length > 0
      ? Math.max(...gpsLog.map((p) => p.speed)) * 3.6
      : 0;
  const distKm = totalDistanceKm(gpsLog);

  // Alternating tonal depth — no dividers per design rules
  const cardBg = index % 2 === 0
    ? Colors.surfaceContainerLow
    : Colors.surfaceContainerLowest;

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Accent bar — record red for live, electric cyan for ended */}
      <View style={[styles.accentBar, isLive ? styles.accentLive : styles.accentEnded]} />

      <View style={styles.cardInner}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusBadge, isLive ? styles.statusLive : styles.statusEnded]}>
              {isLive && <View style={styles.liveDot} />}
              <Text style={[styles.statusText, isLive ? styles.statusTextLive : styles.statusTextEnded]}>
                {isLive ? "LIVE" : "ENDED"}
              </Text>
            </View>
            {session.resolution && (
              <View style={styles.resBadge}>
                <Text style={styles.resBadgeText}>{session.resolution}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateText}>{formatDate(session.startedAt)}</Text>
            <Text style={styles.timeText}>{formatTime(session.startedAt)}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill
            icon="time-outline"
            value={formatDuration(session.startedAt, session.endedAt)}
          />
          <StatPill
            icon="speedometer-outline"
            value={`${maxSpeedKph.toFixed(0)} km/h`}
          />
          <StatPill
            icon="navigate-outline"
            value={`${distKm.toFixed(2)} km`}
          />
        </View>

        {/* Start coords */}
        {gpsLog.length > 0 && (
          <Text style={styles.coordPreview}>
            <Text style={styles.coordLabel}>START  </Text>
            {gpsLog[0].lat.toFixed(5)}, {gpsLog[0].lng.toFixed(5)}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const sessions = useQuery(api.queries.getSessionHistory, { limit: 30 });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        {sessions && (
          <Text style={styles.subtitle}>
            {sessions.length} SESSION{sessions.length !== 1 ? "S" : ""}
          </Text>
        )}
      </View>

      {!sessions ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.tertiaryContainer} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="videocam-off-outline" size={52} color={Colors.outline} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyBody}>
            Your stream sessions will appear here after you go live.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => (
            <SessionCard session={item} index={index} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

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
    marginTop: 3,
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
  },
  emptyBody: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    padding: 16,
    gap: 12,  // 12px vertical gap — no dividers per design rules
  },
  card: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  accentBar: {
    width: 3,
    borderRadius: 2,
  },
  accentLive: {
    backgroundColor: Colors.inversePrimary,  // record red
  },
  accentEnded: {
    backgroundColor: Colors.tertiaryContainer,  // electric cyan
  },
  cardInner: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  statusLive: {
    backgroundColor: Colors.recordRedDim,
  },
  statusEnded: {
    backgroundColor: Colors.electricCyanDim,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.inversePrimary,
  },
  statusText: {
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  statusTextLive: {
    color: Colors.inversePrimary,
  },
  statusTextEnded: {
    color: Colors.tertiaryContainer,
  },
  resBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  resBadgeText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  dateText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
  },
  timeText: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 10,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statPillText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
  },
  coordPreview: {
    color: Colors.outline,
    fontFamily: Typography.headlineRegular,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  coordLabel: {
    color: Colors.outlineVariant,
    letterSpacing: 1,
  },
});
