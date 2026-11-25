import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAttendance } from '../context/AttendanceContext';
import { AMBIENT_GRADIENTS, type AmbientTone } from '../theme/tokens';

interface AmbientBackgroundProps extends ViewProps {
  tone?: AmbientTone;
  children: React.ReactNode;
}

/**
 * Full-screen edge-sweeping Gemini-style ambient light background.
 * Two counter-drifting gradient ribbons sweep diagonally across the entire screen
 * height and perimeter over 9s and 11s continuous cycles.
 */
export function AmbientBackground({
  tone = 'healthy',
  style,
  children,
  ...rest
}: AmbientBackgroundProps) {
  const { palette, isDark } = useAttendance();
  const mode = isDark ? AMBIENT_GRADIENTS.dark : AMBIENT_GRADIENTS.light;

  const primaryColors =
    tone === 'alert'
      ? mode.alertPrimary
      : tone === 'sapphire'
        ? mode.sapphirePrimary
        : mode.healthyPrimary;

  const secondaryColors =
    tone === 'alert'
      ? mode.alertSecondary
      : tone === 'sapphire'
        ? mode.sapphireSecondary
        : mode.healthySecondary;

  const ribbon1 = useSharedValue(0);
  const ribbon2 = useSharedValue(0);

  useEffect(() => {
    ribbon1.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );

    ribbon2.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 5500,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 5500,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );
  }, [ribbon1, ribbon2]);

  const ribbon1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -45 + ribbon1.value * 100 },
      { translateY: -20 + ribbon1.value * 110 },
      { rotate: `${-12 + ribbon1.value * 20}deg` },
    ],
    opacity: 0.72 + ribbon1.value * 0.28,
  }));

  const ribbon2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: 45 - ribbon2.value * 95 },
      { translateY: 40 - ribbon2.value * 100 },
    ],
    opacity: 0.55 + ribbon2.value * 0.35,
  }));

  return (
    <View
      style={[styles.root, { backgroundColor: palette.background }, style]}
      {...rest}
    >
      <View pointerEvents="none" style={styles.ambientContainer}>
        <Animated.View style={[styles.ribbon1Box, ribbon1Style]}>
          <LinearGradient
            colors={primaryColors}
            locations={[0, 0.48, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 0.85 }}
            style={styles.fill}
          />
        </Animated.View>

        <Animated.View style={[styles.ribbon2Box, ribbon2Style]}>
          <LinearGradient
            colors={secondaryColors}
            locations={[0, 0.5, 1]}
            start={{ x: 0.85, y: 1 }}
            end={{ x: 0.15, y: 0.1 }}
            style={styles.fill}
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
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  ribbon1Box: {
    position: 'absolute',
    top: -90,
    left: '-22%',
    width: '130%',
    height: '75%',
  },
  ribbon2Box: {
    position: 'absolute',
    bottom: -70,
    left: '-15%',
    width: '130%',
    height: '70%',
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
