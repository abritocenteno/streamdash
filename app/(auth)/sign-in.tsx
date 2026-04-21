import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Colors, Typography, Radius } from "@/constants/theme";
import { useGoogleOAuth } from "@/hooks/useGoogleOAuth";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleOAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyError = error || googleError;
  const anyLoading = loading || googleLoading;

  const handleSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(app)");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Sign in failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          {/* Brand mark — record button aesthetic */}
          <View style={styles.brandMark}>
            {/* Outer ring */}
            <View style={styles.brandRingOuter}>
              {/* Inner gradient dot */}
              <LinearGradient
                colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
                style={styles.brandDot}
              />
            </View>
          </View>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>STREAM</Text>
            <Text style={[styles.logoText, styles.logoAccent]}>DASH</Text>
          </View>
          <Text style={styles.subtitle}>Dashcam Livestreaming</Text>
        </View>

        <View style={styles.form}>
          {anyError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{anyError}</Text>
            </View>
          )}

          {/* Google OAuth */}
          <TouchableOpacity
            style={[styles.googleButton, anyLoading && { opacity: 0.6 }]}
            onPress={signInWithGoogle}
            disabled={anyLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={Colors.onSurface} size="small" />
            ) : (
              <>
                <Image
                  source={{ uri: "https://www.google.com/favicon.ico" }}
                  style={styles.googleIcon}
                />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholderTextColor={Colors.outline}
            placeholder="you@example.com"
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholderTextColor={Colors.outline}
            placeholder="••••••••"
          />

          <TouchableOpacity
            style={[styles.buttonWrapper, (anyLoading || !email || !password) && { opacity: 0.5 }]}
            onPress={handleSignIn}
            disabled={anyLoading || !email || !password}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color={Colors.primaryFixed} />
              ) : (
                <Text style={styles.buttonText}>SIGN IN</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
    gap: 10,
  },
  brandMark: {
    marginBottom: 4,
  },
  brandRingOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.inversePrimary,
    backgroundColor: Colors.recordRedDim,
    alignItems: "center",
    justifyContent: "center",
  },
  brandDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoText: {
    color: Colors.onSurface,
    fontFamily: Typography.headline,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 4,
  },
  logoAccent: {
    color: Colors.inversePrimary,
  },
  subtitle: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  form: {
    gap: 8,
  },
  errorBox: {
    backgroundColor: Colors.recordRedDim,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.inversePrimary,
  },
  errorText: {
    color: Colors.inversePrimary,
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
  },
  label: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: Colors.onSurface,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
  },
  buttonWrapper: {
    borderRadius: Radius.full,
    overflow: "hidden",
    marginTop: 24,
    shadowColor: Colors.inversePrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    borderRadius: Radius.full,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.primaryFixed,
    fontFamily: Typography.headline,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: Colors.outline,
    fontFamily: Typography.body,
    fontSize: 13,
  },
  footerLink: {
    color: Colors.tertiaryContainer,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  googleIcon: {
    width: 18,
    height: 18,
    borderRadius: 2,
  },
  googleButtonText: {
    color: Colors.onSurface,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.outlineVariant,
  },
  dividerText: {
    color: Colors.outline,
    fontFamily: Typography.headlineMedium,
    fontSize: 10,
    letterSpacing: 2,
  },
});
