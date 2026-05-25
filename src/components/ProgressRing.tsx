import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme/theme";

type ProgressRingProps = {
  progress: number;
  size?: number;
};

export function ProgressRing({ progress, size = 42 }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <View
      style={[
        styles.ring,
        {
          borderColor: clamped > 66 ? colors.green : colors.gold,
          height: size,
          width: size
        }
      ]}
    >
      <View style={[styles.inner, { height: size - 10, width: size - 10 }]}>
        <Text style={styles.text}>{clamped}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.72)",
    borderRadius: 999,
    borderWidth: 4,
    justifyContent: "center"
  },
  inner: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center"
  },
  text: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "800"
  }
});
