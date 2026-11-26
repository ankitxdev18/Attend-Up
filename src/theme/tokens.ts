import type { TextStyle, ViewStyle } from 'react-native';
import type { ThemeAccentId } from '../types/attendance';

export interface ThemeAccentPreset {
  id: ThemeAccentId;
  label: string;
  primary: string;
  bright: string;
  glow: string;
  tintBg: string;
  borderTint: string;
}

export const THEME_ACCENT_PRESETS: readonly ThemeAccentPreset[] = [
  {
    id: 'emerald',
    label: 'Emerald',
    primary: '#10B981',
    bright: '#34D399',
    glow: '#059669',
    tintBg: 'rgba(16, 185, 129, 0.16)',
    borderTint: 'rgba(16, 185, 129, 0.34)',
  },
  {
    id: 'sapphire',
    label: 'Sapphire',
    primary: '#3B82F6',
    bright: '#60A5FA',
    glow: '#2563EB',
    tintBg: 'rgba(59, 130, 246, 0.16)',
    borderTint: 'rgba(59, 130, 246, 0.34)',
  },
  {
    id: 'violet',
    label: 'Violet',
    primary: '#8B5CF6',
    bright: '#A78BFA',
    glow: '#7C3AED',
    tintBg: 'rgba(139, 92, 246, 0.16)',
    borderTint: 'rgba(139, 92, 246, 0.34)',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    primary: '#F43F5E',
    bright: '#FB7185',
    glow: '#E11D48',
    tintBg: 'rgba(244, 63, 94, 0.16)',
    borderTint: 'rgba(244, 63, 94, 0.34)',
  },
  {
    id: 'amber',
    label: 'Amber',
    primary: '#F59E0B',
    bright: '#FBBF24',
    glow: '#D97706',
    tintBg: 'rgba(245, 158, 11, 0.16)',
    borderTint: 'rgba(245, 158, 11, 0.34)',
  },
  {
    id: 'cyan',
    label: 'Cyan',
    primary: '#06B6D4',
    bright: '#22D3EE',
    glow: '#0891B2',
    tintBg: 'rgba(6, 182, 212, 0.16)',
    borderTint: 'rgba(6, 182, 212, 0.34)',
  },
] as const;

export function getThemeAccentPreset(id?: string | null): ThemeAccentPreset {
  return (
    THEME_ACCENT_PRESETS.find((preset) => preset.id === id) ??
    THEME_ACCENT_PRESETS[0]
  );
}

export const BRAND_COLORS = {
  emerald: '#10B981',
  emeraldText: '#34D399',
  emeraldPresentBg: 'rgba(16, 185, 129, 0.16)',
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
  card: '#0E1014',
  sheet: '#111317',
  dock: '#15171A',
  glass: 'rgba(20, 22, 25, 0.85)',
  capsuleTrack: '#121417',
  capsuleActive: '#22252A',
  control: '#161920',
  border: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#F4F5F7',
  textSecondary: '#8B909A',
  textMuted: '#555A64',
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
