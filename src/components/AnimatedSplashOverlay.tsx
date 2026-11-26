import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { BRAND_COLORS } from '../theme/tokens';
import { BrandLogo } from './BrandLogo';

/**
 * Lightweight, GPU-accelerated launch overlay that hands off smoothly from
 * the native splash screen and unmounts completely after 650ms.
 */
export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  const logoScale = useSharedValue(0.88);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    logoScale.value = withSequence(
      withSpring(1.04, { damping: 14, stiffness: 180 }),
      withSpring(1.0, { damping: 16, stiffness: 200 }),
      withDelay(
        80,
        withTiming(1.12, { duration: 320, easing: Easing.out(Easing.cubic) })
      )
    );

    overlayOpacity.value = withDelay(
      330,
      withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) })
    );

    const unmountTimer = setTimeout(() => {
      setVisible(false);
    }, 660);

    return () => clearTimeout(unmountTimer);
  }, [logoScale, overlayOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, containerStyle]}
    >
      <View style={styles.glowWrap}>
        <Svg width={240} height={240} viewBox="0 0 240 240">
          <Defs>
            <RadialGradient id="launchGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={BRAND_COLORS.primary} stopOpacity="0.28" />
              <Stop offset="60%" stopColor={BRAND_COLORS.deep} stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#050608" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="120" cy="120" r="120" fill="url(#launchGlow)" />
        </Svg>
      </View>

      <Animated.View style={logoStyle}>
        <BrandLogo variant="ring" size={88} accentColor={BRAND_COLORS.primary} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#050608',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  glowWrap: {
    position: 'absolute',
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
