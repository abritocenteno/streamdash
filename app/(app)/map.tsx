import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Animated,
  Dimensions,
  PanResponder,
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
import { useFocusEffect } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useGPS } from "@/hooks/useGPS";
import { Colors, Typography, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { MiniCam } from "@/components/MiniCam";
import * as Speech from "expo-speech";

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;
const STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
  : "https://demotiles.maplibre.org/style.json";

// ─── Types ────────────────────────────────────────────────────────────────

interface GeocodingFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface RouteStep {
  instruction: string;
  distanceText: string;
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  endLocation: [number, number];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) *
      Math.cos((b[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function formatDist(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m === 0) return "< 1 min";
  return `${m} min`;
}

function stepIcon(
  type: string,
  modifier: string
): React.ComponentProps<typeof Ionicons>["name"] {
  if (type === "arrive") return "location";
  if (type === "depart") return "navigate-outline";
  if (type === "roundabout" || type === "rotary") return "refresh-outline";
  if (modifier === "uturn") return "return-down-back-outline";
  if (modifier === "left" || modifier === "sharp left") return "arrow-back-outline";
  if (modifier === "right" || modifier === "sharp right") return "arrow-forward-outline";
  if (modifier === "slight left") return "arrow-up-outline";
  if (modifier === "slight right") return "arrow-up-outline";
  return "arrow-up-outline";
}

function buildInstruction(type: string, modifier: string, name: string): string {
  const road = name ? ` onto ${name}` : "";
  if (type === "depart") return `Head ${modifier}${road}`;
  if (type === "arrive") return "You have arrived";
  if (type === "turn") {
    if (modifier === "left") return `Turn left${road}`;
    if (modifier === "right") return `Turn right${road}`;
    if (modifier === "slight left") return `Bear left${road}`;
    if (modifier === "slight right") return `Bear right${road}`;
    if (modifier === "sharp left") return `Sharp left${road}`;
    if (modifier === "sharp right") return `Sharp right${road}`;
    if (modifier === "uturn") return "Make a U-turn";
  }
  if (type === "merge") return `Merge${road}`;
  if (type === "on ramp" || type === "ramp") return `Take the ramp${road}`;
  if (type === "off ramp") return `Take the exit${road}`;
  if (type === "roundabout" || type === "rotary") return `Take the roundabout exit${road}`;
  if (type === "fork") return modifier?.includes("left") ? `Keep left${road}` : `Keep right${road}`;
  if (type === "new name" || type === "continue") return `Continue${road}`;
  if (type === "end of road") return modifier === "left" ? `Turn left${road}` : `Turn right${road}`;
  return `Continue${road}`;
}

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
  { id: "1", type: "ACCIDENT",     label: "Accident Ahead", distance: "0.8 km", icon: "warning",      offset: { lat: 0.008,  lng: 0.002  } },
  { id: "2", type: "SPEED_TRAP",   label: "Mobile Trap",    distance: "2.4 km", icon: "camera",       offset: { lat: 0.018,  lng: -0.005 } },
  { id: "3", type: "ROAD_CLOSURE", label: "Lane Closure",   distance: "4.1 km", icon: "alert-circle", offset: { lat: -0.01,  lng: 0.01   } },
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
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── MiniCam PiP ────────────────────────────────────────────────────────────
  const [camActive, setCamActive] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setCamActive(true);
      return () => setCamActive(false);
    }, [])
  );

  const { width: screenW } = Dimensions.get("window");
  const MINICAM_W = Math.round(130 * (16 / 9));
  const MINICAM_H = 130;
  const miniCamPos = useRef(
    new Animated.ValueXY({ x: screenW - MINICAM_W - 16, y: 140 })
  ).current;
  const miniCamPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        miniCamPos.setOffset({
          x: (miniCamPos.x as any)._value,
          y: (miniCamPos.y as any)._value,
        });
        miniCamPos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: miniCamPos.x, dy: miniCamPos.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        miniCamPos.flattenOffset();
      },
    })
  ).current;

  const [showEvents, setShowEvents] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Navigation state
  const [destination, setDestination] = useState<{ name: string; lng: number; lat: number } | null>(null);
  const [route, setRoute] = useState<GeoJSON.Feature<GeoJSON.LineString> | null>(null);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [navStarted, setNavStarted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(13);

  const { location } = useGPS({ enabled: true });
  const sessions = useQuery(api.queries.getSessionHistory, { limit: 1 });

  const trail = sessions?.[0]?.gpsLog ?? [];
  const trailCoords = trail.map((p) => [p.lng, p.lat]);
  const trailGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: trailCoords },
    properties: {},
  };

  const speedKph = location ? (location.speed * 3.6).toFixed(0) : "0";
  const lat = location ? location.lat.toFixed(5) : "0.00000";
  const lng = location ? location.lng.toFixed(5) : "0.00000";

  // Advance route step when user passes within 30 m of step end
  useEffect(() => {
    if (!location || steps.length === 0 || currentStepIdx >= steps.length) return;
    const step = steps[currentStepIdx];
    const dist = haversineMeters(
      [location.lng, location.lat],
      step.endLocation
    );
    if (dist < 30 && currentStepIdx < steps.length - 1) {
      setCurrentStepIdx((i) => i + 1);
    }
  }, [location, steps, currentStepIdx]);

  // Voice guidance — announce each step as it becomes active
  useEffect(() => {
    if (!isNavigating || steps.length === 0) return;
    const step = steps[currentStepIdx];
    if (step) Speech.speak(step.instruction, { language: "en-US", rate: 0.9 });
  }, [currentStepIdx, isNavigating]);

  const centerOnUser = () => {
    if (location) {
      cameraRef.current?.setCamera({
        centerCoordinate: [location.lng, location.lat],
        zoomLevel: 15,
        animationDuration: 500,
      });
    }
  };

  // ── Search ──────────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!MAPTILER_KEY || query.length < 3) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const prox = location ? `&proximity=${location.lng},${location.lat}` : "";
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}${prox}&limit=5`;
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data.features ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [location]
  );

  const onSearchChange = (text: string) => {
    setSearchText(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.length < 3) { setSuggestions([]); return; }
    searchTimeoutRef.current = setTimeout(() => fetchSuggestions(text), 400);
  };

  // ── Route fetch ──────────────────────────────────────────────────────────

  const selectDestination = useCallback(
    async (feature: GeocodingFeature) => {
      Keyboard.dismiss();
      setSuggestions([]);
      setIsSearchFocused(false);
      const [destLng, destLat] = feature.center;
      const destName = feature.place_name;
      setDestination({ name: destName, lng: destLng, lat: destLat });
      setSearchText(destName.split(",")[0]);

      if (!location) return;
      setIsFetchingRoute(true);
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${location.lng},${location.lat};${destLng},${destLat}` +
          `?overview=full&geometries=geojson&steps=true`;
        const res = await fetch(url);
        const data = await res.json();
        const r = data.routes?.[0];
        if (!r) return;

        setRoute({ type: "Feature", geometry: r.geometry, properties: {} });
        setRouteInfo({
          distance: formatDist(r.distance),
          duration: formatDuration(r.duration),
        });

        const parsedSteps: RouteStep[] = (r.legs?.[0]?.steps ?? []).map(
          (s: any) => ({
            instruction: buildInstruction(
              s.maneuver.type,
              s.maneuver.modifier ?? "",
              s.name ?? ""
            ),
            distanceText: formatDist(s.distance),
            iconName: stepIcon(s.maneuver.type, s.maneuver.modifier ?? ""),
            endLocation: s.maneuver.location as [number, number],
          })
        );
        setSteps(parsedSteps);
        setCurrentStepIdx(0);

        // Fit map to route bounds
        const coords = r.geometry.coordinates as [number, number][];
        const lngs = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        cameraRef.current?.fitBounds(
          [Math.max(...lngs), Math.max(...lats)],
          [Math.min(...lngs), Math.min(...lats)],
          60,
          800
        );
      } catch (e) {
        console.warn("Route fetch failed", e);
      } finally {
        setIsFetchingRoute(false);
      }
    },
    [location]
  );

  const clearNavigation = () => {
    Speech.stop();
    setNavStarted(false);
    setDestination(null);
    setRoute(null);
    setSteps([]);
    setCurrentStepIdx(0);
    setRouteInfo(null);
    setSearchText("");
    setSuggestions([]);
    setIsSearchFocused(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const isNavigating = !!destination && !!route && navStarted;
  const currentStep = steps[currentStepIdx] ?? null;
  const showSuggestions = isSearchFocused && suggestions.length > 0;

  return (
    <View style={styles.container}>
      {/* ── Full-screen map ─────────────────────────────────────────── */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        mapStyle={STYLE_URL}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <Camera
          ref={cameraRef}
          followUserLocation={isNavigating}
          followUserMode={isNavigating ? "course" : "normal"}
          centerCoordinate={location ? [location.lng, location.lat] : [-8.6, 41.15]}
          zoomLevel={zoomLevel}
        />

        <UserLocation visible renderMode="native" />

        {/* GPS trail from last session */}
        {trailCoords.length > 1 && (
          <ShapeSource id="trail" shape={trailGeoJSON}>
            <LineLayer
              id="trailLine"
              style={{
                lineColor: Colors.tertiaryContainer,
                lineWidth: 2,
                lineDasharray: [2, 1],
                lineOpacity: 0.5,
              }}
            />
          </ShapeSource>
        )}

        {/* Route — glow + solid layers */}
        {route && (
          <ShapeSource id="route" shape={route}>
            <LineLayer
              id="routeGlow"
              style={{
                lineColor: Colors.tertiaryContainer,
                lineWidth: 14,
                lineOpacity: 0.12,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <LineLayer
              id="routeLine"
              style={{
                lineColor: Colors.tertiaryContainer,
                lineWidth: 4,
                lineOpacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </ShapeSource>
        )}

        {/* Destination marker */}
        {destination && (
          <PointAnnotation
            id="destination"
            coordinate={[destination.lng, destination.lat]}
          >
            <View style={styles.destPin}>
              <Ionicons name="location" size={14} color={Colors.inversePrimary} />
            </View>
          </PointAnnotation>
        )}

        {/* Hazard markers */}
        {showEvents && !isNavigating && location &&
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

      {/* ── Search bar ──────────────────────────────────────────────── */}
      <SafeAreaView style={styles.searchBar} edges={["top"]}>
        <View style={styles.searchInner}>
          {isNavigating ? (
            <Ionicons name="navigate" size={16} color={Colors.tertiaryContainer} />
          ) : (
            <Ionicons name="search-outline" size={16} color={Colors.outline} />
          )}
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={onSearchChange}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
            placeholder="Search destination…"
            placeholderTextColor={Colors.outline}
            returnKeyType="search"
            onSubmitEditing={() => fetchSuggestions(searchText)}
          />
          {isSearching && (
            <ActivityIndicator size="small" color={Colors.tertiaryContainer} />
          )}
          {isNavigating && !isSearching && (
            <TouchableOpacity onPress={clearNavigation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.outline} />
            </TouchableOpacity>
          )}
          {!isNavigating && !isSearching && searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(""); setSuggestions([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.outline} />
            </TouchableOpacity>
          )}
        </View>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <View style={styles.suggestionsCard}>
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.suggestionDivider} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionRow}
                  onPress={() => selectDestination(item)}
                >
                  <Ionicons name="location-outline" size={14} color={Colors.outline} />
                  <View style={styles.suggestionTextWrap}>
                    <Text style={styles.suggestionPrimary} numberOfLines={1}>
                      {item.place_name.split(",")[0]}
                    </Text>
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>
                      {item.place_name.split(",").slice(1).join(",").trim()}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </SafeAreaView>

      {/* ── Turn instruction banner (navigating) ─────────────────────── */}
      {isNavigating && currentStep && (
        <View style={styles.instructionBanner}>
          <View style={styles.instructionIconWrap}>
            {isFetchingRoute ? (
              <ActivityIndicator size="small" color={Colors.tertiaryContainer} />
            ) : (
              <Ionicons name={currentStep.iconName} size={22} color={Colors.tertiaryContainer} />
            )}
          </View>
          <View style={styles.instructionTextWrap}>
            <Text style={styles.instructionText} numberOfLines={2}>
              {currentStep.instruction}
            </Text>
            <Text style={styles.instructionDist}>{currentStep.distanceText}</Text>
          </View>
          {routeInfo && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaDuration}>{routeInfo.duration}</Text>
              <Text style={styles.etaDistance}>{routeInfo.distance}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Bearing / coords card (not navigating) ───────────────────── */}
      {!isNavigating && (
        <View style={styles.bearingCard}>
          <Text style={styles.bearingValue}>GPS</Text>
          <Text style={styles.bearingLabel}>POSITION</Text>
          <View style={styles.coordsMini}>
            <Text style={styles.coordsMiniText}>{lat}° N</Text>
            <Text style={styles.coordsMiniText}>{lng}° W</Text>
          </View>
        </View>
      )}

      {/* ── Speed card ───────────────────────────────────────────────── */}
      <View style={styles.speedCard}>
        <Text style={styles.speedValue}>{speedKph}</Text>
        <Text style={styles.speedUnit}>KM/H</Text>
      </View>

      {/* ── Map controls (right panel) ───────────────────────────────── */}
      <View style={styles.rightPanel}>
        <TouchableOpacity style={styles.mapBtn} onPress={centerOnUser}>
          <Ionicons name="locate-outline" size={18} color={Colors.tertiaryContainer} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => {
            const next = Math.min(zoomLevel + 1, 20);
            setZoomLevel(next);
            cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 300 });
          }}
        >
          <Ionicons name="add-outline" size={18} color={Colors.onSurface} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => {
            const next = Math.max(zoomLevel - 1, 1);
            setZoomLevel(next);
            cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 300 });
          }}
        >
          <Ionicons name="remove-outline" size={18} color={Colors.onSurface} />
        </TouchableOpacity>
        {!isNavigating && (
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
        )}
      </View>

      {/* ── MiniCam PiP ─────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.miniCamFloat, { left: miniCamPos.x, top: miniCamPos.y }]}
        {...miniCamPanResponder.panHandlers}
      >
        <MiniCam size={MINICAM_H} active={camActive} />
      </Animated.View>

      {/* ── Nearby events card (not navigating) ─────────────────────── */}
      {showEvents && !isNavigating && !destination && location && (
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

      {/* ── Pre-nav confirmation card ────────────────────────────────── */}
      {destination && route && !navStarted && (
        <View style={styles.preNavCard}>
          <View style={styles.preNavInfo}>
            <Ionicons name="navigate" size={16} color={Colors.tertiaryContainer} />
            <View style={styles.preNavTextWrap}>
              <Text style={styles.preNavDest} numberOfLines={1}>
                {destination.name.split(",")[0]}
              </Text>
              {routeInfo && (
                <Text style={styles.preNavMeta}>
                  {routeInfo.duration} · {routeInfo.distance}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.preNavButtons}>
            <TouchableOpacity style={styles.preNavCancel} onPress={clearNavigation}>
              <Text style={styles.preNavCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.preNavStart}
              onPress={() => {
                setNavStarted(true);
                if (steps.length > 0) {
                  Speech.speak(steps[0].instruction, { language: "en-US", rate: 0.9 });
                }
              }}
            >
              <Ionicons name="navigate" size={14} color={Colors.background} />
              <Text style={styles.preNavStartText}>Start</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── End navigation button ────────────────────────────────────── */}
      {isNavigating && (
        <View style={styles.endNavWrapper}>
          <TouchableOpacity style={styles.endNavBtn} onPress={clearNavigation}>
            <Ionicons name="stop-circle" size={16} color={Colors.error} />
            <Text style={styles.endNavText}>End Navigation</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  miniCamFloat: {
    position: "absolute",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── Search
  searchBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
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

  // ── Suggestions
  suggestionsCard: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
    marginTop: 6,
    maxHeight: 240,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 10,
  },
  suggestionDivider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginHorizontal: 16,
  },
  suggestionTextWrap: { flex: 1 },
  suggestionPrimary: {
    color: Colors.onSurface,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
  },
  suggestionSecondary: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 11,
    marginTop: 1,
  },

  // ── Turn instruction banner
  instructionBanner: {
    position: "absolute",
    top: 90,
    left: 16,
    right: 16,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  instructionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.electricCyanDim,
    borderWidth: 1,
    borderColor: Colors.tertiaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionTextWrap: { flex: 1 },
  instructionText: {
    color: Colors.onSurface,
    fontFamily: Typography.headlineMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  instructionDist: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headline,
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 3,
  },
  etaBadge: {
    alignItems: "flex-end",
    gap: 1,
  },
  etaDuration: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
  },
  etaDistance: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // ── Bearing card
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

  // ── Speed card
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

  // ── Map controls
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

  // ── Destination pin
  destPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(191,0,43,0.2)",
    borderWidth: 2,
    borderColor: Colors.inversePrimary,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Hazard markers
  hazardMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainerHighest,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Events card
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

  // ── Pre-nav card
  preNavCard: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    gap: 12,
  },
  preNavInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  preNavTextWrap: { flex: 1 },
  preNavDest: {
    color: Colors.onSurface,
    fontFamily: Typography.headlineMedium,
    fontSize: 14,
    fontWeight: "700",
  },
  preNavMeta: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 11,
    marginTop: 2,
  },
  preNavButtons: { flexDirection: "row", gap: 8 },
  preNavCancel: {
    flex: 1,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  preNavCancelText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
  },
  preNavStart: {
    flex: 2,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.tertiaryContainer,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  preNavStartText: {
    color: Colors.background,
    fontFamily: Typography.headlineMedium,
    fontSize: 13,
    fontWeight: "700",
  },

  // ── End nav button
  endNavWrapper: {
    position: "absolute",
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  endNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: "rgba(191,0,43,0.15)",
    borderWidth: 1.5,
    borderColor: Colors.error,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  endNavText: {
    color: Colors.error,
    fontFamily: Typography.headlineMedium,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
