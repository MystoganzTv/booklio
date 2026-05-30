import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * True when running inside Expo Go (StoreClient).
 *
 * Native modules like @react-native-google-signin are NOT bundled in Expo Go.
 * Use this flag to gate any native-only code paths so the app doesn't crash.
 */
export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Mock user injected in Expo Go for dev testing. */
export const DEV_MOCK_USER = {
  id: "dev-expo-go",
  provider: "google" as const,
  email: "dev@bookliz.test",
  name: "Enrique (Dev)",
  givenName: "Enrique",
  familyName: "Dev",
  picture: undefined,
};
