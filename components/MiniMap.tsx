import React, { useRef } from "react";
import { View } from "react-native";
import { MapView, Camera, UserLocation, ShapeSource, LineLayer, type CameraRef } from "@maplibre/maplibre-react-native";
import { Colors, StreamConfig } from "@/constants/theme";
import { GPSPoint } from "@/hooks/useGPS";

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;
const STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
  : "https://demotiles.maplibre.org/style.json";

interface MiniMapProps {
  current: GPSPoint | null;
  trail: GPSPoint[];
  size?: number;
}

export function MiniMap({ current, trail, size = 150 }: MiniMapProps) {
  const cameraRef = useRef<CameraRef>(null);

  const trailCoords = trail
    .slice(-StreamConfig.GPS_TRAIL_MAX)
    .map((p) => [p.lng, p.lat]);

  const trailGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: trailCoords },
    properties: {},
  };

  const mapStyle = { width: size, height: size, borderRadius: 10, overflow: "hidden" as const, borderWidth: 1.5, borderColor: Colors.neonGreen };
  const placeholderStyle = { width: size, height: size, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border };

  if (!current) {
    return <View style={placeholderStyle} />;
  }

  return (
    <MapView style={mapStyle} mapStyle={STYLE_URL} logoEnabled={false} attributionEnabled={false} compassEnabled={false}>
      <Camera
        ref={cameraRef}
        centerCoordinate={[current.lng, current.lat]}
        zoomLevel={15}
        animationDuration={300}
      />
      <UserLocation visible renderMode="native" />
      {trailCoords.length > 1 && (
        <ShapeSource id="miniTrail" shape={trailGeoJSON}>
          <LineLayer
            id="miniTrailLine"
            style={{
              lineColor: Colors.tertiaryContainer,
              lineWidth: 2,
              lineDasharray: [2, 1],
            }}
          />
        </ShapeSource>
      )}
    </MapView>
  );
}

