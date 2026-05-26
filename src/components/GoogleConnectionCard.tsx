import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useBooklio } from "../data/BooklioContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { colors, fonts, radii, spacing } from "../theme/theme";
import { buildAppleDisplayName, getGoogleAuthConfig } from "../utils/googleAuth";

WebBrowser.maybeCompleteAuthSession();

export function GoogleConnectionCard() {
  const { connectIdentityAccount, disconnectIdentityAccount, userProfile } = useBooklio();
  const [activeProvider, setActiveProvider] = useState<"google" | "apple" | null>(null);
  const config = useMemo(() => getGoogleAuthConfig(), []);
  const isNative = Platform.OS === "ios" || Platform.OS === "android";
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const isAppleAvailable = Platform.OS === "ios";
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "booklio",
    path: "oauth"
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: config.androidClientId,
    iosClientId: config.iosClientId,
    webClientId: config.webClientId,
    responseType: AuthSession.ResponseType.Token,
    scopes: ["openid", "profile", "email"],
    selectAccount: true,
    redirectUri
  });

  useEffect(() => {
    if (!isNative || isExpoGo) return;

    GoogleSignin.configure({
      webClientId: config.webClientId,
      iosClientId: config.iosClientId,
      profileImageSize: 120
    });
  }, [config.iosClientId, config.webClientId, isExpoGo, isNative]);

  useEffect(() => {
    const load = async () => {
      if (Platform.OS !== "web") return;
      if (response?.type !== "success") return;

      const accessToken = response.authentication?.accessToken ?? response.params.access_token;
      if (!accessToken) {
        Alert.alert("Google sign-in", "Google returned successfully, but Booklio did not receive an access token.");
        return;
      }

      setActiveProvider("google");
      try {
        const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }).then((result) => result.json() as Promise<{
          sub?: string;
          email?: string;
          name?: string;
          picture?: string;
          given_name?: string;
          family_name?: string;
        }>);

        if (!userInfo.sub || !userInfo.name) {
          throw new Error("Incomplete Google profile.");
        }

        if (supabase && response.params.id_token) {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: response.params.id_token
          });
          if (error) {
            throw error;
          }
        }

        await connectIdentityAccount({
          id: userInfo.sub,
          provider: "google",
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          givenName: userInfo.given_name,
          familyName: userInfo.family_name
        });

      } catch {
        Alert.alert("Google sign-in", "Booklio could not finish syncing your Google profile.");
      } finally {
        setActiveProvider(null);
      }
    };

    void load();
  }, [connectIdentityAccount, response]);

  const handleGoogleSignIn = async () => {
    if (Platform.OS === "web") {
      setActiveProvider("google");
      try {
        await promptAsync();
      } finally {
        setActiveProvider(null);
      }
      return;
    }

    if (isExpoGo) {
      Alert.alert(
        "Development build required",
        "Google Sign-In for iPhone and Android needs a development build or production build. Expo Go cannot complete this native flow."
      );
      return;
    }

    setActiveProvider("google");
    try {
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const result = await GoogleSignin.signIn();
      if (result.type !== "success") {
        return;
      }

      const account = result.data.user;
      const tokens = (await GoogleSignin.getTokens()) as { idToken?: string; accessToken?: string };
      const idToken = (result as { data?: { idToken?: string } }).data?.idToken ?? tokens.idToken;

      if (supabase && idToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken
        });
        if (error) {
          throw error;
        }
      }

      await connectIdentityAccount({
        id: account.id,
        provider: "google",
        email: account.email,
        name: account.name ?? account.email,
        picture: account.photo ?? undefined,
        givenName: account.givenName ?? undefined,
        familyName: account.familyName ?? undefined
      });

    } catch (error) {
      console.error("Booklio native Google sign-in failed", error);
      Alert.alert(
        "Google sign-in",
        "Booklio could not finish the native Google sign-in flow. Double-check the iOS/Android client IDs and Android SHA-1 setup."
      );
    } finally {
      setActiveProvider(null);
    }
  };

  const handleAppleSignIn = async () => {
    if (!isAppleAvailable) {
      Alert.alert("Apple Sign In", "Apple Sign In is only available on Apple devices.");
      return;
    }

    setActiveProvider("apple");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      });

      const displayName = buildAppleDisplayName({
        fullName: credential.fullName ?? undefined,
        fallbackName: userProfile.name,
        fallbackEmail: credential.email ?? userProfile.email
      });

      if (supabase && credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken
        });
        if (error) {
          throw error;
        }
      }

      await connectIdentityAccount({
        id: credential.user,
        provider: "apple",
        email: credential.email ?? userProfile.email,
        name: displayName,
        givenName: credential.fullName?.givenName ?? undefined,
        familyName: credential.fullName?.familyName ?? undefined
      });

    } catch (error) {
      if (error instanceof Error && error.message?.includes("ERR_REQUEST_CANCELED")) {
        return;
      }
      console.error("Booklio Apple sign-in failed", error);
      Alert.alert("Apple Sign In", "Booklio could not finish linking your Apple identity.");
    } finally {
      setActiveProvider(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (userProfile.authProvider === "google" && isNative && !isExpoGo) {
        await GoogleSignin.signOut();
      }
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("Booklio sign-out failed", error);
    } finally {
      await disconnectIdentityAccount();
    }
  };

  const isConnected = Boolean(userProfile.authProvider);
  const isGoogleBusy = activeProvider === "google";
  const isAppleBusy = activeProvider === "apple";
  const isGoogleDisabled = isGoogleBusy || activeProvider === "apple" || (Platform.OS === "web" && !request);
  const providerLabel = userProfile.authProvider === "apple" ? "Apple" : "Google";
  const providerSupportCopy = userProfile.authProvider === "apple"
    ? "Best for iPhone-first onboarding."
    : "Best for cross-device profile continuity.";

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{isConnected ? "Identity provider" : "Connected identity"}</Text>
        <Text style={styles.title}>{isConnected ? providerLabel : "Choose how you enter Booklio"}</Text>
        <Text style={styles.body}>
          {isConnected
            ? userProfile.email ?? "Your account is linked and ready."
            : "Keep account connections here. Your reader dashboard stays focused on books, progress, and what comes next."}
        </Text>
        {!isConnected && isSupabaseConfigured ? (
          <Text style={styles.cloudHint}>Booklio can also sync this profile to your cloud library.</Text>
        ) : null}
      </View>

      {isConnected ? (
        <View style={styles.connectedWrap}>
          <View style={styles.connectedRow}>
            {userProfile.avatarUri ? (
              <Image source={{ uri: userProfile.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, userProfile.authProvider === "apple" && styles.avatarFallbackApple]}>
                <Ionicons
                  name={userProfile.authProvider === "apple" ? "logo-apple" : "logo-google"}
                  size={18}
                  color={colors.card}
                />
              </View>
            )}
            <View style={styles.providerCopy}>
              <Text style={styles.providerName}>Using {providerLabel}</Text>
              <Text style={styles.providerMeta}>{providerSupportCopy}</Text>
            </View>
          </View>
          <Pressable style={styles.disconnectButton} onPress={() => void handleDisconnect()}>
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.optionsWrap}>
          <Pressable
            style={[styles.connectButton, isGoogleDisabled && styles.connectButtonDisabled]}
            disabled={isGoogleDisabled}
            onPress={() => {
              void handleGoogleSignIn();
            }}
          >
            {isGoogleBusy ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <Ionicons name="logo-google" size={16} color={colors.card} />
            )}
            <Text style={styles.connectButtonText}>{isGoogleBusy ? "Connecting..." : "Continue with Google"}</Text>
          </Pressable>

          {isAppleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              cornerRadius={999}
              onPress={() => {
                void handleAppleSignIn();
              }}
              style={styles.appleButton}
            />
          ) : (
            <View style={styles.appleUnavailable}>
              <Ionicons name="logo-apple" size={16} color={colors.navy} />
              <Text style={styles.appleUnavailableText}>Apple Sign In appears on iPhone and iPad builds.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  copy: {
    marginBottom: spacing.sm
  },
  eyebrow: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  cloudHint: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8
  },
  connectedWrap: {
    gap: spacing.md
  },
  connectedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  providerCopy: {
    flex: 1
  },
  providerName: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  providerMeta: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 2
  },
  avatar: {
    borderRadius: 20,
    height: 40,
    width: 40
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: colors.tealDark,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  avatarFallbackApple: {
    backgroundColor: colors.navy
  },
  disconnectButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  disconnectButtonText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  optionsWrap: {
    gap: spacing.sm
  },
  connectButton: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 13
  },
  connectButtonDisabled: {
    opacity: 0.7
  },
  connectButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  appleButton: {
    height: 48,
    width: "100%"
  },
  appleUnavailable: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  appleUnavailableText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700"
  }
});
