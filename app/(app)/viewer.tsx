import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useGPS } from "@/hooks/useGPS";
import { Colors, Typography, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

// ─── Mock chat messages ─────────────────────────────────────────────────────

interface ChatMsg {
  id: string;
  user: string;
  text: string;
  ts: number;
}

const INITIAL_CHAT: ChatMsg[] = [
  { id: "1", user: "SpeedDemon99",    text: "That overtake was insane!! 🔥",      ts: Date.now() - 120000 },
  { id: "2", user: "NightRider_LA",   text: "What's your resolution setting?",    ts: Date.now() - 90000  },
  { id: "3", user: "TruckerMike",     text: "Just joined, looking smooth 👌",     ts: Date.now() - 60000  },
  { id: "4", user: "DashFan2025",     text: "Stream health looking great tonight",ts: Date.now() - 30000  },
];

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function ViewerScreen() {
  const router = useRouter();
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(INITIAL_CHAT);
  const [chatText, setChatText] = useState("");
  const [chatMinimized, setChatMinimized] = useState(false);
  const [viewerCount] = useState(1243);
  const chatListRef = useRef<FlatList>(null);

  const activeSession = useQuery(api.queries.getActiveSession);
  const { location } = useGPS({ enabled: true });

  const speedKph = location ? (location.speed * 3.6).toFixed(0) : "0";
  const lat = location ? location.lat.toFixed(4) : "0.0000";
  const lng = location ? location.lng.toFixed(4) : "0.0000";
  const isLive = !!activeSession;

  // Pulse for live indicator
  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const sendChat = () => {
    if (!chatText.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { id: String(Date.now()), user: "You", text: chatText.trim(), ts: Date.now() },
    ]);
    setChatText("");
    setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <View style={styles.container}>
      {/* Camera feed background placeholder */}
      <View style={styles.feedBg}>
        <Ionicons name="videocam" size={48} color={Colors.outlineVariant} />
        <Text style={styles.feedLabel}>
          {isLive ? "LIVE FEED" : "NO ACTIVE STREAM"}
        </Text>
      </View>

      {/* Gradient overlay */}
      <View style={styles.gradientOverlay} pointerEvents="none" />

      <SafeAreaView style={styles.inner} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={20} color={Colors.onSurface} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Animated.View style={[styles.liveIndicator, { opacity: livePulse }]} />
            <Text style={styles.liveText}>{isLive ? "LIVE" : "OFFLINE"}</Text>
          </View>

          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={18} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* Viewer count + health */}
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Ionicons name="eye-outline" size={12} color={Colors.tertiaryContainer} />
            <Text style={styles.statBadgeText}>{viewerCount.toLocaleString()}</Text>
          </View>
          <View style={styles.statBadge}>
            <View style={[styles.healthDot, { backgroundColor: Colors.tertiaryContainer }]} />
            <Text style={styles.statBadgeText}>Stable</Text>
          </View>
          {activeSession?.resolution && (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>{activeSession.resolution}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* HUD telemetry — bottom left */}
      <View style={styles.hudBlock}>
        <Text style={styles.hudSpeed}>{speedKph} <Text style={styles.hudUnit}>KM/H</Text></Text>
        <Text style={styles.hudCoords}>{lat}° N  {lng}° W</Text>
      </View>

      {/* Chat panel */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.chatPanel}
      >
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>LIVE COMMS</Text>
          <TouchableOpacity onPress={() => setChatMinimized((v) => !v)}>
            <Ionicons
              name={chatMinimized ? "chevron-up-outline" : "chevron-down-outline"}
              size={16}
              color={Colors.outline}
            />
          </TouchableOpacity>
        </View>

        {!chatMinimized && (
          <>
            <FlatList
              ref={chatListRef}
              data={chatMessages}
              keyExtractor={(m) => m.id}
              style={styles.chatList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.chatMsg}>
                  <Text style={styles.chatUser}>{item.user}</Text>
                  <Text style={styles.chatText}> {item.text}</Text>
                </View>
              )}
            />
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                value={chatText}
                onChangeText={setChatText}
                placeholder="Say something…"
                placeholderTextColor={Colors.outline}
                onSubmitEditing={sendChat}
                returnKeyType="send"
              />
              <TouchableOpacity style={styles.sendBtn} onPress={sendChat}>
                <Ionicons name="send" size={16} color={Colors.tertiaryContainer} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Support driver */}
        <TouchableOpacity style={styles.supportBtn} activeOpacity={0.85}>
          <Ionicons name="heart-outline" size={16} color={Colors.primaryFixed} />
          <Text style={styles.supportBtnText}>SUPPORT DRIVER</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  feedBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  feedLabel: {
    color: Colors.outlineVariant,
    fontFamily: Typography.headlineMedium,
    fontSize: 12,
    letterSpacing: 2,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,19,24,0.45)",
  },
  inner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inversePrimary,
  },
  liveText: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headline,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statBadgeText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
  },
  // HUD
  hudBlock: {
    position: "absolute",
    bottom: 280,
    left: 20,
    gap: 4,
  },
  hudSpeed: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 36,
    fontWeight: "700",
    textShadowColor: Colors.tertiaryContainer,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  hudUnit: {
    fontFamily: Typography.headlineMedium,
    fontSize: 14,
    color: Colors.tertiaryFixedDim,
  },
  hudCoords: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.headlineRegular,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  // Chat panel
  chatPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(12,14,18,0.9)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 10,
    maxHeight: 280,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatTitle: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2.5,
  },
  chatList: {
    maxHeight: 120,
  },
  chatMsg: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  chatUser: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
  },
  chatText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.body,
    fontSize: 12,
  },
  chatInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.onSurface,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  supportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.recordRedDim,
    borderRadius: Radius.full,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.inversePrimary,
  },
  supportBtnText: {
    color: Colors.primaryFixed,
    fontFamily: Typography.headline,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
