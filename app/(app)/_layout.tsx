import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Colors, Typography } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  name,
  focused,
  color,
  size,
}: {
  name: IoniconsName;
  focused: boolean;
  color: string;
  size: number;
}) {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Ionicons name={name} size={size - 6} color={color} />
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.tertiaryContainer,
        tabBarInactiveTintColor: Colors.outline,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Camera",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="videocam" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: "Gallery",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="images-outline" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="map-outline" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: "Logs",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="bar-chart-outline" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="settings-outline" focused={focused} color={color} size={size} />
          ),
        }}
      />

      {/* Hidden screens — accessible via push navigation */}
      <Tabs.Screen name="voice" options={{ href: null }} />
      <Tabs.Screen name="viewer" options={{ href: null }} />
      <Tabs.Screen name="calibration" options={{ href: null }} />
      <Tabs.Screen name="replay" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 0,
    shadowColor: Colors.tertiaryContainer,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabLabel: {
    fontFamily: Typography.headlineMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    position: "relative",
  },
  iconWrapperActive: {
    backgroundColor: Colors.electricCyanDim,
  },
});
