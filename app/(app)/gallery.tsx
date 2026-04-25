import React, { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import * as MediaLibrary from "expo-media-library";
import { useVideoPlayer, VideoView } from "expo-video";
import { Colors, Typography, Radius } from "@/constants/theme";
import { FontAwesome5 } from "@expo/vector-icons";

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
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSecsDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isCritical(session: Doc<"sessions">): boolean {
  const duration = ((session.endedAt ?? Date.now()) - session.startedAt) / 1000;
  const maxSpeedKph =
    session.gpsLog.length > 0
      ? Math.max(...session.gpsLog.map((p) => p.speed)) * 3.6
      : 0;
  return duration < 60 || maxSpeedKph > 120;
}

function maxSpeedKph(session: Doc<"sessions">): number {
  if (session.gpsLog.length === 0) return 0;
  return Math.max(...session.gpsLog.map((p) => p.speed)) * 3.6;
}

type Filter = "ALL" | "TODAY" | "EVENTS";

// ─── Local clip card ───────────────────────────────────────────────────────

function LocalClipCard({
  asset,
  onPlay,
  onShare,
  onDelete,
}: {
  asset: MediaLibrary.Asset;
  onPlay: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.clipCard}>
      <View style={styles.thumbBg}>
        {asset.uri ? (
          <Image source={{ uri: asset.uri }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <FontAwesome5 name="video" size={28} color={Colors.outlineVariant} solid />
        )}
        <View style={styles.thumbHud}>
          <Text style={styles.thumbSpeed}>{formatSecsDuration(asset.duration)}</Text>
        </View>
        <View style={styles.localBadge}>
          <FontAwesome5 name="hdd" size={7} color={Colors.tertiaryContainer} solid />
          <Text style={styles.localBadgeText}>LOCAL</Text>
        </View>
      </View>
      <View style={styles.clipMeta}>
        <View style={styles.clipMetaRow}>
          <Text style={styles.clipDate} numberOfLines={1}>
            {formatDate(asset.creationTime)}
          </Text>
          <View style={styles.resBadge}>
            <Text style={styles.resBadgeText}>{formatFileSize((asset as any).fileSize ?? 0)}</Text>
          </View>
        </View>
        <View style={styles.clipStats}>
          <View style={styles.stat}>
            <FontAwesome5 name="clock" size={9} color={Colors.outline} solid />
            <Text style={styles.statText}>{formatSecsDuration(asset.duration)}</Text>
          </View>
          <View style={styles.stat}>
            <FontAwesome5 name="film" size={9} color={Colors.outline} solid />
            <Text style={styles.statText}>{asset.filename}</Text>
          </View>
        </View>
      </View>
      <View style={styles.clipActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onPlay} activeOpacity={0.8}>
          <FontAwesome5 name="play" size={13} color={Colors.tertiaryContainer} solid />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onShare} activeOpacity={0.8}>
          <FontAwesome5 name="share-alt" size={13} color={Colors.outline} solid />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onDelete} activeOpacity={0.8}>
          <FontAwesome5 name="trash" size={13} color={Colors.error} solid />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Stream session card ───────────────────────────────────────────────────

function ClipCard({
  session,
  critical,
  onPress,
}: {
  session: Doc<"sessions">;
  critical: boolean;
  onPress: () => void;
}) {
  const isLive = session.status === "live";
  const speed = maxSpeedKph(session).toFixed(0);
  const dur = formatDuration(session.startedAt, session.endedAt);

  return (
    <TouchableOpacity style={styles.clipCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.thumbBg}>
        <FontAwesome5 name="broadcast-tower" size={24} color={Colors.outlineVariant} solid />
        <View style={styles.thumbHud}>
          <Text style={styles.thumbSpeed}>{speed} KM/H</Text>
        </View>
        {isLive ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        ) : critical ? (
          <View style={styles.criticalBadge}>
            <FontAwesome5 name="exclamation-triangle" size={7} color={Colors.inversePrimary} solid />
            <Text style={styles.criticalBadgeText}>EVENT</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.clipMeta}>
        <View style={styles.clipMetaRow}>
          <Text style={styles.clipDate} numberOfLines={1}>{formatDate(session.startedAt)}</Text>
          {session.resolution && (
            <View style={styles.resBadge}>
              <Text style={styles.resBadgeText}>{session.resolution}</Text>
            </View>
          )}
        </View>
        <View style={styles.clipStats}>
          <View style={styles.stat}>
            <FontAwesome5 name="clock" size={9} color={Colors.outline} solid />
            <Text style={styles.statText}>{dur}</Text>
          </View>
          <View style={styles.stat}>
            <FontAwesome5 name="tachometer-alt" size={9} color={Colors.outline} solid />
            <Text style={styles.statText}>{speed} km/h</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.downloadBtn} onPress={onPress}>
        <FontAwesome5 name="play-circle" size={22} color={Colors.tertiaryContainer} solid />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Video Player Modal ────────────────────────────────────────────────────

function VideoPlayerModal({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => { p.play(); });
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.playerContainer}>
        <VideoView player={player} style={styles.playerVideo} allowsFullscreen allowsPictureInPicture />
        <TouchableOpacity style={styles.playerClose} onPress={onClose} activeOpacity={0.8}>
          <FontAwesome5 name="times" size={18} color={Colors.onSurface} solid />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function GalleryScreen() {
  const router = useRouter();
  const sessions = useQuery(api.queries.getSessionHistory, { limit: 50 });
  const [filter, setFilter] = useState<Filter>("ALL");
  const [playingUri, setPlayingUri] = useState<string | null>(null);

  // Local recordings from device media library
  const [localClips, setLocalClips] = useState<MediaLibrary.Asset[]>([]);
  const [mediaPermission, setMediaPermission] = useState<"unknown" | "granted" | "denied">("unknown");

  const loadLocalClips = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setMediaPermission(status === "granted" ? "granted" : "denied");
    if (status !== "granted") return;

    const album = await MediaLibrary.getAlbumAsync("StreamCam");
    if (!album) {
      setLocalClips([]);
      return;
    }
    const { assets } = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.video,
      album,
      first: 200,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });
    setLocalClips(assets);
  }, []);

  useEffect(() => {
    loadLocalClips();
  }, [loadLocalClips]);

  const handleShareClip = useCallback(async (asset: MediaLibrary.Asset) => {
    await Sharing.shareAsync(asset.uri);
  }, []);

  const handleDeleteClip = useCallback((asset: MediaLibrary.Asset) => {
    Alert.alert(
      "Delete clip",
      `"${asset.filename}" will be permanently removed from your device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await MediaLibrary.deleteAssetsAsync([asset.id]);
            await loadLocalClips();
          },
        },
      ]
    );
  }, [loadLocalClips]);

  const filtered = React.useMemo(() => {
    if (!sessions) return [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    switch (filter) {
      case "TODAY":
        return sessions.filter((s) => s.startedAt >= todayStart.getTime());
      case "EVENTS":
        return sessions.filter(isCritical);
      default:
        return sessions;
    }
  }, [sessions, filter]);

  const filteredLocalClips = React.useMemo(() => {
    if (filter === "EVENTS") return [];
    if (filter === "TODAY") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return localClips.filter((a) => a.creationTime >= todayStart.getTime());
    }
    return localClips;
  }, [localClips, filter]);

  const criticalSessions = filtered.filter(isCritical);
  const regularSessions = filtered.filter((s) => !isCritical(s));
  const totalCount = (sessions?.length ?? 0) + localClips.length;

  const goToReplay = (id: string) => router.push({ pathname: "/(app)/replay", params: { id } });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {playingUri && (
        <VideoPlayerModal uri={playingUri} onClose={() => setPlayingUri(null)} />
      )}
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Gallery</Text>
          <Text style={styles.subtitle}>
            {sessions !== undefined ? `${totalCount} CLIPS` : "LOADING…"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={loadLocalClips}>
            <FontAwesome5 name="sync" size={16} color={Colors.outline} solid />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {(["ALL", "TODAY", "EVENTS"] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {sessions === undefined ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.tertiaryContainer} />
        </View>
      ) : totalCount === 0 ? (
        <View style={styles.centered}>
          <FontAwesome5 name="photo-video" size={48} color={Colors.outline} solid />
          <Text style={styles.emptyTitle}>No recordings yet</Text>
          <Text style={styles.emptyBody}>
            Record a clip or start a stream session to see your content here.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Critical Incidents (stream sessions only) */}
          {criticalSessions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome5 name="exclamation-triangle" size={12} color={Colors.inversePrimary} solid />
                <Text style={styles.sectionTitle}>CRITICAL INCIDENTS</Text>
                <View style={styles.lockBadge}>
                  <FontAwesome5 name="lock" size={8} color={Colors.outline} solid />
                </View>
              </View>
              <View style={styles.clipList}>
                {criticalSessions.map((s) => (
                  <ClipCard key={s._id} session={s} critical onPress={() => goToReplay(s._id)} />
                ))}
              </View>
            </View>
          )}

          {/* Local Recordings */}
          {filteredLocalClips.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome5 name="hdd" size={12} color={Colors.tertiaryContainer} solid />
                <Text style={styles.sectionTitleCyan}>LOCAL RECORDINGS</Text>
                <Text style={styles.sectionCount}>{filteredLocalClips.length}</Text>
              </View>
              <View style={styles.clipList}>
                {filteredLocalClips.map((a) => (
                  <LocalClipCard
                    key={a.id}
                    asset={a}
                    onPlay={() => setPlayingUri(a.uri)}
                    onShare={() => handleShareClip(a)}
                    onDelete={() => handleDeleteClip(a)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Stream Sessions */}
          {regularSessions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome5 name="broadcast-tower" size={12} color={Colors.tertiaryContainer} solid />
                <Text style={styles.sectionTitleCyan}>STREAM SESSIONS</Text>
                <Text style={styles.sectionCount}>{regularSessions.length}</Text>
              </View>
              <View style={styles.clipList}>
                {regularSessions.map((s) => (
                  <ClipCard key={s._id} session={s} critical={false} onPress={() => goToReplay(s._id)} />
                ))}
              </View>
            </View>
          )}

          {filteredLocalClips.length === 0 && filtered.length === 0 && (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No clips match this filter</Text>
            </View>
          )}

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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  filterChipActive: {
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
  },
  filterChipText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  filterChipTextActive: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
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
    paddingTop: 8,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2.5,
    flex: 1,
  },
  sectionTitleCyan: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2.5,
    flex: 1,
  },
  sectionCount: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
  lockBadge: {
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 6,
    padding: 4,
  },
  clipList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  clipCard: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
    overflow: "hidden",
    alignItems: "center",
  },
  thumbBg: {
    width: 110,
    height: 72,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  thumbImg: {
    width: 110,
    height: 72,
  },
  thumbHud: {
    position: "absolute",
    bottom: 4,
    left: 4,
  },
  thumbSpeed: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 8,
    letterSpacing: 1,
  },
  liveBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.recordRedDim,
    borderWidth: 1,
    borderColor: Colors.inversePrimary,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.inversePrimary,
  },
  liveBadgeText: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headline,
    fontSize: 8,
    letterSpacing: 1,
  },
  criticalBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(147,0,10,0.7)",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  criticalBadgeText: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headline,
    fontSize: 8,
    letterSpacing: 1,
  },
  localBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  localBadgeText: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 8,
    letterSpacing: 1,
  },
  clipMeta: {
    flex: 1,
    padding: 12,
    gap: 6,
  },
  clipMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clipDate: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    flex: 1,
  },
  resBadge: {
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resBadgeText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  clipStats: {
    flexDirection: "row",
    gap: 12,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 10,
  },
  clipActions: {
    flexDirection: "column",
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
    alignItems: "center",
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  playerContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
  },
  playerVideo: {
    flex: 1,
  },
  playerClose: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
