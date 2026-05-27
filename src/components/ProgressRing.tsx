import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppColors, fonts } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

type ProgressRingProps = {
  progress: number;
  size?: number;
};

export function ProgressRing({ progress, size = 42 }: ProgressRingProps) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <View
      style={[
        styles.ring,
        {
          borderColor: clamped > 66 ? c.green : c.gold,
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

function createStyles(c: AppColors) {
  return StyleSheet.create({
    ring: {
      alignItems: "center",
      backgroundColor: c.navy + "BB",
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
      color: "#FFFFFF",
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "800"
    }
  });
}
