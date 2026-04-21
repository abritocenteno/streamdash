import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useFonts } from "expo-font";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { setAccessToken } from "@maplibre/maplibre-react-native";

// MapLibre is used without Mapbox — suppress the missing-token warning
setAccessToken(null);

SplashScreen.preventAutoHideAsync();

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL as string
);

// Clerk token cache backed by SecureStore (persists across restarts)
const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

function AuthGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAppGroup = segments[0] === "(app)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && !inAppGroup) {
      router.replace("/(app)");
    }
  }, [isSignedIn, isLoaded, segments]);

  return <Slot />;
}

function RootLayoutInner({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { isLoaded: clerkLoaded } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const ready = fontsLoaded && clerkLoaded;

  // Hide the native splash screen immediately — AnimatedSplash takes over
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <AuthGuard />
      {/* Overlay the animated splash until fonts + Clerk are ready */}
      {(!splashDone || !ready) && (
        <AnimatedSplash
          onFinish={() => setSplashDone(true)}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    ...FontAwesome5.font,
    ...Ionicons.font,
  });

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#111318" }}>
      <ClerkProvider
        publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
        tokenCache={tokenCache}
      >
        <ClerkLoaded>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <RootLayoutInner fontsLoaded={fontsLoaded} />
          </ConvexProviderWithClerk>
        </ClerkLoaded>
      </ClerkProvider>
    </View>
  );
}
