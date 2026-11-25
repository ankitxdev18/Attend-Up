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
 *
 * Layer 1 — Emerald atmospheric sweep (8 s):
 *   Ribbon starts at top-left corner, sweeps down the left edge.
 *   Gradient: #0D5D30 → #053C1F → transparent (dark) or green-tinted rgba (light).
 *
 * Layer 2 — Sapphire ambient breathing (11 s):
 *   Ribbon pulses from the right/lower-middle edge.
 *   Gradient: #0F1F40 → transparent (dark) or blue-tinted rgba (light).
 *
 * Both use Easing.bezier(0.25, 1, 0.5, 1) — the smooth custom ease-out cubic
 * the user specified.
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

  // ─── Shared animation values ───────────────────────────────────────────────
  const sweepAnim = useSharedValue(0);   // 8 s — emerald left-edge sweep
  const breatheAnim = useSharedValue(0); // 11 s — sapphire right/bottom breath

  useEffect(() => {
    const bezier = Easing.bezier(0.25, 1, 0.5, 1);
    sweepAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 8000, easing: bezier }),
        withTiming(0, { duration: 8000, easing: bezier }),
      ),
      -1,
      false,
    );
    breatheAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 11000, easing: bezier }),
        withTiming(0, { duration: 11000, easing: bezier }),
      ),
      -1,
      false,
    );
  }, [sweepAnim, breatheAnim]);

  // ─── Emerald sweep: slides DOWN the left edge ──────────────────────────────
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: 0.60 + sweepAnim.value * 0.40,
    transform: [
      { translateY: -30 + sweepAnim.value * 70 },  // sweeps down
      { translateX: -20 + sweepAnim.value * 15 },  // slight horizontal drift
    ],
  }));

  // ─── Sapphire breathe: expands from bottom-right corner ───────────────────
  const breatheStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + breatheAnim.value * 0.45,
    transform: [
      { translateX: 20 - breatheAnim.value * 30 }, // drifts left
      { translateY: 20 - breatheAnim.value * 40 }, // drifts up
    ],
  }));

  return (
    <View
      style={[styles.root, { backgroundColor: palette.background }, style]}
      {...rest}
    >
      {/* ── Ambient gradient layers (non-interactive) ── */}
      <View pointerEvents="none" style={styles.ambientContainer}>
        {/* Layer 1: Emerald atmospheric sweep — top-left → down left edge */}
        <Animated.View style={[styles.sweepBox, sweepStyle]}>
          <LinearGradient
            colors={primaryColors}
            locations={[0, 0.52, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.fill}
          />
        </Animated.View>

        {/* Layer 2: Sapphire ambient breathing — right / lower-middle edge */}
        <Animated.View style={[styles.breatheBox, breatheStyle]}>
          <LinearGradient
            colors={secondaryColors}
            locations={[0, 0.55, 1]}
            start={{ x: 1, y: 1 }}
            end={{ x: 0.2, y: 0.1 }}
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
  /**
   * Emerald sweep box — anchored top-left, tall enough to cover the left
   * perimeter and upper half of the screen.
   * width: 85% keeps it from bleeding fully across the screen centre.
   */
  sweepBox: {
    position: 'absolute',
    top: -60,
    left: '-10%',
    width: '85%',
    height: '80%',
  },
  /**
   * Sapphire breathe box — anchored bottom-right, covers the right/lower half.
   */
  breatheBox: {
    position: 'absolute',
    bottom: -50,
    right: '-10%',
    width: '90%',
    height: '75%',
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
