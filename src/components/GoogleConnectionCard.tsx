import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useBooklio } from "../data/BooklioContext";
import { colors, fonts, radii, spacing } from "../theme/theme";
import { getGoogleAuthConfig } from "../utils/googleAuth";

WebBrowser.maybeCompleteAuthSession();

export function GoogleConnectionCard() {
  const { connectGoogleAccount, disconnectGoogleAccount, userProfile } = useBooklio();
  const [isBusy, setIsBusy] = useState(false);
  const config = useMemo(() => getGoogleAuthConfig(), []);
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
    const load = async () => {
      if (response?.type !== "success") return;

      const accessToken = response.authentication?.accessToken ?? response.params.access_token;
      if (!accessToken) {
        Alert.alert("Google sign-in", "Google returned successfully, but Booklio did not receive an access token.");
        return;
      }

      setIsBusy(true);
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

        if (!userInfo.sub || !userInfo.email || !userInfo.name) {
          throw new Error("Incomplete Google profile.");
        }

        await connectGoogleAccount({
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          givenName: userInfo.given_name,
          familyName: userInfo.family_name
        });

        Alert.alert("Google connected", "Your Booklio profile is now linked to Google.");
      } catch {
        Alert.alert("Google sign-in", "Booklio could not finish syncing your Google profile.");
      } finally {
        setIsBusy(false);
      }
    };

    load();
  }, [connectGoogleAccount, response]);

  const isConnected = userProfile.authProvider === "google" && Boolean(userProfile.email);

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Google account</Text>
        <Text style={styles.title}>{isConnected ? "Connected to Google" : "Connect Booklio to Google"}</Text>
        <Text style={styles.body}>
          {isConnected
            ? userProfile.email
            : Platform.OS === "web"
              ? "Sign in with Google to personalize your Booklio profile and keep your identity consistent."
              : "Sign in with Google to personalize your Booklio profile. Native testing requires a development build, not Expo Go."}
        </Text>
      </View>

      {isConnected ? (
        <View style={styles.connectedRow}>
          {userProfile.avatarUri ? (
            <Image source={{ uri: userProfile.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="logo-google" size={18} color={colors.card} />
            </View>
          )}
          <Pressable style={styles.disconnectButton} onPress={() => void disconnectGoogleAccount()}>
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.connectButton, (!request || isBusy) && styles.connectButtonDisabled]}
          disabled={!request || isBusy}
          onPress={() => {
            void promptAsync();
          }}
        >
          {isBusy
            ? <ActivityIndicator size="small" color={colors.card} />
            : <Ionicons name="logo-google" size={16} color={colors.card} />
          }
          <Text style={styles.connectButtonText}>
            {isBusy ? "Connecting..." : "Continue with Google"}
          </Text>
        </Pressable>
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
  connectedRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
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
  disconnectButton: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  disconnectButtonText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  }
});
