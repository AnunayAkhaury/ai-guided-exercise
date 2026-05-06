import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastVariant = 'success' | 'error' | 'info';

type ToastInput = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastState = Required<Pick<ToastInput, 'title' | 'variant' | 'durationMs'>> & {
  id: number;
  message?: string;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles = {
  success: {
    icon: 'checkmark-circle' as const,
    accent: '#2F9E62',
    background: '#F0FFF7',
    border: '#BFEFD4'
  },
  error: {
    icon: 'alert-circle' as const,
    accent: '#B42D48',
    background: '#FFF0F2',
    border: '#F3C3CC'
  },
  info: {
    icon: 'information-circle' as const,
    accent: '#6155F5',
    background: '#F4F1FF',
    border: '#DCD5FF'
  }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearTimer();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 160,
        useNativeDriver: true
      })
    ]).start(() => setToast(null));
  }, [clearTimer, opacity, translateY]);

  const showToast = useCallback(
    ({ title, message, variant = 'info', durationMs = 3200 }: ToastInput) => {
      clearTimer();
      setToast({
        id: Date.now(),
        title,
        message,
        variant,
        durationMs
      });
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true
        })
      ]).start();
      timeoutRef.current = setTimeout(hideToast, durationMs);
    },
    [clearTimer, hideToast, opacity, translateY]
  );

  useEffect(() => clearTimer, [clearTimer]);

  const contextValue = useMemo(() => ({ showToast, hideToast }), [hideToast, showToast]);
  const activeVariant = toast ? variantStyles[toast.variant] : variantStyles.info;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <View pointerEvents="box-none" style={styles.host}>
        {toast ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastPosition,
              {
                top: Platform.OS === 'web' ? 22 : insets.top + 12,
                opacity,
                transform: [{ translateY }]
              }
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              onPress={hideToast}
              style={[
                styles.toastCard,
                {
                  backgroundColor: activeVariant.background,
                  borderColor: activeVariant.border
                }
              ]}
            >
              <View style={[styles.iconShell, { backgroundColor: activeVariant.accent }]}>
                <Ionicons name={activeVariant.icon} size={18} color="#FFFFFF" />
              </View>
              <View style={styles.textShell}>
                <Text style={[styles.toastTitle, { color: activeVariant.accent }]} numberOfLines={2}>
                  {toast.title}
                </Text>
                {toast.message ? (
                  <Text style={styles.toastMessage} numberOfLines={3}>
                    {toast.message}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="close" size={18} color="#6A6499" />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }
  return context;
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000
  },
  toastPosition: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center'
  },
  toastCard: {
    width: '100%',
    maxWidth: 520,
    minHeight: 64,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#2F2856',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textShell: {
    flex: 1,
    minWidth: 0
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  toastMessage: {
    marginTop: 2,
    color: '#4E4680',
    fontSize: 13,
    lineHeight: 18
  }
});
