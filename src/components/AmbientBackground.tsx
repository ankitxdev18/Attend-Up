import React, { useEffect } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View, type ViewProps } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAttendance } from '../context/AttendanceContext';
import type { AmbientTone } from '../theme/tokens';

interface AmbientBackgroundProps extends ViewProps {
  tone?: AmbientTone;
  children: React.ReactNode;
}

const CYCLE_DURATION_MS = 14000;

interface OrbSvgProps {
  primaryColor: string;
  glowColor: string;
  fadeTarget: string;
  isDark: boolean;
}

const PrimaryPerimeterOrbSvg = React.memo(function PrimaryPerimeterOrbSvg({
  primaryColor,
  glowColor,
  fadeTarget,
  isDark,
}: OrbSvgProps) {
  return (
    <Svg width={440} height={440} viewBox="0 0 440 440">
      <Defs>
        <RadialGradient id="perimeterPrimaryGrad" cx="50%" cy="50%" r="50%">
          <Stop
            offset="0%"
            stopColor={primaryColor}
            stopOpacity={isDark ? '0.44' : '0.26'}
          />
          <Stop
            offset="50%"
            stopColor={glowColor}
            stopOpacity={isDark ? '0.15' : '0.10'}
          />
          <Stop offset="100%" stopColor={fadeTarget} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="220" cy="220" r="220" fill="url(#perimeterPrimaryGrad)" />
    </Svg>
  );
});

const OppositePerimeterOrbSvg = React.memo(function OppositePerimeterOrbSvg({
  primaryColor,
  glowColor,
  fadeTarget,
  isDark,
}: OrbSvgProps) {
  return (
    <Svg width={400} height={400} viewBox="0 0 400 400">
      <Defs>
        <RadialGradient id="perimeterOppositeGrad" cx="50%" cy="50%" r="50%">
          <Stop
            offset="0%"
            stopColor={glowColor}
            stopOpacity={isDark ? '0.32' : '0.20'}
          />
          <Stop
            offset="55%"
            stopColor={primaryColor}
            stopOpacity={isDark ? '0.10' : '0.07'}
          />
          <Stop offset="100%" stopColor={fadeTarget} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="200" cy="200" r="200" fill="url(#perimeterOppositeGrad)" />
    </Svg>
  );
});

/**
 * Full-screen 4-edge perimeter Gemini-style ambient light background.
 * Runs 100% on the native UI thread via Reanimated, memoizes SVG gradients,
 * and pauses automatically when the app enters the background.
 */
export function AmbientBackground({
  tone: _tone,
  style,
  children,
  ...rest
}: AmbientBackgroundProps) {
  const { palette, activeAccent, isDark } = useAttendance();
  const { width, height } = useWindowDimensions();

  const perimeterProgress = useSharedValue(0);

  useEffect(() => {
    const startPerimeterAnimation = () => {
      const current = perimeterProgress.value % 1;
      const remainingMs = Math.max(100, Math.round((1 - current) * CYCLE_DURATION_MS));
      if (current > 0.001) {
        perimeterProgress.value = withSequence(
          withTiming(1, { duration: remainingMs, easing: Easing.linear }),
          withTiming(0, { duration: 0 }),
          withRepeat(
            withTiming(1, { duration: CYCLE_DURATION_MS, easing: Easing.linear }),
            -1,
            false
          )
        );
      } else {
        perimeterProgress.value = withRepeat(
          withTiming(1, { duration: CYCLE_DURATION_MS, easing: Easing.linear }),
          -1,
          false
        );
      }
    };

    startPerimeterAnimation();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        startPerimeterAnimation();
      } else {
        cancelAnimation(perimeterProgress);
      }
    });

    return () => {
      sub.remove();
      cancelAnimation(perimeterProgress);
    };
  }, [perimeterProgress]);

  // Primary Edge Orb (440x440, center offset 220): Top-Left -> Top-Right -> Bottom-Right -> Bottom-Left -> Top-Left
  const primaryOrbStyle = useAnimatedStyle(() => {
    const p = perimeterProgress.value;
    const translateX = interpolate(
      p,
      [0, 0.25, 0.5, 0.75, 1],
      [-220, width - 220, width - 220, -220, -220]
    );
    const translateY = interpolate(
      p,
      [0, 0.25, 0.5, 0.75, 1],
      [-220, -220, height - 220, height - 220, -220]
    );
    return {
      transform: [{ translateX }, { translateY }],
    };
  });

  // Counter-Phase Opposite Edge Orb (400x400, center offset 200): Bottom-Right -> Bottom-Left -> Top-Left -> Top-Right -> Bottom-Right
  const oppositeOrbStyle = useAnimatedStyle(() => {
    const p = perimeterProgress.value;
    const translateX = interpolate(
      p,
      [0, 0.25, 0.5, 0.75, 1],
      [width - 200, -200, -200, width - 200, width - 200]
    );
    const translateY = interpolate(
      p,
      [0, 0.25, 0.5, 0.75, 1],
      [height - 200, height - 200, -200, -200, height - 200]
    );
    return {
      transform: [{ translateX }, { translateY }],
    };
  });

  const fadeTarget = isDark ? '#050608' : '#F7F8FA';

  return (
    <View
      style={[styles.root, { backgroundColor: palette.background }, style]}
      {...rest}
    >
      <View pointerEvents="none" style={styles.ambientContainer}>
        <Animated.View style={[styles.primaryOrbWrap, primaryOrbStyle]}>
          <PrimaryPerimeterOrbSvg
            primaryColor={activeAccent.primary}
            glowColor={activeAccent.glow}
            fadeTarget={fadeTarget}
            isDark={isDark}
          />
        </Animated.View>

        <Animated.View style={[styles.oppositeOrbWrap, oppositeOrbStyle]}>
          <OppositePerimeterOrbSvg
            primaryColor={activeAccent.primary}
            glowColor={activeAccent.glow}
            fadeTarget={fadeTarget}
            isDark={isDark}
          />
        </Animated.View>
      </View>

      {children}
    </View>
  );
}

export function MinimalMenuIcon({ color }: { color: string }) {
  return (
    <View style={styles.menuIconWrap}>
      <View style={[styles.menuLineTop, { backgroundColor: color }]} />
      <View style={[styles.menuLineBottom, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  ambientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  primaryOrbWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 440,
    height: 440,
  },
  oppositeOrbWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 400,
    height: 400,
  },
  menuIconWrap: {
    width: 18,
    gap: 5,
    alignItems: 'flex-start',
  },
  menuLineTop: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  menuLineBottom: {
    width: 13,
    height: 2,
    borderRadius: 1,
  },
});
