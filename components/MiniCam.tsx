import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Typography } from "@/constants/theme";
import { useCameraState } from "@/contexts/CameraContext";

interface MiniCamProps {
  size?: number;
  active?: boolean;
}

const ASPECT = 16 / 9;

export function MiniCam({ size = 130, active = true }: MiniCamProps) {
  const device = useCameraDevice("back");
  const { isCapturing } = useCameraState();

  const width = Math.round(size * ASPECT);
  const height = size;

  const containerStyle = {
    width,
    height,
    borderRadius: 10,
    overflow: "hidden" as const,
    borderWidth: 1.5,
    borderColor: isCapturing ? Colors.inversePrimary : Colors.tertiaryContainer,
    backgroundColor: Colors.surfaceContainerLowest,
  };

  // Camera is recording/streaming — yield the sensor and show a status badge
  if (isCapturing) {
    return (
      <View style={[containerStyle, styles.placeholder]}>
        <View style={styles.recBadge}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>REC</Text>
        </View>
      </View>
    );
  }

  if (!device) {
    return <View style={containerStyle} />;
  }

  return (
    <View style={containerStyle}>
      <Camera
        device={device}
        isActive={active}
        style={{ width, height }}
        // video/audio default to false — preview only, no recording buffers
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(191,0,43,0.2)",
    borderWidth: 1,
    borderColor: Colors.inversePrimary,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.inversePrimary,
  },
  recText: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headline,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
