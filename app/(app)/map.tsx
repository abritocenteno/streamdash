import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";
import {
  MapView,
  Camera,
  UserLocation,
  ShapeSource,
  LineLayer,
  PointAnnotation,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useGPS } from "@/hooks/useGPS";
import { Colors, Typography, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;
const STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
  : "https://demotiles.maplibre.org/style.json";

// ─── Mock nearby events ────────────────────────────────────────────────────

interface HazardEvent {
  id: string;
  type: "ACCIDENT" | "SPEED_TRAP" | "ROAD_CLOSURE" | "WEATHER";
  label: string;
  distance: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  offset: { lat: number; lng: number };
}

const MOCK_HAZARDS: HazardEvent[] = [
  { id: "1", type: "ACCIDENT",     label: "Accident Ahead", distance: "0.8 mi", icon: "warning",      offset: { lat: 0.008,  lng: 0.002  } },
  { id: "2", type: "SPEED_TRAP",   label: "Mobile Trap",    distance: "2.4 mi", icon: "camera",       offset: { lat: 0.018,  lng: -0.005 } },
  { id: "3", type: "ROAD_CLOSURE", label: "Lane Closure",   distance: "4.1 mi", icon: "alert-circle", offset: { lat: -0.01,  lng: 0.01   } },
];

const HAZARD_COLORS: Record<HazardEvent["type"], string> = {
  ACCIDENT:     Colors.inversePrimary,
  SPEED_TRAP:   Colors.secondary,
  ROAD_CLOSURE: Colors.error,
  WEATHER:      Colors.tertiary,
};

// ─── Screen ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const cameraRef = useRef<CameraRef>(null);
  const [showEvents, setShowEvents] = useState(true);
  const [searchText, setSearchText] = useState("");

  const { location } = useGPS({ enabled: true });
  const sessions = useQuery(api.queries.getSessionHistory, { limit: 1 });

  const trail = sessions?.[0]?.gpsLog ?? [];
  const trailCoords = trail.map((p) => [p.lng, p.lat]);

  const trailGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: trailCoords },
    properties: {},
  };

  const speedMph = location ? (location.speed * 2.237).toFixed(0) : "0";
  const lat = location ? location.lat.toFixed(5) : "0.00000";
  const lng = location ? location.lng.toFixed(5) : "0.00000";
  const bearing = "284° WNW";

  const centerOnUser = () => {
    if (location) {
      cameraRef.current?.setCamera({
        centerCoordinate: [location.lng, location.lat],
        zoomLevel: 15,
        animationDuration: 500,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        mapStyle={STYLE_URL}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <Camera
          ref={cameraRef}
          centerCoordinate={
            location ? [location.lng, location.lat] : [-122.4194, 37.7749]
          }
          zoomLevel={13}
        />

        <UserLocation visible renderMode="native" />

        {/* GPS trail from last session */}
        {trailCoords.length > 1 && (
          <ShapeSource id="trail" shape={trailGeoJSON}>
            <LineLayer
              id="trailLine"
              style={{
                lineColor: Colors.tertiaryContainer,
                lineWidth: 2.5,
                lineDasharray: [2, 1],
              }}
            />
          </ShapeSource>
        )}

        {/* Hazard markers */}
        {showEvents && location &&
          MOCK_HAZARDS.map((h) => (
            <PointAnnotation
              key={h.id}
              id={h.id}
              coordinate={[
                location.lng + h.offset.lng,
                location.lat + h.offset.lat,
              ]}
            >
              <View style={[styles.hazardMarker, { borderColor: HAZARD_COLORS[h.type] }]}>
                <Ionicons name={h.icon} size={12} color={HAZARD_COLORS[h.type]} />
              </View>
            </PointAnnotation>
          ))}
      </MapView>

      {/* Search bar — top */}
      <SafeAreaView style={styles.searchBar} edges={["top"]}>
        <View style={styles.searchInner}>
          <Ionicons name="search-outline" size={16} color={Colors.outline} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search destination…"
            placeholderTextColor={Colors.outline}
          />
          <TouchableOpacity>
            <Ionicons name="mic-outline" size={16} color={Colors.tertiaryContainer} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bearing card — top left */}
      <View style={styles.bearingCard}>
        <Text style={styles.bearingValue}>{bearing}</Text>
        <Text style={styles.bearingLabel}>HEADING</Text>
        <View style={styles.coordsMini}>
          <Text style={styles.coordsMiniText}>{lat}° N</Text>
          <Text style={styles.coordsMiniText}>{lng}° W</Text>
        </View>
      </View>

      {/* Speed — bottom left */}
      <View style={styles.speedCard}>
        <Text style={styles.speedValue}>{speedMph}</Text>
        <Text style={styles.speedUnit}>MPH</Text>
      </View>

      {/* Map controls — bottom right */}
      <View style={styles.rightPanel}>
        <TouchableOpacity style={styles.mapBtn} onPress={centerOnUser}>
          <Ionicons name="locate-outline" size={18} color={Colors.tertiaryContainer} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapBtn}>
          <Ionicons name="add-outline" size={18} color={Colors.onSurface} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapBtn}>
          <Ionicons name="remove-outline" size={18} color={Colors.onSurface} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mapBtn, showEvents && styles.mapBtnActive]}
          onPress={() => setShowEvents((v) => !v)}
        >
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={showEvents ? Colors.tertiaryContainer : Colors.outline}
          />
        </TouchableOpacity>
      </View>

      {/* Nearby events card */}
      {showEvents && location && (
        <View style={styles.eventsCard}>
          <Text style={styles.eventsTitle}>NEARBY EVENTS</Text>
          {MOCK_HAZARDS.slice(0, 2).map((h) => (
            <View key={h.id} style={styles.eventRow}>
              <View style={[styles.eventDot, { backgroundColor: HAZARD_COLORS[h.type] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventLabel}>{h.label}</Text>
              </View>
              <Text style={styles.eventDist}>{h.distance}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    color: Colors.onSurface,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
  },
  bearingCard: {
    position: "absolute",
    top: 90,
    left: 16,
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center",
    gap: 2,
  },
  bearingValue: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bearingLabel: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 8,
    letterSpacing: 2,
  },
  coordsMini: { marginTop: 4, gap: 1 },
  coordsMiniText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.headlineRegular,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  speedCard: {
    position: "absolute",
    bottom: 100,
    left: 20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.glassBg,
    borderWidth: 2,
    borderColor: Colors.tertiaryContainer,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.tertiaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  speedValue: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 34,
  },
  speedUnit: {
    color: Colors.tertiaryFixedDim,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2,
  },
  rightPanel: { position: "absolute", right: 16, bottom: 100, gap: 8 },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  mapBtnActive: {
    backgroundColor: Colors.electricCyanDim,
    borderColor: Colors.tertiaryContainer,
  },
  hazardMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainerHighest,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  eventsCard: {
    position: "absolute",
    bottom: 100,
    left: 120,
    right: 70,
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: 8,
  },
  eventsTitle: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 2.5,
  },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventLabel: { color: Colors.onSurface, fontFamily: Typography.bodyMedium, fontSize: 11 },
  eventDist: { color: Colors.outline, fontFamily: Typography.headlineMedium, fontSize: 10, letterSpacing: 0.5 },
});
