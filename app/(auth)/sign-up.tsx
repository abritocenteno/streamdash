import { useSignUp } from "@clerk/clerk-expo";
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

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleOAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyError = error || googleError;
  const anyLoading = loading || googleLoading;

  const handleSignUp = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(app)");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
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
          <View style={styles.brandRingOuter}>
            <LinearGradient
              colors={[Colors.onPrimaryContainer, Colors.inversePrimary]}
              style={styles.brandDot}
            />
          </View>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>STREAM</Text>
            <Text style={[styles.logoText, styles.logoAccent]}>DASH</Text>
          </View>
          <Text style={styles.subtitle}>
            {pendingVerification ? "VERIFY EMAIL" : "CREATE ACCOUNT"}
          </Text>
        </View>

        <View style={styles.form}>
          {anyError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{anyError}</Text>
            </View>
          )}

          {!pendingVerification && (
            <>
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
            </>
          )}

          {!pendingVerification ? (
            <>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={Colors.outline}
                placeholder="you@example.com"
              />
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={Colors.outline}
                placeholder="min 8 characters"
              />
              <TouchableOpacity
                style={[styles.buttonWrapper, (anyLoading || !email || !password) && { opacity: 0.5 }]}
                onPress={handleSignUp}
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
                    <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.hintText}>
                We sent a code to {email}. Enter it below to verify your account.
              </Text>
              <Text style={styles.label}>VERIFICATION CODE</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholderTextColor={Colors.outline}
                placeholder="123456"
              />
              <TouchableOpacity
                style={[styles.buttonWrapper, (loading || !code) && { opacity: 0.5 }]}
                onPress={handleVerify}
                disabled={loading || !code}
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
                    <Text style={styles.buttonText}>VERIFY</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign in</Text>
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
  brandRingOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.inversePrimary,
    backgroundColor: Colors.recordRedDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
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
  hintText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
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
