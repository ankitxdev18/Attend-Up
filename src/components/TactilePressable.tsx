import React from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TactilePressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}

/**
 * TactilePressable: Reanimated spring scale (0.975 on press-in) paired with
 * subtle ImpactFeedbackStyle.Light haptics for cards, pills, and steppers.
 */
export function TactilePressable({
  style,
  scaleTo = 0.975,
  haptic = true,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  onLongPress,
  children,
  ...rest
}: TactilePressableProps) {
  const scale = useSharedValue(1);

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!disabled) {
      scale.value = withSpring(scaleTo, {
        damping: 18,
        stiffness: 320,
        mass: 0.6,
      });
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    scale.value = withSpring(1, {
      damping: 16,
      stiffness: 280,
      mass: 0.6,
    });
    onPressOut?.(e);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = (e: GestureResponderEvent) => {
    if (haptic && !disabled) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  const handleLongPress = (e: GestureResponderEvent) => {
    if (haptic && !disabled && onLongPress) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onLongPress?.(e);
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress ? handlePress : undefined}
      onLongPress={onLongPress ? handleLongPress : undefined}
      style={[animatedStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
