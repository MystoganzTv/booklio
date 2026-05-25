import { Platform } from "react-native";

export const colors = {
  navy: "#0F172A",
  navy2: "#071123",
  cream: "#FFFBF4",
  card: "#FFFFFF",
  teal: "#14B8A6",
  tealDark: "#087F7A",
  gold: "#FFC857",
  coral: "#FF7A59",
  green: "#7FB069",
  gray: "#9EA7A0",
  muted: "#69716D",
  ink: "#1C1917",
  border: "#EFE4D1",
  danger: "#D95D47",
  shadow: "#0F172A"
};

export const fonts = {
  display: Platform.select({ ios: "Lora_700Bold", android: "Lora_700Bold", default: "Lora_700Bold" }),
  body: Platform.select({ ios: "Nunito_700Bold", android: "Nunito_700Bold", default: "Nunito_700Bold" }),
  bodyRegular: Platform.select({ ios: "Nunito_400Regular", android: "Nunito_400Regular", default: "Nunito_400Regular" }),
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 32
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  }
};
