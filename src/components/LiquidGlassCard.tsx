import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAttendance } from '../context/AttendanceContext';

export interface LiquidGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  focused?: boolean;
  useNativeBlur?: boolean;
  intensity?: number;
}

/**
 * Multi-layer Liquid Glass container:
 * - Translucent obsidian fill (rgba(16, 20, 24, 0.72) dark / rgba(255, 255, 255, 0.78) light)
 * - Optional native BlurView for hero/dock/modal surfaces (skipped on dense list items for 120fps)
 * - Top-lit specular rim border + soft inner luminance sheen
 */
export const LiquidGlassCard = React.memo(function LiquidGlassCard({
  children,
  style,
  borderRadius = 24,
  focused = false,
  useNativeBlur = false,
  intensity = 24,
}: LiquidGlassCardProps) {
  const { isDark } = useAttendance();

  const fillColor = isDark
    ? 'rgba(16, 20, 24, 0.72)'
    : 'rgba(255, 255, 255, 0.78)';
  const baseBorderColor = isDark
    ? focused
      ? 'rgba(52, 211, 153, 0.22)'
      : 'rgba(255, 255, 255, 0.09)'
    : focused
      ? 'rgba(16, 185, 129, 0.30)'
      : 'rgba(15, 23, 42, 0.08)';
  const topBorderColor = isDark
    ? focused
      ? 'rgba(52, 211, 153, 0.36)'
      : 'rgba(255, 255, 255, 0.18)'
    : 'rgba(255, 255, 255, 0.92)';

  return (
    <View
      style={[
        styles.outer,
        {
          borderRadius,
          backgroundColor: fillColor,
          borderColor: baseBorderColor,
          borderTopColor: topBorderColor,
        },
        isDark ? styles.darkShadow : styles.lightShadow,
        style,
      ]}
    >
      {useNativeBlur && Platform.OS === 'ios' ? (
        <BlurView
          intensity={intensity}
          tint={isDark ? 'dark' : 'light'}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={
          isDark
            ? focused
              ? ['rgba(52, 211, 153, 0.07)', 'rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0)']
              : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.00)']
            : ['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.00)']
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />

      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  darkShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
  },
  lightShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
});
