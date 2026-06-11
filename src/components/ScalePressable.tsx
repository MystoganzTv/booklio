/**
 * ScalePressable — Pressable with a subtle spring scale-down on press.
 * Core Animated API only (no native deps), driver-safe.
 * Drop-in replacement for Pressable wherever tactile feedback matters.
 */
import { PropsWithChildren, useRef } from "react";
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";

type Props = PropsWithChildren<
  PressableProps & {
    /** Scale while pressed. 0.97 = subtle, 0.94 = bouncy. */
    pressScale?: number;
    style?: StyleProp<ViewStyle>;
  }
>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ScalePressable({ children, pressScale = 0.96, style, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedPressable
      {...rest}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(e) => {
        Animated.spring(scale, {
          toValue: pressScale,
          useNativeDriver: true,
          speed: 50,
          bounciness: 0,
        }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 30,
          bounciness: 6,
        }).start();
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
