import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SHIMMER_WIDTH = SCREEN_WIDTH * 0.9;
const BONE_COLOR = '#e8e8e8';
const HIGHLIGHT_COLOR = '#f1f1f1';
const SHIMMER_DURATION = 3750;
const FADE_DURATION = 300;
const DEBUG_MIN_DISPLAY = 0;

const SkeletonContext = React.createContext<Animated.AnimatedInterpolation<number> | null>(null);

/**
 * 骨架屏容器：提供统一的 shimmer 扫光动画。
 * 内部所有 <Bone> 共享同一个动画实例。
 */
export function SkeletonContainer({ children, style }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_WIDTH, SCREEN_WIDTH * 0.7],
  });

  return (
    <SkeletonContext.Provider value={translateX}>
      <View style={style}>{children}</View>
    </SkeletonContext.Provider>
  );
}

/**
 * 骨架块：灰色矩形 + shimmer 扫光。
 * 必须放在 <SkeletonContainer> 内部使用。
 */
export function Bone({ w, h, r = 6, style }: {
  w: number | string;
  h?: number;
  r?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const translateX = React.useContext(SkeletonContext);

  return (
    <View style={[
      { width: w, height: h, borderRadius: r, backgroundColor: BONE_COLOR, overflow: 'hidden' },
      style,
    ]}>
      {translateX && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={[BONE_COLOR, HIGHLIGHT_COLOR, BONE_COLOR]}
            locations={[0.08, 0.18, 0.33]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, width: SHIMMER_WIDTH }}
          />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * 骨架屏淡出 Overlay 封装。
 * 当 ready 变为 true 时，等待 minDisplay 后执行 300ms 淡出并卸载。
 * DEBUG_MIN_DISPLAY > 0 时强制骨架屏至少展示该时长，方便调试。
 */
export function SkeletonOverlay({ ready, children }: {
  ready: boolean;
  children: React.ReactNode;
}) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [dismissed, setDismissed] = useState(false);
  const mountedAt = useRef(Date.now()).current;

  useEffect(() => {
    if (!ready || dismissed) return;

    const elapsed = Date.now() - mountedAt;
    const remaining = Math.max(0, DEBUG_MIN_DISPLAY - elapsed);

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start(() => setDismissed(true));
    }, remaining);

    return () => clearTimeout(timer);
  }, [ready, dismissed, fadeAnim, mountedAt]);

  if (dismissed) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, zIndex: 30 }]}>
      {children}
    </Animated.View>
  );
}
