/**
 * Skeleton — pulsing placeholder block for loading states.
 * Shape-accurate skeletons (instead of spinners) prevent layout shift and
 * make loading feel intentional. Pure RN Animated, no extra deps.
 */
import { useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";
import { useColors } from "../theme/ThemeContext";

type SkeletonProps = {
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ style }: SkeletonProps) {
  const c = useColors();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: c.surfaceAlt, borderRadius: 8, opacity }, style]}
    />
  );
}
