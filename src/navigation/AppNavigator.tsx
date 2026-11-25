import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import {
  CheckSquare,
  ChevronRight,
  DatabaseBackup,
  FileSpreadsheet,
  Home,
  Moon,
  Search,
  Settings,
  Sun,
} from 'lucide-react-native';
import { useAttendance } from '../context/AttendanceContext';
import { computeAttendanceStats } from '../utils/attendance';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  HEADING_STYLE,
  SEMANTIC_COLORS,
  TABULAR_NUMS,
} from '../theme/tokens';
import type { HomeStackParamList, RootDrawerParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { SubjectDetailScreen } from '../screens/SubjectDetailScreen';
import { QuickAttendanceScreen } from '../screens/QuickAttendanceScreen';
import { SearchAttendanceScreen } from '../screens/SearchAttendanceScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { BackupRestoreScreen } from '../screens/BackupRestoreScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Drawer = createDrawerNavigator<RootDrawerParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeDashboard" component={HomeScreen} />
      <Stack.Screen name="SubjectDetail" component={SubjectDetailScreen} />
    </Stack.Navigator>
  );
}

const DRAWER_ITEMS: {
  route: keyof RootDrawerParamList;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}[] = [
  { route: 'HomeStack', label: 'Home', Icon: Home },
  { route: 'QuickAttendance', label: 'Quick Attendance', Icon: CheckSquare },
  { route: 'SearchAttendance', label: 'Search Attendance', Icon: Search },
  { route: 'Reports', label: 'Reports (PDF & Excel)', Icon: FileSpreadsheet },
  { route: 'BackupRestore', label: 'Backup & Restore', Icon: DatabaseBackup },
  { route: 'Settings', label: 'Settings', Icon: Settings },
];

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const {
    palette,
    isDark,
    toggleDarkMode,
    overallPercentage,
    subjects,
    records,
  } = useAttendance();
  const activeRouteName = props.state.routes[props.state.index]?.name;

  const hasData = records.some(
    (r) => r.status === 'present' || r.status === 'absent' || r.status === 'half_day'
  );
  const badgeColor =
    !hasData || overallPercentage >= 75
      ? BRAND_COLORS.emeraldText
      : SEMANTIC_COLORS.absent;

  const subjectSummaries = useMemo(() => {
    return subjects.map((sub) => {
      const subRecs = records.filter((r) => r.subjectId === sub.id);
      const stats = computeAttendanceStats(subRecs, sub.targetPercentage);
      const isAtRisk = stats.totalCounted > 0 && stats.percentage < sub.targetPercentage;
      return { subject: sub, stats, isAtRisk };
    });
  }, [subjects, records]);

  const atRiskCount = subjectSummaries.filter((s) => s.isAtRisk).length;
  const safeCount = subjectSummaries.length - atRiskCount;

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={[
        styles.drawerScroll,
        {
          paddingTop: Math.max(insets.top + 6, 16),
          paddingBottom: Math.max(insets.bottom + 16, 24),
        },
      ]}
    >
      {/* Top Summary Card */}
      <View
        style={[
          styles.drawerHeader,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandCol}>
            <View style={styles.brandTitleRow}>
              <Text
                style={[
                  styles.brandTitle,
                  HEADING_STYLE,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                Attend<Text style={{ color: palette.textSecondary }}>Up</Text>
              </Text>
              <View
                style={[
                  styles.offlinePill,
                  { backgroundColor: BRAND_COLORS.emeraldPresentBg },
                ]}
              >
                <View style={styles.offlineDot} />
                <Text
                  style={[
                    styles.offlineText,
                    {
                      color: BRAND_COLORS.emeraldText,
                      fontFamily: FONT_FAMILIES.sansSemiBold,
                    },
                  ]}
                >
                  Offline Ready
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={toggleDarkMode}
            style={[
              styles.themeToggleBtn,
              { backgroundColor: palette.control, borderColor: palette.border },
            ]}
            accessibilityLabel="Toggle dark or light theme"
          >
            {isDark ? (
              <Sun size={17} color={SEMANTIC_COLORS.halfDay} />
            ) : (
              <Moon size={17} color={palette.textPrimary} />
            )}
          </Pressable>
        </View>

        <View
          style={[
            styles.overallBadge,
            { backgroundColor: palette.control, borderColor: palette.border },
          ]}
        >
          <Text
            style={[
              styles.overallLabel,
              { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
            ]}
          >
            Overall Attendance
          </Text>
          <Text
            style={[
              styles.overallPct,
              TABULAR_NUMS,
              { color: badgeColor, fontFamily: FONT_FAMILIES.monoBold },
            ]}
          >
            {hasData ? `${overallPercentage.toFixed(1)}%` : '0.0%'}
          </Text>
        </View>

        {/* 2-Column Mini Stat Row */}
        <View style={styles.miniStatsRow}>
          <View
            style={[
              styles.miniStatBox,
              { backgroundColor: palette.control, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.miniStatVal,
                TABULAR_NUMS,
                { color: BRAND_COLORS.emeraldText, fontFamily: FONT_FAMILIES.monoBold },
              ]}
            >
              {safeCount}
            </Text>
            <Text
              style={[
                styles.miniStatLabel,
                { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansMedium },
              ]}
            >
              Safe Subjects
            </Text>
          </View>

          <View
            style={[
              styles.miniStatBox,
              { backgroundColor: palette.control, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.miniStatVal,
                TABULAR_NUMS,
                {
                  color:
                    atRiskCount > 0
                      ? SEMANTIC_COLORS.absent
                      : palette.textSecondary,
                  fontFamily: FONT_FAMILIES.monoBold,
                },
              ]}
            >
              {atRiskCount}
            </Text>
            <Text
              style={[
                styles.miniStatLabel,
                { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansMedium },
              ]}
            >
              At Risk
            </Text>
          </View>
        </View>
      </View>

      {/* Primary Navigation Links */}
      <View style={styles.navList}>
        {DRAWER_ITEMS.map(({ route, label, Icon }) => {
          const isActive = activeRouteName === route;
          return (
            <Pressable
              key={route}
              onPress={() => {
                if (route === 'HomeStack') {
                  props.navigation.navigate('HomeStack', { screen: 'HomeDashboard' });
                } else {
                  props.navigation.navigate(route);
                }
              }}
              style={[
                styles.navItem,
                {
                  backgroundColor: isActive
                    ? BRAND_COLORS.emeraldPresentBg
                    : 'transparent',
                  borderColor: isActive
                    ? 'rgba(16, 185, 129, 0.30)'
                    : 'transparent',
                },
              ]}
            >
              <Icon
                size={18}
                color={isActive ? BRAND_COLORS.emeraldText : palette.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: isActive
                      ? BRAND_COLORS.emeraldText
                      : palette.textPrimary,
                    fontFamily: isActive
                      ? FONT_FAMILIES.sansBold
                      : FONT_FAMILIES.sansMedium,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Hairline Divider + Quick Subject Jump */}
      <View style={[styles.divider, { backgroundColor: palette.border }]} />
      <Text
        style={[
          styles.quickJumpHeader,
          { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansBold },
        ]}
      >
        Quick Subject Jump
      </Text>
      <View style={styles.quickJumpList}>
        {subjectSummaries.map(({ subject, stats, isAtRisk }) => {
          const pctColor =
            stats.totalCounted === 0
              ? palette.textMuted
              : isAtRisk
                ? SEMANTIC_COLORS.absent
                : BRAND_COLORS.emeraldText;
          return (
            <Pressable
              key={subject.id}
              onPress={() => {
                props.navigation.navigate('HomeStack', {
                  screen: 'SubjectDetail',
                  params: { subjectId: subject.id },
                });
              }}
              style={[
                styles.quickJumpRow,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <View style={styles.quickJumpLeft}>
                <View
                  style={[styles.subjectDot, { backgroundColor: subject.color }]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.quickJumpName,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansMedium },
                  ]}
                >
                  {subject.name}
                </Text>
              </View>

              <View style={styles.quickJumpRight}>
                <Text
                  style={[
                    styles.quickJumpPct,
                    TABULAR_NUMS,
                    { color: pctColor, fontFamily: FONT_FAMILIES.monoBold },
                  ]}
                >
                  {stats.totalCounted > 0
                    ? `${Math.round(stats.percentage)}%`
                    : '0%'}
                </Text>
                <ChevronRight size={14} color={palette.textMuted} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </DrawerContentScrollView>
  );
}

export function AppNavigator() {
  const { palette, isDark } = useAttendance();

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: palette.background,
          card: palette.card,
          text: palette.textPrimary,
          border: palette.border,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: palette.background,
          card: palette.card,
          text: palette.textPrimary,
          border: palette.border,
        },
      };

  return (
    <NavigationContainer theme={navTheme}>
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          overlayColor: 'rgba(0, 0, 0, 0.68)',
          drawerStyle: {
            width: 300,
            backgroundColor: palette.background,
            borderRightWidth: 1,
            borderRightColor: palette.isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : palette.border,
          },
        }}
      >
        <Drawer.Screen name="HomeStack" component={HomeStackNavigator} />
        <Drawer.Screen name="QuickAttendance" component={QuickAttendanceScreen} />
        <Drawer.Screen name="SearchAttendance" component={SearchAttendanceScreen} />
        <Drawer.Screen name="Reports" component={ReportsScreen} />
        <Drawer.Screen name="BackupRestore" component={BackupRestoreScreen} />
        <Drawer.Screen name="Settings" component={SettingsScreen} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  drawerScroll: {
    paddingHorizontal: 14,
  },
  drawerHeader: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandCol: {
    flex: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  brandTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  offlineText: {
    fontSize: 10,
    fontWeight: '600',
  },
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  overallLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  overallPct: {
    fontSize: 15,
    fontWeight: '700',
  },
  miniStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniStatBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  miniStatVal: {
    fontSize: 16,
    fontWeight: '700',
  },
  miniStatLabel: {
    fontSize: 11,
    marginTop: 1,
  },
  navList: {
    gap: 6,
  },
  navItem: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  navLabel: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  quickJumpHeader: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  quickJumpList: {
    gap: 6,
  },
  quickJumpRow: {
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickJumpLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quickJumpName: {
    fontSize: 13,
    flex: 1,
  },
  quickJumpRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickJumpPct: {
    fontSize: 12,
  },
});
