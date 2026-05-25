import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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
        tabBarActiveTintColor: colors.tealDark,
        tabBarInactiveTintColor: "#7B8380",
        tabBarLabelStyle: {
          fontFamily: fonts.body,
          fontSize: 11,
          fontWeight: "800"
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 82,
          paddingBottom: 18,
          paddingTop: 9
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
            Home: focused ? "home" : "home-outline",
            Library: focused ? "library" : "library-outline",
            Add: focused ? "add-circle" : "add-circle-outline",
            Stats: focused ? "stats-chart" : "stats-chart-outline",
            Profile: focused ? "person-circle" : "person-circle-outline"
          };
          return <Ionicons color={route.name === "Add" && focused ? colors.coral : color} name={icons[route.name]} size={route.name === "Add" ? size + 7 : size} />;
        }
      })}
    >
      <Tabs.Screen component={HomeScreen} name="Home" />
      <Tabs.Screen component={LibraryScreen} name="Library" />
      <Tabs.Screen component={BookIntakeScreen} name="Add" options={{ title: "Añadir" }} />
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
        <Stack.Screen component={BookDetailScreen} name="BookDetail" options={{ title: "Book Detail" }} />
        <Stack.Screen component={ReadingLogScreen} name="ReadingLog" options={{ title: "Reading Log" }} />
        <Stack.Screen component={AddReadingSessionScreen} name="AddReadingSession" options={{ title: "Log Session" }} />
        <Stack.Screen component={BookIntakeScreen} name="BookIntake" options={{ title: "Añadir libro" }} />
        <Stack.Screen component={SeriesTrackerScreen} name="SeriesTracker" options={{ title: "Saga Tracker" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
