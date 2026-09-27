import React, { type ErrorInfo, type ReactNode } from 'react';
import { DevSettings, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Poore app ko wrap karne wala Error Boundary (root _layout.tsx mein).
 * Koi bhi render error aaye to blank black screen ki jagah "Something went
 * wrong" screen dikhti hai - "Try Again" (sirf error state clear) aur
 * "Reload App" (poora subtree fresh remount / OTA reload) ke saath.
 *
 * WEB -> RN CHANGES:
 * - `window.location.reload()` RN mein nahi hota. "Reload App":
 *     1. `expo-updates` installed ho to `Updates.reloadAsync()` (real JS reload),
 *     2. warna dev mein `DevSettings.reload()`,
 *     3. warna poora children subtree fresh key ke saath remount kar deta hai
 *        (state bilkul naya) - crash-loop ke liye kaafi hota hai.
 *   `expo-updates` optional hai - try/catch require ki wajah se install na
 *   ho tab bhi bundle nahi tootega.
 * - Native crashes (JS ke bahar) yeh boundary pakad nahi sakta - sirf render-time
 *   JS errors. Event handlers / async errors ke liye alag handling chahiye.
 * - Dev build mein error ka message bhi dikhta hai.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional - Sentry/Crashlytics jaisa reporting yahan laga sakte ho. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught a render error:', error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = async () => {
    try {
      // Optional dependency - Metro try/catch ke andar missing module allow karta hai.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Updates = require('expo-updates');
      if (Updates?.reloadAsync) {
        await Updates.reloadAsync();
        return;
      }
    } catch {
      // expo-updates nahi hai ya dev client - neeche fallback
    }
    if (__DEV__) {
      DevSettings.reload();
      return;
    }
    // Fallback: fresh key => poora subtree naye state ke saath remount
    this.setState((s) => ({ hasError: false, error: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The screen hit an unexpected error. You can try again, or reload the app if it keeps
            happening.
          </Text>

          {__DEV__ && !!this.state.error && (
            <Text style={styles.devError} numberOfLines={6}>
              {String(this.state.error?.message ?? this.state.error)}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={this.handleRetry}
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.btnText}>Try Again</Text>
            </Pressable>
            <Pressable
              onPress={this.handleReload}
              style={({ pressed }) => [styles.btnOutline, pressed && styles.pressed]}
            >
              <Text style={styles.btnText}>Reload App</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0a0e1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 999999,
    elevation: 50,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 320,
  },
  devError: {
    fontSize: 11,
    color: '#f87171',
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 320,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: '#3b6fd6',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.75,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default ErrorBoundary;