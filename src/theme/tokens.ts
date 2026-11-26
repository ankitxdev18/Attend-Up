import type { TextStyle, ViewStyle } from 'react-native';

export const BRAND_COLORS = {
  primary: '#10B981',
  bright: '#34D399',
  deep: '#059669',
  tintBg: 'rgba(16, 185, 129, 0.14)',
  tintBorder: 'rgba(16, 185, 129, 0.32)',
  emerald: '#10B981',
  emeraldText: '#34D399',
  emeraldPresentBg: 'rgba(16, 185, 129, 0.14)',
  iconBadgeBg: '#181A1F',
  iconMonochrome: '#E4E4E7',
} as const;

export const SEMANTIC_COLORS = {
  present: '#34D399',
  absent: '#FB7185',
  halfDay: '#FBBF24',
  holiday: '#94A3B8',
} as const;

export const SUBJECT_COLORS = [
  '#10B981',
  '#38BDF8',
  '#818CF8',
  '#A78BFA',
  '#FB7185',
  '#FBBF24',
  '#2DD4BF',
  '#94A3B8',
] as const;

export type AmbientTone = 'healthy' | 'sapphire' | 'alert';

export const AMBIENT_GRADIENTS = {
  dark: {
    // Emerald atmospheric sweep: left-edge ribbon (spec: #0D5D30 → #053C1F → transparent)
    healthyPrimary: ['#0D5D30', '#053C1F', 'rgba(5, 6, 8, 0)'] as const,
    // Sapphire ambient breathing: right/lower-middle edge (spec: #0F1F40 → transparent)
    healthySecondary: ['#0F1F40', '#091428', 'rgba(5, 6, 8, 0)'] as const,
    sapphirePrimary: ['#0F1F40', '#070F22', 'rgba(5, 6, 8, 0)'] as const,
    sapphireSecondary: ['#1A3060', '#0A1838', 'rgba(5, 6, 8, 0)'] as const,
    alertPrimary: ['#561224', '#2A0913', 'rgba(5, 6, 8, 0)'] as const,
    alertSecondary: ['#68182E', '#330B17', 'rgba(5, 6, 8, 0)'] as const,
  },
  light: {
    healthyPrimary: ['rgba(16, 185, 129, 0.22)', 'rgba(232, 245, 238, 0.5)', 'rgba(247, 248, 250, 0)'] as const,
    healthySecondary: ['rgba(52, 211, 153, 0.16)', 'rgba(232, 245, 238, 0.25)', 'rgba(247, 248, 250, 0)'] as const,
    sapphirePrimary: ['rgba(59, 130, 246, 0.18)', 'rgba(233, 239, 251, 0.5)', 'rgba(247, 248, 250, 0)'] as const,
    sapphireSecondary: ['rgba(99, 102, 241, 0.14)', 'rgba(233, 239, 251, 0.25)', 'rgba(247, 248, 250, 0)'] as const,
    alertPrimary: ['rgba(251, 113, 133, 0.22)', 'rgba(252, 233, 238, 0.5)', 'rgba(247, 248, 250, 0)'] as const,
    alertSecondary: ['rgba(244, 63, 94, 0.16)', 'rgba(252, 233, 238, 0.25)', 'rgba(247, 248, 250, 0)'] as const,
  },
} as const;

export interface ThemePalette {
  isDark: boolean;
  background: string;
  card: string;
  sheet: string;
  dock: string;
  glass: string;
  capsuleTrack: string;
  capsuleActive: string;
  control: string;
  border: string;
  glassBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

export const DARK_PALETTE: ThemePalette = {
  isDark: true,
  background: '#050608',
  card: 'rgba(16, 20, 24, 0.72)',
  sheet: 'rgba(16, 20, 24, 0.92)',
  dock: 'rgba(16, 20, 24, 0.78)',
  glass: 'rgba(16, 20, 24, 0.72)',
  capsuleTrack: '#121417',
  capsuleActive: '#22252A',
  control: '#161920',
  border: 'rgba(255, 255, 255, 0.09)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
};

export const LIGHT_PALETTE: ThemePalette = {
  isDark: false,
  background: '#F7F8FA',
  card: '#FFFFFF',
  sheet: '#FFFFFF',
  dock: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.9)',
  capsuleTrack: '#EAECEF',
  capsuleActive: '#FFFFFF',
  control: '#F1F3F6',
  border: '#E5E7EB',
  glassBorder: '#E5E7EB',
  textPrimary: '#0F172A',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
};

export const FONT_FAMILIES = {
  sansRegular: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const TABULAR_NUMS: TextStyle = {
  fontVariant: ['tabular-nums'],
};

export const HEADING_STYLE: TextStyle = {
  letterSpacing: -0.4,
};

export const TACTILE_BUTTON_BASE: ViewStyle = {
  height: 46,
  borderRadius: 14,
  alignItems: 'center',
  justifyContent: 'center',
};

export const UI_METRICS = {
  buttonHeight: 46,
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 20,
  radiusXl: 24,
} as const;
