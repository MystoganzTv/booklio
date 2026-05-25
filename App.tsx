import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { Lora_700Bold } from "@expo-google-fonts/lora";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black
} from "@expo-google-fonts/nunito";
import { BooklioProvider } from "./src/data/BooklioContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  const [fontsLoaded] = useFonts({
    Lora_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <BooklioProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </BooklioProvider>
  );
}
