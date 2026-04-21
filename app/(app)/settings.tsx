import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { api } from "@/convex/_generated/api";
import { Colors, Typography, Radius, StreamPlatforms, StreamPlatform } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

const RESOLUTIONS = ["480p", "720p", "1080p", "4K"] as const;
const FPS_OPTIONS  = ["24", "30", "60"] as const;
const CAMERAS = [
  { label: "Back",  value: "back"  },
  { label: "Front", value: "front" },
] as const;
const PLATFORMS = Object.entries(StreamPlatforms).map(([value, p]) => ({
  value: value as StreamPlatform,
  label: p.label,
}));

// ─── Reusable primitives ────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon?: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View style={styles.sectionHeaderRow}>
      {icon && <Ionicons name={icon} size={12} color={Colors.tertiaryContainer} />}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function RowItem({
  label,
  value,
  onPress,
  danger,
  right,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={styles.rowItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {right ?? (
        value ? (
          <View style={styles.rowValueRow}>
            <Text style={styles.rowValue}>{value}</Text>
            {onPress && <Ionicons name="chevron-forward" size={14} color={Colors.outline} />}
          </View>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={14} color={danger ? Colors.inversePrimary : Colors.outline} />
        ) : null
      )}
    </TouchableOpacity>
  );
}

// ─── Segment control ────────────────────────────────────────────────────────

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.segment, value === opt && styles.segmentActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.segmentText, value === opt && styles.segmentTextActive]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router   = useRouter();
  const { signOut } = useAuth();
  const { user }    = useUser();
  const settings    = useQuery(api.queries.getUserSettings);
  const upsertSettings = useMutation(api.sessions.upsertSettings);

  const [streamKey,     setStreamKey]     = useState("");
  const [showKey,       setShowKey]       = useState(false);
  const [platform,      setPlatform]      = useState<StreamPlatform>("youtube");
  const [resolution,    setResolution]    = useState("720p");
  const [fps,           setFps]           = useState("30");
  const [cameraFacing,  setCameraFacing]  = useState("back");
  const [rtmpUrl,       setRtmpUrl]       = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  useEffect(() => {
    if (settings) {
      setStreamKey(settings.youtubeStreamKey ?? "");
      setPlatform((settings.streamPlatform as StreamPlatform) ?? "youtube");
      setResolution(settings.resolution ?? "720p");
      setCameraFacing(settings.cameraFacing ?? "back");
    }
  }, [settings]);

  const activePlatform = StreamPlatforms[platform] ?? StreamPlatforms.youtube;

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertSettings({
        youtubeStreamKey: streamKey.trim() || undefined,
        streamPlatform:   platform,
        resolution:       resolution === "4K" ? "1080p" : resolution, // cap at 1080p for now
        cameraFacing,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert("Error", "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const handleFormatStorage = () => {
    Alert.alert(
      "Format Storage",
      "This will erase all local recordings. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Format", style: "destructive", onPress: () => Alert.alert("Done", "Storage formatted.") },
      ]
    );
  };

  const handleFactoryReset = () => {
    Alert.alert(
      "Factory Reset",
      "All settings will be reset to defaults. You will be signed out.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: () => signOut() },
      ]
    );
  };

  const email        = user?.emailAddresses[0]?.emailAddress ?? "";
  const avatarLetter = email[0]?.toUpperCase() ?? "?";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.titleAccent}>SYSTEM CONFIG</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Account ──────────────────────────────────────────────── */}
          <SectionHeader title="ACCOUNT" icon="person-outline" />
          <Card>
            <View style={styles.accountRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.accountEmail} numberOfLines={1}>{email}</Text>
                <Text style={styles.accountLabel}>Signed in · Free plan</Text>
              </View>
              <TouchableOpacity onPress={handleSignOut} style={styles.iconBtn}>
                <Ionicons name="log-out-outline" size={20} color={Colors.inversePrimary} />
              </TouchableOpacity>
            </View>
          </Card>

          {/* ── Streaming Platform ─────────────────────────────────── */}
          <SectionHeader title="STREAMING PLATFORM" icon="radio-outline" />
          <View style={styles.platformGrid}>
            {PLATFORMS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.platformTile, platform === p.value && styles.platformTileActive]}
                onPress={() => setPlatform(p.value)}
              >
                <Text style={[styles.platformTileText, platform === p.value && styles.platformTileTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Stream Key ────────────────────────────────────────── */}
          <SectionHeader title={activePlatform.keyLabel} icon="key-outline" />
          <Card>
            <Text style={styles.keyHint}>{activePlatform.keyHint}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={streamKey}
                onChangeText={setStreamKey}
                secureTextEntry={platform !== "custom" && !showKey}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={Colors.outline}
                placeholder={activePlatform.keyPlaceholder}
              />
              {platform !== "custom" && (
                <TouchableOpacity style={styles.iconBtn} onPress={() => setShowKey((v) => !v)}>
                  <Ionicons name={showKey ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.outline} />
                </TouchableOpacity>
              )}
            </View>
          </Card>

          {/* ── Custom RTMP ───────────────────────────────────────── */}
          <SectionHeader title="RTMP SERVER" icon="server-outline" />
          <Card>
            <Text style={styles.keyHint}>Advanced: override the RTMP ingest endpoint</Text>
            <TextInput
              style={styles.input}
              value={rtmpUrl}
              onChangeText={setRtmpUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={Colors.outline}
              placeholder="rtmp://your-server/live"
            />
          </Card>

          {/* ── Camera ────────────────────────────────────────────── */}
          <SectionHeader title="CAMERA" icon="camera-outline" />
          <Card>
            <Text style={styles.fieldLabel}>FACING</Text>
            <SegmentControl
              options={["back", "front"] as const}
              value={cameraFacing as "back" | "front"}
              onChange={setCameraFacing}
            />

            <View style={styles.spacer} />

            <Text style={styles.fieldLabel}>RESOLUTION</Text>
            <SegmentControl
              options={RESOLUTIONS}
              value={resolution as typeof RESOLUTIONS[number]}
              onChange={setResolution}
            />

            <View style={styles.spacer} />

            <Text style={styles.fieldLabel}>FRAME RATE</Text>
            <SegmentControl
              options={FPS_OPTIONS}
              value={fps as typeof FPS_OPTIONS[number]}
              onChange={setFps}
            />
          </Card>

          {/* ── Storage ──────────────────────────────────────────── */}
          <SectionHeader title="STORAGE" icon="server-outline" />
          <Card>
            <RowItem
              label="Local Storage"
              value="45 GB / 128 GB"
            />
            <View style={styles.rowDivider} />
            <RowItem
              label="Auto-Loop Recording"
              right={
                <View style={[styles.toggleSmall, styles.toggleSmallOn]}>
                  <View style={[styles.toggleSmallThumb, styles.toggleSmallThumbOn]} />
                </View>
              }
            />
            <View style={styles.rowDivider} />
            <RowItem
              label="Cloud Sync"
              right={
                <View style={styles.toggleSmall}>
                  <View style={styles.toggleSmallThumb} />
                </View>
              }
            />
            <View style={styles.rowDivider} />
            <RowItem
              label="Format Storage"
              danger
              onPress={handleFormatStorage}
            />
          </Card>

          {/* ── Night Mode ────────────────────────────────────────── */}
          <SectionHeader title="NIGHT MODE" icon="moon-outline" />
          <Card>
            <RowItem
              label="Calibrate Night Vision"
              onPress={() => router.push("/(app)/calibration")}
            />
            <View style={styles.rowDivider} />
            <RowItem
              label="Auto Night Mode"
              right={
                <View style={[styles.toggleSmall, styles.toggleSmallOn]}>
                  <View style={[styles.toggleSmallThumb, styles.toggleSmallThumbOn]} />
                </View>
              }
            />
          </Card>

          {/* ── System ───────────────────────────────────────────── */}
          <SectionHeader title="SYSTEM" icon="hardware-chip-outline" />
          <Card>
            <RowItem label="Firmware Version" value="v2.4.1 (latest)" />
            <View style={styles.rowDivider} />
            <RowItem label="Check for Updates" onPress={() => Alert.alert("Up to date", "You are running the latest firmware.")} />
            <View style={styles.rowDivider} />
            <RowItem label="Device ID" value="SD-7F3A-2B9C" />
            <View style={styles.rowDivider} />
            <RowItem label="Factory Reset" danger onPress={handleFactoryReset} />
          </Card>

          {/* ── Save ─────────────────────────────────────────────── */}
          {saved ? (
            <View style={[styles.saveWrapper, { opacity: 0.75 }]}>
              <LinearGradient
                colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <Ionicons name="checkmark" size={18} color={Colors.primaryFixed} />
                <Text style={styles.saveBtnText}>SAVED</Text>
              </LinearGradient>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.saveWrapper}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              >
                <Text style={styles.saveBtnText}>{saving ? "SAVING…" : "SAVE SETTINGS"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  titleAccent: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 3,
    marginTop: 2,
  },
  scroll: {
    padding: 16,
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    marginBottom: 6,
  },
  sectionTitle: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2.5,
  },
  card: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 10,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1.5,
    borderColor: Colors.tertiaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 17,
    fontWeight: "700",
  },
  accountEmail: {
    color: Colors.onSurface,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
  },
  accountLabel: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 10,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  platformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformTile: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 12,
    borderRadius: Radius.lg,
    alignItems: "center",
    backgroundColor: Colors.surfaceContainerHigh,
  },
  platformTileActive: {
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
  },
  platformTileText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 12,
  },
  platformTileTextActive: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
  },
  keyHint: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 11,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.onSurface,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
  },
  fieldLabel: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2,
  },
  spacer: { height: 4 },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    alignItems: "center",
    backgroundColor: Colors.surfaceContainerLowest,
  },
  segmentActive: {
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
  },
  segmentText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 12,
  },
  segmentTextActive: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontWeight: "700",
  },
  // Row items
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowLabel: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    flex: 1,
  },
  rowLabelDanger: {
    color: Colors.inversePrimary,
  },
  rowValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowValue: {
    color: Colors.outline,
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.outlineVariant,
    opacity: 0.4,
  },
  // Small toggle
  toggleSmall: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.surfaceContainerHighest,
    padding: 2,
    justifyContent: "center",
  },
  toggleSmallOn: {
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
  },
  toggleSmallThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.outline,
  },
  toggleSmallThumbOn: {
    backgroundColor: Colors.tertiaryContainer,
    alignSelf: "flex-end",
  },
  // Save button
  saveWrapper: {
    borderRadius: Radius.full,
    overflow: "hidden",
    marginTop: 16,
    shadowColor: Colors.inversePrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    paddingVertical: 15,
  },
  saveBtnText: {
    color: Colors.primaryFixed,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
