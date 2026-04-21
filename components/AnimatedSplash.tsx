import React, { useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { Colors, Typography } from "@/constants/theme";

interface AnimatedSplashProps {
  onFinish: () => void;
}

/**
 * Plays a short Lottie animation then fades out before calling onFinish.
 * Shown in place of the native splash screen during font/auth loading.
 */
export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  const handleAnimationFinish = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => onFinish());
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <LottieView
        source={require("@/assets/animations/splash.json")}
        autoPlay
        loop={false}
        style={styles.lottie}
        onAnimationFinish={handleAnimationFinish}
      />
      {/* Brand mark — record button aesthetic */}
      <View style={styles.brandMark}>
        <View style={styles.brandRing}>
          <LinearGradient
            colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
            style={styles.brandDot}
          />
        </View>
      </View>
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmark}>STREAM</Text>
        <Text style={styles.wordmarkAccent}>DASH</Text>
      </View>
      <Text style={styles.tagline}>DASHCAM LIVESTREAMING</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    gap: 8,
  },
  lottie: {
    width: 160,
    height: 160,
    marginBottom: 8,
  },
  brandMark: {
    marginBottom: 4,
  },
  brandRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.inversePrimary,
    backgroundColor: Colors.recordRedDim,
    alignItems: "center",
    justifyContent: "center",
  },
  brandDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  wordmark: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 8,
  },
  wordmarkAccent: {
    color: Colors.inversePrimary,
    fontFamily: Typography.headline,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 8,
  },
  tagline: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 4,
    marginTop: -4,
  },
});
