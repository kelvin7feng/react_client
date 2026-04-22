import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useDerivedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const INDICATOR_SIZE = 24;
const STROKE_WIDTH = 2.5;
const INDICATOR_HEIGHT = 48;
const PULL_THRESHOLD = 10;
const HIDDEN_TRANSLATE_Y = -INDICATOR_HEIGHT;
const RESTING_TRANSLATE_Y = 10;

const ROTATE_MS = 1000;
const MIN_GAP_ANGLE = 10;
const MAX_GAP_ANGLE = 60;
const ROUND_CAP_COMPENSATION = STROKE_WIDTH;
const INITIAL_ROTATION_OFFSET = -90;
const ROTATION_PROGRESS_INPUT = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
const ROTATION_ANGLE_OUTPUT = [0, 24, 60, 114, 180, 246, 300, 336, 360];

function getRotationAngle(progress: number) {
  'worklet';
  return interpolate(progress, ROTATION_PROGRESS_INPUT, ROTATION_ANGLE_OUTPUT, 'clamp');
}

interface Props {
  scrollY?: SharedValue<number>;
  refreshing?: boolean;
  mode?: 'pull' | 'inline';
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function BouncingDotsIndicator({
  scrollY,
  refreshing = false,
  mode,
  size = INDICATOR_SIZE,
  color = '#999',
  style,
}: Props) {
  const resolvedMode = mode ?? (scrollY ? 'pull' : 'inline');
  const rotationProgress = useSharedValue(0);

  useAnimatedReaction(
    () => {
      if (resolvedMode === 'inline') {
        return true;
      }
      return (scrollY?.value ?? 0) < -PULL_THRESHOLD || refreshing;
    },
    (shouldAnimate, previousShouldAnimate) => {
      if (shouldAnimate === previousShouldAnimate) {
        return;
      }

      if (shouldAnimate) {
        rotationProgress.value = 0;
        rotationProgress.value = withRepeat(
          withTiming(1, { duration: ROTATE_MS, easing: Easing.linear }),
          -1,
          false,
        );
        return;
      }

      cancelAnimation(rotationProgress);
      rotationProgress.value = 0;
    },
    [refreshing, resolvedMode],
  );

  const visible = useDerivedValue(() => {
    if (resolvedMode === 'inline') {
      return true;
    }
    return (scrollY?.value ?? 0) < -PULL_THRESHOLD || refreshing;
  });

  const wrapperStyle = useAnimatedStyle(() => {
    if (resolvedMode === 'inline') {
      return {
        opacity: 1,
        transform: [{ translateY: 0 }],
      };
    }

    const pullDistance = Math.max(0, -(scrollY?.value ?? 0));

    if (!visible.value) {
      return {
        opacity: 0,
        transform: [{ translateY: HIDDEN_TRANSLATE_Y }],
      };
    }

    const opacity = refreshing
      ? 1
      : interpolate(pullDistance, [PULL_THRESHOLD, PULL_THRESHOLD + 30], [0, 1], 'clamp');
    const translateY = refreshing
      ? RESTING_TRANSLATE_Y
      : interpolate(pullDistance, [0, 120], [HIDDEN_TRANSLATE_Y, RESTING_TRANSLATE_Y], 'clamp');

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const spinStyle = useAnimatedStyle(() => {
    const rotationAngle = getRotationAngle(rotationProgress.value);
    return { transform: [{ rotate: `${rotationAngle + INITIAL_ROTATION_OFFSET}deg` }] };
  });

  const animatedCircleProps = useAnimatedProps(() => {
    const rotationAngle = getRotationAngle(rotationProgress.value);
    const normalizedRotation = ((rotationAngle % 360) + 360) % 360;
    const cycleProgress = normalizedRotation / 360;
    const gapAngle = cycleProgress <= 0.5
      ? interpolate(cycleProgress, [0, 0.5], [MIN_GAP_ANGLE, MAX_GAP_ANGLE], 'clamp')
      : interpolate(cycleProgress, [0.5, 1], [MAX_GAP_ANGLE, MIN_GAP_ANGLE], 'clamp');
    const r = (size - STROKE_WIDTH) / 2;
    const c = 2 * Math.PI * r;
    const desiredGapLength = c * (gapAngle / 360);
    const actualGapLength = Math.min(c - 0.001, desiredGapLength + ROUND_CAP_COMPENSATION);
    const visibleArcLength = c - actualGapLength;
    return {
      strokeDasharray: `${visibleArcLength} ${actualGapLength}`,
      strokeDashoffset: 0,
    };
  });

  const r = (size - STROKE_WIDTH) / 2;
  const c = 2 * Math.PI * r;

  return (
    <Animated.View
      pointerEvents="none"
      style={[resolvedMode === 'pull' ? styles.pullWrapper : styles.inlineWrapper, style, wrapperStyle]}
    >
      <Animated.View style={spinStyle}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            fill="none"
            animatedProps={animatedCircleProps}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pullWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: INDICATOR_HEIGHT,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inlineWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
