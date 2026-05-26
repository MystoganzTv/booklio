import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import { colors, fonts } from "../theme/theme";
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
import { MainTabParamList, RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const BooklioTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.cream,
    card: colors.navy,
    primary: colors.gold,
    text: colors.ink
  }
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: route.name === "Add" ? colors.coral : colors.tealDark,
        tabBarInactiveTintColor: colors.navy,
        tabBarLabelStyle: {
          fontFamily: fonts.body,
          fontSize: 11,
          fontWeight: "900"
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 18,
          paddingTop: 10,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.1,
          shadowRadius: 18
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
            Home: focused ? "home" : "home-outline",
            Library: focused ? "library" : "library-outline",
            Add: focused ? "scan" : "scan-outline",
            Stats: focused ? "stats-chart" : "stats-chart-outline",
            Profile: focused ? "person" : "person-outline"
          };
          const isAdd = route.name === "Add";
          return (
            <View style={[styles.iconFrame, focused && styles.iconFrameActive, isAdd && styles.addFrame, isAdd && focused && styles.addFrameActive]}>
              <Ionicons
                color={isAdd && focused ? colors.navy : color}
                name={icons[route.name]}
                size={isAdd ? size + 2 : size}
              />
            </View>
          );
        }
      })}
    >
      <Tabs.Screen component={HomeScreen} name="Home" />
      <Tabs.Screen component={LibraryScreen} name="Library" />
      <Tabs.Screen component={BookIntakeScreen} name="Add" options={{ title: "Add book" }} />
      <Tabs.Screen component={StatsScreen} name="Stats" />
      <Tabs.Screen component={ProfileScreen} name="Profile" />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer theme={BooklioTheme}>
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: colors.cream },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.card,
          headerTitleStyle: { fontFamily: fonts.display, fontWeight: "800" }
        }}
      >
        <Stack.Screen component={MainTabs} name="MainTabs" options={{ headerShown: false }} />
        <Stack.Screen component={BookDetailScreen} name="BookDetail" options={{ title: "" }} />
        <Stack.Screen component={ReadingLogScreen} name="ReadingLog" options={{ title: "" }} />
        <Stack.Screen component={AddReadingSessionScreen} name="AddReadingSession" options={{ title: "" }} />
        <Stack.Screen component={BookIntakeScreen} name="BookIntake" options={{ title: "Add Book" }} />
        <Stack.Screen component={SeriesTrackerScreen} name="SeriesTracker" options={{ title: "" }} />
        <Stack.Screen component={EditProfileScreen} name="EditProfile" options={{ title: "Edit Profile" }} />
        <Stack.Screen component={EditBookScreen} name="EditBook" options={{ title: "Edit Book" }} />
        <Stack.Screen component={AchievementsScreen} name="Achievements" options={{ title: "" }} />
      </Stack.Navigator>
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
  iconFrameActive: {
    backgroundColor: "#E7F8F5"
  },
  addFrame: {
    backgroundColor: "#FFF4D3",
    borderColor: "#F7D27B",
    borderWidth: 1,
    borderRadius: 18,
    height: 40,
    marginTop: -4,
    width: 48
  },
  addFrameActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  }
});
