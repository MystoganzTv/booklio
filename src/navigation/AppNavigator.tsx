import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import { fonts } from "../theme/theme";
import { AddReadingSessionScreen } from "../screens/AddReadingSessionScreen";
import { BookIntakeScreen } from "../screens/BookIntakeScreen";
import { BookDetailScreen } from "../screens/BookDetailScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ReadingLogScreen } from "../screens/ReadingLogScreen";
import { SeriesTrackerScreen } from "../screens/SeriesTrackerScreen";
import { StatsScreen } from "../screens/StatsScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { EditBookScreen } from "../screens/EditBookScreen";
import { AchievementsScreen } from "../screens/AchievementsScreen";
import { WriteReviewScreen } from "../screens/WriteReviewScreen";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { OnboardingWelcomeScreen } from "../screens/onboarding/OnboardingWelcomeScreen";
import { OnboardingNameScreen } from "../screens/onboarding/OnboardingNameScreen";
import { OnboardingGenresScreen } from "../screens/onboarding/OnboardingGenresScreen";
import { useBooklio } from "../data/BooklioContext";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/LocalizationContext";
import { MainTabParamList, RootStackParamList } from "./types";
import { WhatsNewModal } from "../components/WhatsNewModal";
import { SeriesCompletionModal } from "../components/SeriesCompletionModal";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { colors: c, isDark } = useTheme();
  const { t } = useI18n();
  const addFrameBase = isDark ? "rgba(255,200,87,0.16)" : c.surfaceAlt;
  const addFrameBorder = isDark ? "rgba(255,200,87,0.30)" : c.border;
  const addFrameFocused = isDark ? "rgba(20,184,166,0.22)" : c.gold;
  const addFrameFocusedBorder = isDark ? "rgba(20,184,166,0.38)" : c.gold;

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: route.name === "Add" ? c.coral : c.tealDark,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: {
          fontFamily: fonts.body,
          fontSize: 11,
          fontWeight: "900",
          marginTop: 2
        },
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 18,
          paddingTop: 10,
          shadowColor: c.shadow,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.1,
          shadowRadius: 18
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
            Home: focused ? "home" : "home-outline",
            Library: focused ? "library" : "library-outline",
            Add: focused ? "add" : "add-outline",
            Stats: focused ? "stats-chart" : "stats-chart-outline",
            Profile: focused ? "person" : "person-outline"
          };
          const isAdd = route.name === "Add";
          return (
            <View style={[
              styles.iconFrame,
              focused && { backgroundColor: isDark ? "rgba(20,184,166,0.18)" : "rgba(20,184,166,0.10)" },
              isAdd && { backgroundColor: addFrameBase, borderColor: addFrameBorder, borderWidth: 1 },
              isAdd && styles.addFrame,
              isAdd && focused && { backgroundColor: addFrameFocused, borderColor: addFrameFocusedBorder }
            ]}>
              <Ionicons
                color={isAdd && focused ? (isDark ? c.gold : c.navy) : color}
                name={icons[route.name]}
                size={isAdd ? size : size}
              />
            </View>
          );
        }
      })}
    >
      <Tabs.Screen component={HomeScreen} name="Home" options={{ title: t("nav.tabs.home") }} />
      <Tabs.Screen component={LibraryScreen} name="Library" options={{ title: t("nav.tabs.library") }} />
      <Tabs.Screen component={BookIntakeScreen} name="Add" options={{ title: t("nav.tabs.add") }} />
      <Tabs.Screen component={StatsScreen} name="Stats" options={{ title: t("nav.tabs.stats") }} />
      <Tabs.Screen component={ProfileScreen} name="Profile" options={{ title: t("nav.tabs.profile") }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { onboardingComplete } = useBooklio();
  const { colors: c } = useTheme();
  const { t } = useI18n();

  const activeTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: c.bg,
      card: c.navBg,
      border: c.border,
      primary: c.gold,
      text: c.navText,
    },
  };

  return (
    <NavigationContainer theme={activeTheme}>
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: c.bg },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.navBg },
          headerTintColor: c.navText,
          headerTitleStyle: { fontFamily: fonts.display, fontWeight: "800" }
        }}
      >
        {!onboardingComplete ? (
          <>
            <Stack.Screen component={OnboardingWelcomeScreen} name="OnboardingWelcome" options={{ headerShown: false }} />
            <Stack.Screen component={OnboardingNameScreen} name="OnboardingName" options={{ headerShown: false, animation: "slide_from_right" }} />
            <Stack.Screen component={OnboardingGenresScreen} name="OnboardingGenres" options={{ headerShown: false, animation: "slide_from_right" }} />
          </>
        ) : (
          <Stack.Screen component={MainTabs} name="MainTabs" options={{ headerShown: false }} />
        )}
        <Stack.Screen component={WelcomeScreen} name="Welcome" options={{ headerShown: false }} />
        <Stack.Screen component={BookDetailScreen} name="BookDetail" options={{ title: "" }} />
        <Stack.Screen component={ReadingLogScreen} name="ReadingLog" options={{ title: "" }} />
        <Stack.Screen component={AddReadingSessionScreen} name="AddReadingSession" options={{ title: "" }} />
        <Stack.Screen component={BookIntakeScreen} name="BookIntake" options={{ title: t("nav.stack.addBook") }} />
        <Stack.Screen component={SeriesTrackerScreen} name="SeriesTracker" options={{ title: "" }} />
        <Stack.Screen component={EditProfileScreen} name="EditProfile" options={{ title: t("nav.stack.editProfile") }} />
        <Stack.Screen component={SettingsScreen} name="Settings" options={{ title: t("nav.stack.settings") }} />
        <Stack.Screen component={EditBookScreen} name="EditBook" options={{ title: t("nav.stack.editBook") }} />
        <Stack.Screen component={AchievementsScreen} name="Achievements" options={{ title: "" }} />
        <Stack.Screen component={WriteReviewScreen} name="WriteReview" options={{ title: t("nav.stack.writeReview") }} />
      </Stack.Navigator>
      {/* Shown once per app version after onboarding is complete */}
      {onboardingComplete ? <WhatsNewModal /> : null}
      {/* Shown when the user finishes the last book of a series */}
      {onboardingComplete ? <SeriesCompletionModal /> : null}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    alignItems: "center",
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    width: 42
  },
  addFrame: {
    borderRadius: 18,
    height: 38,
    marginTop: -2,
    width: 44
  }
});
