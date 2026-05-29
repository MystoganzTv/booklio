import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
// @react-native-google-signin is NOT bundled in Expo Go — lazy-requiring it
// inside the functions that use it prevents the "Native module not found" crash.
type _GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");
function getGoogleSignin() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("@react-native-google-signin/google-signin") as _GoogleSigninModule).GoogleSignin;
}
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useBooklio } from "../data/BooklioContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList } from "../navigation/types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";
import { buildAppleDisplayName, getGoogleAuthConfig } from "../utils/googleAuth";
import { IS_EXPO_GO, DEV_MOCK_USER } from "../utils/devUtils";

WebBrowser.maybeCompleteAuthSession();

type GoogleConnectionCardProps = {
  variant?: "settings" | "onboarding";
};

export function GoogleConnectionCard({ variant = "settings" }: GoogleConnectionCardProps) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { t } = useI18n();
  const { connectIdentityAccount, disconnectIdentityAccount, userProfile } = useBooklio();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
    if (!isNative || isExpoGo) return; // GoogleSignin not available in Expo Go

    getGoogleSignin().configure({
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
        Alert.alert(t("auth.googleFailedTitle"), t("auth.googleFailedBody"));
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
        Alert.alert(t("auth.googleFailedTitle"), t("auth.googleFailedBody"));
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
        t("auth.devBuildTitle"),
        t("auth.devBuildBody")
      );
      return;
    }

    // Guard: detect unconfigured placeholder client IDs before hitting the native SDK
    if (Platform.OS === "ios" && (!config.iosClientId || config.iosClientId.includes("TU_"))) {
      Alert.alert(
        "Google Sign-In not set up",
        "Add your iOS Client ID from Google Cloud Console to app.json → extra → googleAuth → iosClientId, then rebuild."
      );
      return;
    }

    setActiveProvider("google");
    try {
      if (Platform.OS === "android") {
        await getGoogleSignin().hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const result = await getGoogleSignin().signIn();
      if (result.type !== "success") {
        return;
      }

      const account = result.data.user;
      const tokens = (await getGoogleSignin().getTokens()) as { idToken?: string; accessToken?: string };
      const idToken = (result as { data?: { idToken?: string } }).data?.idToken ?? tokens.idToken;

      // Supabase cloud sync — non-fatal on native iOS/Android because the id_token
      // audience will be the iOS/Android client ID, not the web client ID Supabase
      // expects. Local profile linking always succeeds regardless.
      if (supabase && idToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken
        });
        if (error) {
          console.warn("Booklio: Supabase cloud sync skipped for native Google sign-in:", error.message);
          // Do NOT throw — local profile linking works fine without cloud sync.
          // To enable cloud sync on native, add your iOS/Android client IDs to
          // the Supabase dashboard → Authentication → Providers → Google →
          // "Authorized Client IDs".
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
      Alert.alert(t("auth.googleFailedTitle"), t("auth.googleFailedBody"));
    } finally {
      setActiveProvider(null);
    }
  };

  const handleAppleSignIn = async () => {
    if (!isAppleAvailable) {
      Alert.alert(t("auth.appleUnavailableTitle"), t("auth.appleUnavailableBody"));
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
      Alert.alert(t("auth.appleUnavailableTitle"), t("auth.appleFailedBody"));
    } finally {
      setActiveProvider(null);
    }
  };

  const handleDevMockLogin = async () => {
    setActiveProvider("google");
    try {
      await connectIdentityAccount(DEV_MOCK_USER);
    } catch {
      Alert.alert("Dev mock login failed", "Could not connect mock account.");
    } finally {
      setActiveProvider(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (userProfile.authProvider === "google" && isNative && !isExpoGo) {
        await getGoogleSignin().signOut();
      }
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("Booklio sign-out failed", error);
    } finally {
      await disconnectIdentityAccount();
      navigation.navigate("Welcome");
    }
  };

  const isConnected = Boolean(userProfile.authProvider);
  const isGoogleBusy = activeProvider === "google";
  const isAppleBusy = activeProvider === "apple";
  const isGoogleDisabled = isGoogleBusy || activeProvider === "apple" || (Platform.OS === "web" && !request);
  const providerLabel = userProfile.authProvider === "apple" ? t("auth.providerApple") : t("auth.providerGoogle");
  const providerSupportCopy = userProfile.authProvider === "apple"
    ? t("auth.providerAppleMeta")
    : t("auth.providerGoogleMeta");
  const isOnboarding = variant === "onboarding";

  return (
    <View style={[styles.card, isOnboarding && styles.cardOnboarding]}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>
          {isConnected ? t("auth.connectedEyebrow") : isOnboarding ? t("auth.onboardingEyebrow") : t("auth.settingsEyebrow")}
        </Text>
        <Text style={styles.title}>
          {isConnected
            ? t("auth.connectedTitle", { provider: providerLabel })
            : isOnboarding
              ? t("auth.onboardingTitle")
              : t("auth.settingsTitle")}
        </Text>
        <Text style={styles.body}>
          {isConnected
            ? t("auth.connectedBody", { email: userProfile.email ?? "—" })
            : isOnboarding
              ? t("auth.onboardingBody")
              : t("auth.settingsBody")}
        </Text>
        {!isConnected && isSupabaseConfigured ? (
          <Text style={styles.cloudHint}>{t("auth.cloudHint")}</Text>
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
                  color={c.surface}
                />
              </View>
            )}
            <View style={styles.providerCopy}>
              <Text style={styles.providerName}>{t("auth.usingProvider", { provider: providerLabel })}</Text>
              <Text style={styles.providerMeta}>{providerSupportCopy}</Text>
            </View>
          </View>
          <Pressable style={styles.disconnectButton} onPress={() => void handleDisconnect()}>
            <Text style={styles.disconnectButtonText}>{t("auth.disconnect")}</Text>
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
              <ActivityIndicator size="small" color={isGoogleDisabled ? c.ink : "#FFFFFF"} />
            ) : (
              <Ionicons name="logo-google" size={16} color={isGoogleDisabled ? c.ink : "#FFFFFF"} />
            )}
            <Text style={[styles.connectButtonText, isGoogleDisabled && styles.connectButtonTextDisabled]}>
              {isGoogleBusy ? `${t("auth.providerGoogle")}…` : t("auth.googleButton")}
            </Text>
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
              <Ionicons name="logo-apple" size={16} color={c.ink} />
              <Text style={styles.appleUnavailableText}>{t("auth.appleUnavailableBody")}</Text>
            </View>
          )}

          {IS_EXPO_GO ? (
            <Pressable
              style={styles.devMockButton}
              onPress={() => { void handleDevMockLogin(); }}
              disabled={isGoogleBusy}
            >
              <Ionicons name="code-slash-outline" size={15} color={c.teal} />
              <Text style={styles.devMockText}>Continue as Dev (Expo Go)</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.md
    },
    cardOnboarding: {
      ...shadows.card,
      borderRadius: 30,
      padding: spacing.lg
    },
    copy: {
      marginBottom: spacing.sm
    },
    eyebrow: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase"
    },
    title: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      marginTop: 4
    },
    body: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6
    },
    cloudHint: {
      color: c.tealDark,
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
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900"
    },
    providerMeta: {
      color: c.muted,
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
      backgroundColor: c.tealDark,
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      width: 40
    },
    avatarFallbackApple: {
      backgroundColor: c.navy
    },
    disconnectButton: {
      alignItems: "center",
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: 10
    },
    disconnectButtonText: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900"
    },
    optionsWrap: {
      gap: spacing.sm
    },
    connectButton: {
      alignItems: "center",
      backgroundColor: c.tealDark,
      borderColor: c.tealDark,
      borderWidth: 1,
      borderRadius: radii.pill,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      paddingVertical: 13
    },
    connectButtonDisabled: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.border
    },
    connectButtonText: {
      color: "#FFFFFF",
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900"
    },
    connectButtonTextDisabled: {
      color: c.ink
    },
    appleButton: {
      height: 48,
      width: "100%"
    },
    appleUnavailable: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing.md
    },
    appleUnavailableText: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700"
    },
    devMockButton: {
      alignItems: "center",
      borderColor: c.teal,
      borderRadius: radii.pill,
      borderStyle: "dashed",
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      paddingVertical: 10
    },
    devMockText: {
      color: c.teal,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800"
    }
  });
}
