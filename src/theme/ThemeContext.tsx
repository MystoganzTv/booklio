import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppColors, darkColors, lightColors } from "./theme";

const STORAGE_KEY = "@booklio/theme";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  mode:        ThemeMode;
  isDark:      boolean;
  colors:      AppColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode:        "light",
  isDark:      false,
  colors:      lightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>("light");

  // Hydrate persisted preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "dark" || saved === "light") setMode(saved);
    }).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const isDark  = mode === "dark";
  const colors  = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Shorthand — returns just the color set */
export function useColors() {
  return useContext(ThemeContext).colors;
}
