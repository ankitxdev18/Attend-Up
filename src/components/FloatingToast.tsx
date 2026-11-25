import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw } from 'lucide-react-native';
import { BRAND_COLORS, FONT_FAMILIES, SEMANTIC_COLORS } from '../theme/tokens';

export interface FloatingToastData {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
  onUndo?: () => Promise<void> | void;
  undoLabel?: string;
}

interface FloatingToastProps {
  toast: FloatingToastData | null;
  opacity: Animated.Value;
  isDark: boolean;
  onDismiss: () => void;
}

export function FloatingToast({
  toast,
  opacity,
  isDark,
  onDismiss,
}: FloatingToastProps) {
  const insets = useSafeAreaInsets();
  if (!toast) return null;

  const accentBorder =
    toast.tone === 'error'
      ? SEMANTIC_COLORS.absent
      : toast.tone === 'success'
        ? 'rgba(52, 211, 153, 0.35)'
        : 'rgba(255, 255, 255, 0.12)';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom: Math.max(insets.bottom + 80, 92),
          opacity,
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? 'rgba(20, 22, 25, 0.94)' : '#111317',
            borderColor: accentBorder,
          },
        ]}
      >
        <Text
          numberOfLines={2}
          style={[styles.text, { fontFamily: FONT_FAMILIES.sansMedium }]}
        >
          {toast.text}
        </Text>

        {toast.onUndo ? (
          <Pressable
            onPress={() => {
              const undoFn = toast.onUndo;
              onDismiss();
              if (undoFn) void undoFn();
            }}
            style={styles.undoBtn}
          >
            <RotateCcw size={13} color={BRAND_COLORS.emeraldText} />
            <Text
              style={[
                styles.undoText,
                { fontFamily: FONT_FAMILIES.sansBold },
              ]}
            >
              {toast.undoLabel ?? 'Undo'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  text: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  undoText: {
    color: BRAND_COLORS.emeraldText,
    fontSize: 12,
    fontWeight: '700',
  },
});
