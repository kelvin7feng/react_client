import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DeviceEventEmitter } from 'react-native';

type ToastType = 'info' | 'error';

interface ToastPayload {
  message: string;
  type?: ToastType;
  duration?: number;
}

const TOAST_EVENT = '__global_toast__';

export function showGlobalToast(message: string, type: ToastType = 'error', duration = 2500) {
  DeviceEventEmitter.emit(TOAST_EVENT, { message, type, duration } as ToastPayload);
}

export default function GlobalToast() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [type, setType] = useState<ToastType>('error');
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const present = useCallback(
    (payload: ToastPayload) => {
      setText(payload.message);
      setType(payload.type ?? 'error');
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setText('')
        );
      }, payload.duration ?? 2500);
    },
    [anim]
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TOAST_EVENT, present);
    return () => sub.remove();
  }, [present]);

  if (!text) return null;

  const icon: keyof typeof Ionicons.glyphMap = type === 'error' ? 'alert-circle' : 'information-circle';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          top: insets.top + 56,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
          ],
        },
      ]}
    >
      <View style={[styles.inner, type === 'error' && styles.innerError]}>
        <Ionicons name={icon} size={18} color="#fff" />
        <Text style={styles.text}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  innerError: {
    backgroundColor: 'rgba(220,53,69,0.92)',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
