import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  SEMANTIC_COLORS,
  TABULAR_NUMS,
} from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressRingProps {
  percentage: number;
  targetPercentage: number;
  hasData: boolean;
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  textColor: string;
}

export function CircularProgressRing({
  percentage,
  targetPercentage,
  hasData,
  size = 52,
  strokeWidth = 5,
  trackColor,
  textColor,
}: CircularProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(hasData ? clamped / 100 : 0, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, hasData, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const activeColor = !hasData
    ? trackColor
    : percentage >= targetPercentage
      ? BRAND_COLORS.emerald
      : SEMANTIC_COLORS.absent;

  const displayLabel = hasData ? `${Math.round(percentage)}%` : '0%';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          fill="none"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.labelWrap}>
        <Text
          style={[
            styles.label,
            TABULAR_NUMS,
            { color: textColor, fontFamily: FONT_FAMILIES.monoBold },
          ]}
        >
          {displayLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
