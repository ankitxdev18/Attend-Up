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

const CYCLE_DURATION_MS = 16000;
const BREATHE_DURATION_MS = 5000;

interface AuroraOrbSvgProps {
  id: string;
  size: number;
  fadeTarget: string;
  isDark: boolean;
}

const AuroraOrbSvg = React.memo(function AuroraOrbSvg({
  id,
  size,
  fadeTarget,
  isDark,
}: AuroraOrbSvgProps) {
  const half = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop
            offset="0%"
            stopColor="#34D399"
            stopOpacity={isDark ? '0.34' : '0.20'}
          />
          <Stop
            offset="42%"
            stopColor="#10B981"
            stopOpacity={isDark ? '0.16' : '0.10'}
          />
          <Stop
            offset="74%"
            stopColor="#059669"
            stopOpacity={isDark ? '0.06' : '0.04'}
          />
          <Stop offset="100%" stopColor={fadeTarget} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={half} cy={half} r={half} fill={`url(#${id})`} />
    </Svg>
  );
});

/**
 * Full-perimeter Gemini-style flowing Emerald aurora:
 * 3 overlapping soft-feathered SVG radial clouds (520, 480, 440) glide
 * continuously around Top -> Right -> Bottom -> Left edges on the UI thread
 * while breathing gently in scale (0.95 -> 1.18) and pausing in background.
 */
export function AmbientBackground({
  tone: _tone,
  style,
  children,
  ...rest
}: AmbientBackgroundProps) {
  const { palette, isDark } = useAttendance();
  const { width, height } = useWindowDimensions();

  const perimeter = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    const sine = Easing.inOut(Easing.sin);

    const startAnimations = () => {
      const current = perimeter.value % 1;
      const remainingMs = Math.max(100, Math.round((1 - current) * CYCLE_DURATION_MS));
      if (current > 0.001) {
        perimeter.value = withSequence(
          withTiming(1, { duration: remainingMs, easing: Easing.linear }),
          withTiming(0, { duration: 0 }),
          withRepeat(
            withTiming(1, { duration: CYCLE_DURATION_MS, easing: Easing.linear }),
            -1,
            false
          )
        );
      } else {
        perimeter.value = withRepeat(
          withTiming(1, { duration: CYCLE_DURATION_MS, easing: Easing.linear }),
          -1,
          false
        );
      }

      breathe.value = withRepeat(
        withSequence(
          withTiming(1, { duration: BREATHE_DURATION_MS, easing: sine }),
          withTiming(0, { duration: BREATHE_DURATION_MS, easing: sine })
        ),
        -1,
        false
      );
    };

    startAnimations();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        startAnimations();
      } else {
        cancelAnimation(perimeter);
        cancelAnimation(breathe);
      }
    });

    return () => {
      sub.remove();
      cancelAnimation(perimeter);
      cancelAnimation(breathe);
    };
  }, [perimeter, breathe]);

  // Orb 1 (520x520, half 260) — phase 0
  const orb1Style = useAnimatedStyle(() => {
    const p = perimeter.value;
    const translateX = interpolate(
      p,
      [0, 0.25, 0.5, 0.75, 1],
      [-260, width - 260, width - 260, -260, -260]
    );
    const translateY = interpolate(
      p,
      [0, 0.25, 0.5, 0.75, 1],
      [-260, -260, height - 260, height - 260, -260]
    );
    const scale = 0.95 + breathe.value * 0.23; // 0.95 -> 1.18
    return { transform: [{ translateX }, { translateY }, { scale }] };
  });

  // Orb 2 (480x480, half 240) — phase +0.33
  const orb2Style = useAnimatedStyle(() => {
    const p = (perimeter.value + 0.33) % 1;
    const translateX = interpolate(
      p,
      [0, 0.25, 0.5, 0.75, 1],
      [-240, width - 240, width - 240, -240, -240]
    );
    const translateY = interpolate(
      p,
      [0, 0.25, 0.5, 0.75, 1],
      [-240, -240, height - 240, height - 240, -240]
    );
    const scale = 1.12 - breathe.value * 0.17;
    return { transform: [{ translateX }, { translateY }, { scale }] };
  });

  // Orb 3 (440x440, half 220) — phase +0.66
  const orb3Style = useAnimatedStyle(() => {
    const p = (perimeter.value + 0.66) % 1;
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
    const scale = 0.98 + breathe.value * 0.16;
    return { transform: [{ translateX }, { translateY }, { scale }] };
  });

  const fadeTarget = isDark ? '#050608' : '#F7F8FA';

  return (
    <View
      style={[styles.root, { backgroundColor: palette.background }, style]}
      {...rest}
    >
      <View pointerEvents="none" style={styles.ambientContainer}>
        <Animated.View style={[styles.orb520, orb1Style]}>
          <AuroraOrbSvg id="auroraOrb1" size={520} fadeTarget={fadeTarget} isDark={isDark} />
        </Animated.View>

        <Animated.View style={[styles.orb480, orb2Style]}>
          <AuroraOrbSvg id="auroraOrb2" size={480} fadeTarget={fadeTarget} isDark={isDark} />
        </Animated.View>

        <Animated.View style={[styles.orb440, orb3Style]}>
          <AuroraOrbSvg id="auroraOrb3" size={440} fadeTarget={fadeTarget} isDark={isDark} />
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
  orb520: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 520,
    height: 520,
  },
  orb480: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 480,
    height: 480,
  },
  orb440: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 440,
    height: 440,
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
