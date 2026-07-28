/**
 * ErrorBoundary — the last line of defence against a white screen.
 *
 * Bookliz renders data it does not control: covers, synopses and edition
 * records coming from Google Books and Open Library. A single unexpected shape
 * throwing during render would otherwise unmount the whole tree and leave the
 * user staring at a blank screen with no way back.
 *
 * This catches it, shows something honest, and offers a retry that remounts the
 * subtree without needing an app restart. It deliberately uses no theme or i18n
 * context: if a provider is what crashed, consuming it here would crash the
 * fallback too.
 */
import React, { Component, ErrorInfo, PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = PropsWithChildren<{
  /** Optional custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Called on every caught error — hook up crash reporting here. */
  onError?: (error: Error, info: ErrorInfo) => void;
}>;

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Bookliz hit an unexpected error and stopped this screen. Your library is saved on this
          device and has not been affected.
        </Text>
        {__DEV__ ? <Text style={styles.debug}>{error.message}</Text> : null}
        <Pressable style={styles.button} onPress={this.reset} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

// Hardcoded colours on purpose — see the file header.
const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#FAF7F2",
    flex: 1,
    justifyContent: "center",
    padding: 32
  },
  title: {
    color: "#1F2933",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center"
  },
  body: {
    color: "#52606D",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "center"
  },
  debug: {
    color: "#9AA5B1",
    fontFamily: "Courier",
    fontSize: 12,
    marginBottom: 24,
    textAlign: "center"
  },
  button: {
    backgroundColor: "#14B8A6",
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  }
});
