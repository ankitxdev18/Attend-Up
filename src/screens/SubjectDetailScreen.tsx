import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Target,
  X,
} from 'lucide-react-native';
import type { HomeStackParamList, RootDrawerParamList } from '../navigation/types';
import type { AttendanceRecord, AttendanceStatus } from '../types/attendance';
import { useAttendance } from '../context/AttendanceContext';
import {
  computeAttendanceStats,
  computeMonthlyBreakdown,
  computeStreak,
  formatDateISO,
  formatDisplayDate,
  formatMonthKey,
  formatMonthLabel,
  formatPercent,
  getEffectiveStatus,
  getLast12WeeksGrid,
  getMonthGrid,
  parseMonthKey,
  shiftMonthKey,
  STATUS_META,
} from '../utils/attendance';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  HEADING_STYLE,
  SEMANTIC_COLORS,
  TABULAR_NUMS,
  UI_METRICS,
  type AmbientTone,
} from '../theme/tokens';
import { AmbientCanvas } from '../components/AmbientCanvas';
import { CircularProgressRing } from '../components/CircularProgressRing';
import { LiquidGlassCard } from '../components/LiquidGlassCard';
import { TactilePressable } from '../components/TactilePressable';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const HEATMAP_DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface CalendarDayCellProps {
  dateISO: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDark: boolean;
  tileBg: string;
  tileBorder: string;
  defaultTextColor: string;
  statusColor: string | null;
  statusShort: string | null;
  hasNote: boolean;
  hasOt: boolean;
  onSelectDay: (dateISO: string) => void;
  onLongPressDay: (dateISO: string) => void;
}

const CalendarDayCell = React.memo(function CalendarDayCell({
  dateISO,
  dayNumber,
  inCurrentMonth,
  isToday,
  isSelected,
  isDark,
  tileBg,
  tileBorder,
  defaultTextColor,
  statusColor,
  statusShort,
  hasNote,
  hasOt,
  onSelectDay,
  onLongPressDay,
}: CalendarDayCellProps) {
  const outerBorderColor = isSelected ? '#34D399' : tileBorder;
  const outerBorderWidth = isSelected ? 1.5 : 1;

  return (
    <View style={styles.dayCellSlot}>
      <Pressable
        onPress={() => onSelectDay(dateISO)}
        onLongPress={() => onLongPressDay(dateISO)}
        accessibilityRole="button"
        accessibilityLabel={`${dateISO}${statusShort ? `, ${statusShort}` : ''}${isToday ? ', Today' : ''}`}
        style={({ pressed }) => [
          styles.dayCell,
          {
            backgroundColor: tileBg,
            borderColor: outerBorderColor,
            borderWidth: outerBorderWidth,
            opacity: !inCurrentMonth ? 0.3 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.dayNum,
            TABULAR_NUMS,
            {
              color: isDark ? '#F8FAFC' : defaultTextColor,
              fontFamily: FONT_FAMILIES.monoMedium,
            },
          ]}
        >
          {dayNumber}
        </Text>

        {statusShort && statusColor ? (
          <Text
            style={[
              styles.microStatus,
              TABULAR_NUMS,
              {
                color: statusColor,
                fontFamily: FONT_FAMILIES.monoBold,
              },
            ]}
          >
            {statusShort}
          </Text>
        ) : null}

        {isToday || hasNote || hasOt ? (
          <View style={styles.dotIndicatorRow}>
            {isToday ? (
              <View style={[styles.microDot, { backgroundColor: '#34D399' }]} />
            ) : null}
            {hasNote ? (
              <View style={[styles.microDot, { backgroundColor: '#94A3B8' }]} />
            ) : null}
            {hasOt ? (
              <View
                style={[styles.microDot, { backgroundColor: SEMANTIC_COLORS.halfDay }]}
              />
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
});

interface HeatmapSquareProps {
  dateISO: string;
  isToday: boolean;
  cellBg: string;
  todayBorderColor: string;
  onPressDay: (dateISO: string) => void;
}

const HeatmapSquare = React.memo(function HeatmapSquare({
  dateISO,
  isToday,
  cellBg,
  todayBorderColor,
  onPressDay,
}: HeatmapSquareProps) {
  return (
    <Pressable
      onPress={() => onPressDay(dateISO)}
      style={[
        styles.heatmapSquare,
        {
          backgroundColor: cellBg,
          borderColor: isToday ? todayBorderColor : 'transparent',
          borderWidth: isToday ? 1.5 : 0,
        },
      ]}
    />
  );
});

export function SubjectDetailScreen() {
  const stackNav = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const drawerNav = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'SubjectDetail'>>();

  const {
    subjects,
    records,
    palette,
    isDark,
    openRecordEditor,
    markDayStatus,
    saveSubject,
    bulkMarkSubjectDates,
    showToast,
  } = useAttendance();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const subject = useMemo(
    () => subjects.find((s) => s.id === route.params.subjectId) ?? subjects[0],
    [subjects, route.params.subjectId]
  );

  const [monthKey, setMonthKey] = useState(() => formatMonthKey(new Date()));
  const [viewMode, setViewMode] = useState<'calendar' | 'heatmap'>('calendar');
  const [analyticsScope, setAnalyticsScope] = useState<'all' | 'month'>('all');
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const [noteQuery, setNoteQuery] = useState('');

  // What-If Bunk & Attendance Simulator Modal state
  const [simOpen, setSimOpen] = useState(Boolean(route.params.openSimulator));
  const [simPresent, setSimPresent] = useState(0);
  const [simAbsent, setSimAbsent] = useState(0);

  // Bulk Mark Modal state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('15');
  const [rangeStatus, setRangeStatus] =
    useState<Exclude<AttendanceStatus, null>>('present');

  const translateX = useSharedValue(0);
  const todayISO = formatDateISO(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayISO);
  const subjectId = subject?.id;
  const autoMarkSundays = subject?.autoMarkSundays ?? true;

  const handleSelectDay = useCallback((dateISO: string) => {
    void Haptics.selectionAsync();
    setSelectedDate(dateISO);
  }, []);

  const handleOpenDay = useCallback(
    (dateISO: string) => {
      if (!subjectId) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openRecordEditor(subjectId, dateISO);
    },
    [openRecordEditor, subjectId]
  );

  const subjectRecords = useMemo(() => {
    if (!subjectId) return [];
    return records.filter((r) => r.subjectId === subjectId);
  }, [records, subjectId]);

  const recordMap = useMemo(() => {
    const map = new Map<string, (typeof subjectRecords)[number]>();
    for (const r of subjectRecords) {
      map.set(r.date, r);
    }
    return map;
  }, [subjectRecords]);

  const todayRecord = recordMap.get(todayISO);
  const todayEffective = subject
    ? getEffectiveStatus(todayRecord, todayISO, autoMarkSundays)
    : { status: null, isAutoSunday: false };

  const calendarWeeks = useMemo(() => {
    const cells = getMonthGrid(monthKey);
    const weeks: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [monthKey]);

  const heatmapColumns = useMemo(() => {
    if (!subjectId) return [];
    return getLast12WeeksGrid(subjectRecords, autoMarkSundays);
  }, [subjectId, subjectRecords, autoMarkSundays]);

  const currentStreak = useMemo(() => {
    if (!subjectId) return 0;
    return computeStreak(subjectRecords, autoMarkSundays);
  }, [subjectId, subjectRecords, autoMarkSundays]);

  const weeklyStats = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    let attended = 0;
    let total = 0;
    for (let i = 0; i < 7; i += 1) {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      const iso = formatDateISO(dt);
      if (iso > todayISO) break;
      const rec = recordMap.get(iso);
      if (rec?.status === 'present') {
        const w = Math.max(1, Math.min(4, Math.round(rec.classesCount ?? 1)));
        attended += w;
        total += w;
      } else if (rec?.status === 'absent') {
        const w = Math.max(1, Math.min(4, Math.round(rec.classesCount ?? 1)));
        total += w;
      } else if (rec?.status === 'half_day') {
        const w = Math.max(1, Math.min(4, Math.round(rec.classesCount ?? 1)));
        attended += w * 0.5;
        total += w;
      }
    }
    return { attended, total };
  }, [recordMap, todayISO]);

  const scopedRecords = useMemo(() => {
    if (analyticsScope === 'all') return subjectRecords;
    return subjectRecords.filter((r) => r.date.startsWith(monthKey));
  }, [analyticsScope, monthKey, subjectRecords]);

  const stats = useMemo(
    () => computeAttendanceStats(scopedRecords, subject?.targetPercentage ?? 75),
    [scopedRecords, subject?.targetPercentage]
  );

  const allTimeStats = useMemo(
    () => computeAttendanceStats(subjectRecords, subject?.targetPercentage ?? 75),
    [subjectRecords, subject?.targetPercentage]
  );

  const simulatedStats = useMemo(() => {
    const synthetic: AttendanceRecord[] = [...subjectRecords];
    for (let i = 0; i < simPresent; i += 1) {
      synthetic.push({
        subjectId: subject?.id ?? '',
        date: '2099-01-01',
        status: 'present',
        overtimeHours: 0,
        shift: '',
        note: '',
        updatedAt: 0,
      });
    }
    for (let i = 0; i < simAbsent; i += 1) {
      synthetic.push({
        subjectId: subject?.id ?? '',
        date: '2099-01-02',
        status: 'absent',
        overtimeHours: 0,
        shift: '',
        note: '',
        updatedAt: 0,
      });
    }
    return computeAttendanceStats(synthetic, subject?.targetPercentage ?? 75);
  }, [subjectRecords, simPresent, simAbsent, subject?.id, subject?.targetPercentage]);

  const monthlyBreakdown = useMemo(
    () => computeMonthlyBreakdown(subjectRecords, subject?.targetPercentage ?? 75),
    [subjectRecords, subject?.targetPercentage]
  );

  const savedNotes = useMemo(() => {
    const q = noteQuery.trim().toLowerCase();
    return subjectRecords
      .filter((r) => r.note.trim().length > 0)
      .filter((r) => (q ? r.note.toLowerCase().includes(q) || r.date.includes(q) : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [subjectRecords, noteQuery]);

  const changeMonth = (delta: number) => {
    void Haptics.selectionAsync();
    setMonthKey((prev) => shiftMonthKey(prev, delta));
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = Math.max(-44, Math.min(44, e.translationX * 0.35));
    })
    .onEnd((e) => {
      if (e.translationX < -45 || e.velocityX < -450) {
        runOnJS(changeMonth)(1);
      } else if (e.translationX > 45 || e.velocityX > 450) {
        runOnJS(changeMonth)(-1);
      }
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const animatedGridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!subject) {
    return null;
  }

  const handleQuickTodayToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextStatus: Exclude<AttendanceStatus, null> =
      todayEffective.status === 'present' ? 'absent' : 'present';
    await markDayStatus(subject.id, todayISO, nextStatus);
  };

  const handleToggleSundayAuto = async () => {
    await Haptics.selectionAsync();
    const nextVal = !subject.autoMarkSundays;
    await saveSubject({
      id: subject.id,
      name: subject.name,
      targetPercentage: subject.targetPercentage,
      color: subject.color,
      autoMarkSundays: nextVal,
      scheduleDays: subject.scheduleDays,
    });
    showToast(`Sunday auto-holiday ${nextVal ? 'enabled' : 'disabled'}`, 'info');
  };

  const handleBulkUnmarkedWeekdays = async (scheduledOnly: boolean) => {
    const { year, monthIndex } = parseMonthKey(monthKey);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const datesToMark: string[] = [];

    for (let d = 1; d <= daysInMonth; d += 1) {
      const dt = new Date(year, monthIndex, d);
      const iso = formatDateISO(dt);
      if (iso > todayISO) break;
      const dow = dt.getDay();
      if (scheduledOnly) {
        if (!subject.scheduleDays.includes(dow)) continue;
      } else if (dow === 0) {
        continue;
      }
      const existing = recordMap.get(iso);
      if (!existing?.status) {
        datesToMark.push(iso);
      }
    }

    setBulkOpen(false);
    await bulkMarkSubjectDates(
      subject.id,
      datesToMark,
      'present',
      scheduledOnly
        ? `Bulk mark scheduled days (${monthKey})`
        : `Bulk mark unmarked weekdays (${monthKey})`
    );
  };

  const handleBulkRange = async () => {
    const { year, monthIndex } = parseMonthKey(monthKey);
    const maxDay = new Date(year, monthIndex + 1, 0).getDate();
    const s = Math.max(1, Math.min(maxDay, Number(rangeStart) || 1));
    const e = Math.max(s, Math.min(maxDay, Number(rangeEnd) || s));

    const datesToMark: string[] = [];
    for (let d = s; d <= e; d += 1) {
      const iso = formatDateISO(new Date(year, monthIndex, d));
      if (iso > todayISO) continue;
      datesToMark.push(iso);
    }

    if (datesToMark.length === 0) {
      showToast('Selected range contains only future dates.', 'info');
      return;
    }

    setBulkOpen(false);
    await bulkMarkSubjectDates(
      subject.id,
      datesToMark,
      rangeStatus,
      `Bulk mark range ${monthKey}-${String(s).padStart(2, '0')}..${String(e).padStart(2, '0')}`
    );
  };

  const isOnTrack =
    stats.totalCounted === 0 || stats.percentage >= subject.targetPercentage;
  const pctColor =
    stats.totalCounted === 0
      ? palette.textPrimary
      : isOnTrack
        ? BRAND_COLORS.emeraldText
        : SEMANTIC_COLORS.absent;
  const ambientTone: AmbientTone =
    stats.totalCounted === 0 ? 'sapphire' : isOnTrack ? 'healthy' : 'alert';

  const simDelta = simulatedStats.percentage - allTimeStats.percentage;
  const simOnTrack =
    simulatedStats.totalCounted === 0 ||
    simulatedStats.percentage >= subject.targetPercentage;
  const simDiffFromTarget = simulatedStats.percentage - subject.targetPercentage;

  const isTodayPresent = todayEffective.status === 'present';
  const isTodayAbsent = todayEffective.status === 'absent';

  return (
    <AmbientCanvas tone={ambientTone}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex1}>
        {/* Minimalist Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => stackNav.goBack()}
              style={[
                styles.circleBtn,
                {
                  backgroundColor: palette.glass,
                  borderColor: palette.glassBorder,
                },
              ]}
              accessibilityLabel="Back"
            >
              <ArrowLeft size={19} color={palette.textPrimary} />
            </Pressable>
            <View style={styles.titleWrap}>
              <Text
                numberOfLines={1}
                style={[
                  styles.headerTitle,
                  HEADING_STYLE,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                {subject.name}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.rightCapsule,
              {
                backgroundColor: palette.glass,
                borderColor: palette.glassBorder,
              },
            ]}
          >
            <Pressable
              onPress={() =>
                drawerNav.navigate('SearchAttendance', {
                  initialSubjectId: subject.id,
                })
              }
              style={styles.capsuleIconBtn}
              accessibilityLabel="Search subject logs"
            >
              <Search size={18} color={palette.textPrimary} strokeWidth={1.75} />
            </Pressable>
            <View
              style={[styles.capsuleDivider, { backgroundColor: palette.glassBorder }]}
            />
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setSimPresent(0);
                setSimAbsent(0);
                setSimOpen(true);
              }}
              style={styles.capsuleIconBtn}
              accessibilityLabel="Open What-If Bunk Simulator"
            >
              <Target size={18} color={BRAND_COLORS.emerald} strokeWidth={1.75} />
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex1}
        >
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 64 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Capsule Month Switcher */}
          <View
            style={[
              styles.monthSwitcher,
              {
                backgroundColor: palette.capsuleTrack,
                borderColor: palette.border,
              },
            ]}
          >
            <Pressable
              onPress={() => changeMonth(-1)}
              style={[styles.monthNavBtn, { backgroundColor: palette.capsuleActive }]}
            >
              <ChevronLeft size={15} color={palette.textPrimary} />
              <Text
                style={[
                  styles.monthNavText,
                  { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
                ]}
              >
                Prev
              </Text>
            </Pressable>

            <Text
              style={[
                styles.monthLabel,
                TABULAR_NUMS,
                { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
              ]}
            >
              {formatMonthLabel(monthKey, true).toUpperCase()}
            </Text>

            <Pressable
              onPress={() => changeMonth(1)}
              style={[styles.monthNavBtn, { backgroundColor: palette.capsuleActive }]}
            >
              <Text
                style={[
                  styles.monthNavText,
                  { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
                ]}
              >
                Next
              </Text>
              <ChevronRight size={15} color={palette.textPrimary} />
            </Pressable>
          </View>

          {/* Balanced 3-Column Action Row */}
          <View style={styles.quickOpsGrid}>
            <Pressable
              onPress={handleQuickTodayToggle}
              accessibilityRole="button"
              accessibilityLabel="Toggle today attendance"
              style={[
                styles.quickOpPill,
                {
                  backgroundColor: isTodayPresent
                    ? 'rgba(16, 185, 129, 0.16)'
                    : isTodayAbsent
                      ? 'rgba(248, 113, 113, 0.16)'
                      : palette.card,
                  borderColor: isTodayPresent
                    ? BRAND_COLORS.emerald
                    : isTodayAbsent
                      ? '#F87171'
                      : palette.border,
                },
              ]}
            >
              {isTodayAbsent ? (
                <X size={13} color="#F87171" />
              ) : (
                <Check size={13} color={BRAND_COLORS.emeraldText} />
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.quickOpText,
                  {
                    color: isTodayAbsent ? '#F87171' : BRAND_COLORS.emeraldText,
                    fontFamily: FONT_FAMILIES.sansBold,
                  },
                ]}
              >
                {isTodayAbsent ? 'Today A' : 'Today P'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setBulkOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Bulk mark dates"
              style={[
                styles.quickOpPill,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Layers size={13} color={palette.textPrimary} />
              <Text
                numberOfLines={1}
                style={[
                  styles.quickOpText,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                ]}
              >
                Bulk Mark
              </Text>
            </Pressable>

            <Pressable
              onPress={handleToggleSundayAuto}
              accessibilityRole="button"
              accessibilityLabel="Toggle Sunday auto holiday"
              style={[
                styles.quickOpPill,
                {
                  backgroundColor: subject.autoMarkSundays
                    ? 'rgba(16, 185, 129, 0.12)'
                    : palette.card,
                  borderColor: subject.autoMarkSundays
                    ? 'rgba(16, 185, 129, 0.30)'
                    : palette.border,
                },
              ]}
            >
              <CalendarOff
                size={13}
                color={
                  subject.autoMarkSundays
                    ? BRAND_COLORS.emeraldText
                    : palette.textMuted
                }
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.quickOpText,
                  {
                    color: subject.autoMarkSundays
                      ? BRAND_COLORS.emeraldText
                      : palette.textSecondary,
                    fontFamily: FONT_FAMILIES.sansSemiBold,
                  },
                ]}
              >
                Sun Off: {subject.autoMarkSundays ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>

          {/* Segmented View Toggle: Calendar | Heatmap */}
          <View
            style={[
              styles.viewToggleFull,
              {
                backgroundColor: palette.capsuleTrack,
                borderColor: palette.border,
              },
            ]}
          >
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setViewMode('calendar');
              }}
              accessibilityRole="button"
              accessibilityLabel="Calendar view"
              style={[
                styles.viewToggleFullBtn,
                viewMode === 'calendar' && {
                  backgroundColor: palette.capsuleActive,
                },
              ]}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  {
                    color:
                      viewMode === 'calendar'
                        ? palette.textPrimary
                        : palette.textMuted,
                    fontFamily: FONT_FAMILIES.sansBold,
                  },
                ]}
              >
                Calendar
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setViewMode('heatmap');
              }}
              accessibilityRole="button"
              accessibilityLabel="Heatmap view"
              style={[
                styles.viewToggleFullBtn,
                viewMode === 'heatmap' && {
                  backgroundColor: palette.capsuleActive,
                },
              ]}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  {
                    color:
                      viewMode === 'heatmap'
                        ? palette.textPrimary
                        : palette.textMuted,
                    fontFamily: FONT_FAMILIES.sansBold,
                  },
                ]}
              >
                Heatmap
              </Text>
            </Pressable>
          </View>

          {/* Monthly Calendar Grid OR 12-Week GitHub Heatmap */}
          {viewMode === 'calendar' ? (
            <GestureDetector gesture={panGesture}>
              <Animated.View style={animatedGridStyle}>
                <LiquidGlassCard
                  borderRadius={24}
                  useNativeBlur
                  style={styles.calendarCard}
                >
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((day, idx) => (
                    <View key={day} style={styles.weekdayCell}>
                      <Text
                        style={[
                          styles.weekdayText,
                          {
                            color: idx === 0 ? palette.textSecondary : palette.textMuted,
                            fontFamily: FONT_FAMILIES.sansBold,
                          },
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.weeksWrap}>
                  {calendarWeeks.map((week, wIdx) => (
                    <View key={`wk-${wIdx}`} style={styles.weekRow}>
                      {week.map((cell) => {
                        const rec = recordMap.get(cell.dateISO);
                        const { status } = getEffectiveStatus(
                          rec,
                          cell.dateISO,
                          subject.autoMarkSundays
                        );
                        const meta = status ? STATUS_META[status] : null;
                        const hasNote = Boolean(rec?.note?.trim());
                        const hasOt = Boolean(rec && rec.overtimeHours > 0);

                        const count = Math.max(1, Math.min(4, Math.round(rec?.classesCount ?? 1)));
                        const shortLabel = meta
                          ? count > 1 && (status === 'present' || status === 'absent')
                            ? `${count}${meta.short}`
                            : meta.short
                          : null;

                        let tileBg = isDark
                          ? 'rgba(255, 255, 255, 0.03)'
                          : palette.control;
                        let tileBorder = isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : palette.border;
                        let statusColor: string | null = null;

                        if (status === 'present') {
                          tileBg = 'rgba(16, 185, 129, 0.16)';
                          tileBorder = 'rgba(16, 185, 129, 0.35)';
                          statusColor = '#34D399';
                        } else if (status === 'absent') {
                          tileBg = 'rgba(248, 113, 113, 0.16)';
                          tileBorder = 'rgba(248, 113, 113, 0.35)';
                          statusColor = '#F87171';
                        } else if (status === 'half_day') {
                          tileBg = 'rgba(251, 191, 36, 0.16)';
                          tileBorder = 'rgba(251, 191, 36, 0.35)';
                          statusColor = '#FBBF24';
                        } else if (status) {
                          tileBg = 'rgba(148, 163, 184, 0.12)';
                          tileBorder = 'rgba(148, 163, 184, 0.24)';
                          statusColor = '#94A3B8';
                        } else if (!cell.inCurrentMonth) {
                          tileBg = 'transparent';
                          tileBorder = 'transparent';
                        }

                        return (
                          <CalendarDayCell
                            key={cell.dateISO}
                            dateISO={cell.dateISO}
                            dayNumber={cell.dayNumber}
                            inCurrentMonth={cell.inCurrentMonth}
                            isToday={cell.isToday}
                            isSelected={selectedDate === cell.dateISO}
                            isDark={isDark}
                            tileBg={tileBg}
                            tileBorder={tileBorder}
                            defaultTextColor={palette.textPrimary}
                            statusColor={statusColor}
                            statusShort={shortLabel}
                            hasNote={hasNote}
                            hasOt={hasOt}
                            onSelectDay={handleSelectDay}
                            onLongPressDay={handleOpenDay}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
                </LiquidGlassCard>
              </Animated.View>
            </GestureDetector>
          ) : (
            <LiquidGlassCard
              borderRadius={24}
              useNativeBlur
              style={styles.heatmapCard}
            >
              <View style={styles.heatmapTopRow}>
                <View>
                  <Text
                    style={[
                      styles.heatmapTitle,
                      HEADING_STYLE,
                      { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                    ]}
                  >
                    12-Week Contribution Heatmap
                  </Text>
                  <Text
                    style={[
                      styles.heatmapSub,
                      { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansMedium },
                    ]}
                  >
                    Tap any square to inspect or edit that day
                  </Text>
                </View>
                <View
                  style={[
                    styles.streakBadge,
                    { backgroundColor: BRAND_COLORS.emeraldPresentBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.streakText,
                      TABULAR_NUMS,
                      {
                        color: BRAND_COLORS.emeraldText,
                        fontFamily: FONT_FAMILIES.monoBold,
                      },
                    ]}
                  >
                    {currentStreak}d streak
                  </Text>
                </View>
              </View>

              <View style={styles.heatmapBody}>
                <View style={styles.heatmapDayCol}>
                  {HEATMAP_DAY_LABELS.map((lbl, i) => (
                    <Text
                      key={`hl-${i}`}
                      style={[
                        styles.heatmapDayLbl,
                        { color: palette.textMuted, fontFamily: FONT_FAMILIES.monoMedium },
                      ]}
                    >
                      {lbl}
                    </Text>
                  ))}
                </View>

                <View style={styles.heatmapGrid}>
                  {heatmapColumns.map((col, colIdx) => (
                    <View key={`hc-${colIdx}`} style={styles.heatmapCol}>
                      {col.map((cell) => {
                        const cellBg = cell.isFuture
                          ? palette.background
                          : cell.status === 'present'
                            ? BRAND_COLORS.emerald
                            : cell.status === 'absent'
                              ? SEMANTIC_COLORS.absent
                              : cell.status === 'half_day'
                                ? SEMANTIC_COLORS.halfDay
                                : palette.control;

                        return (
                          <HeatmapSquare
                            key={cell.dateISO}
                            dateISO={cell.dateISO}
                            isToday={cell.isToday}
                            cellBg={cellBg}
                            todayBorderColor={palette.textPrimary}
                            onPressDay={handleOpenDay}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.heatmapLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: BRAND_COLORS.emerald }]} />
                  <Text style={[styles.legendTxt, { color: palette.textSecondary }]}>Present</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SEMANTIC_COLORS.absent }]} />
                  <Text style={[styles.legendTxt, { color: palette.textSecondary }]}>Absent</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SEMANTIC_COLORS.halfDay }]} />
                  <Text style={[styles.legendTxt, { color: palette.textSecondary }]}>Half Day</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: palette.control }]} />
                  <Text style={[styles.legendTxt, { color: palette.textSecondary }]}>Off / Unmarked</Text>
                </View>
              </View>
            </LiquidGlassCard>
          )}

          {/* Inline Date Action Bar (1-tap calendar marking) */}
          {viewMode === 'calendar' && selectedDate ? (
            <LiquidGlassCard borderRadius={20} style={styles.dateActionBar}>
              <View style={styles.dateActionHeaderCol}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.dateActionTitle,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                  ]}
                >
                  Selected: {formatDisplayDate(selectedDate)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.dateActionHint,
                    {
                      color: selectedDate > todayISO ? '#F87171' : palette.textMuted,
                      fontFamily: FONT_FAMILIES.sansMedium,
                    },
                  ]}
                >
                  {selectedDate > todayISO
                    ? 'Future date — upcoming days cannot be marked'
                    : 'Tap status below · Long-press date for notes'}
                </Text>
              </View>
              <View style={styles.dateActionGrid}>
                {(
                  [
                    { label: 'Present', status: 'present' as const, color: '#34D399', bg: 'rgba(16, 185, 129, 0.16)', border: 'rgba(16, 185, 129, 0.35)' },
                    { label: 'Absent', status: 'absent' as const, color: '#F87171', bg: 'rgba(248, 113, 113, 0.16)', border: 'rgba(248, 113, 113, 0.35)' },
                    { label: 'Half Day', status: 'half_day' as const, color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.16)', border: 'rgba(251, 191, 36, 0.35)' },
                    { label: 'Holiday', status: 'holiday' as const, color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.24)' },
                  ] as const
                ).map((btn) => {
                  const isFuture = selectedDate > todayISO;
                  return (
                    <TactilePressable
                      key={btn.status}
                      disabled={isFuture}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${selectedDate} ${btn.label}`}
                      onPress={() => {
                        void markDayStatus(subject.id, selectedDate, btn.status);
                      }}
                      style={[
                        styles.dateActionBtn,
                        {
                          backgroundColor: btn.bg,
                          borderColor: btn.border,
                          opacity: isFuture ? 0.38 : 1,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.dateActionBtnText,
                          { color: btn.color, fontFamily: FONT_FAMILIES.sansBold },
                        ]}
                      >
                        {btn.label}
                      </Text>
                    </TactilePressable>
                  );
                })}
                <TactilePressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open note and lecture editor for ${selectedDate}`}
                  onPress={() => openRecordEditor(subject.id, selectedDate)}
                  style={[
                    styles.dateActionBtn,
                    { backgroundColor: palette.control, borderColor: palette.border },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.dateActionBtnText,
                      { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                    ]}
                  >
                    Note
                  </Text>
                </TactilePressable>
                <TactilePressable
                  disabled={selectedDate > todayISO}
                  accessibilityRole="button"
                  accessibilityLabel={`Clear status for ${selectedDate}`}
                  onPress={() => {
                    void markDayStatus(subject.id, selectedDate, null);
                  }}
                  style={[
                    styles.dateActionBtn,
                    {
                      backgroundColor: palette.control,
                      borderColor: palette.border,
                      opacity: selectedDate > todayISO ? 0.38 : 1,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.dateActionBtnText,
                      { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansSemiBold },
                    ]}
                  >
                    Clear
                  </Text>
                </TactilePressable>
              </View>
            </LiquidGlassCard>
          ) : null}

          {/* Primary Analytics & Predictor Bento Card */}
          <View
            style={[
              styles.analyticsCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={styles.analyticsTopRow}>
              <View style={styles.analyticsLeftCol}>
                <Text
                  style={[
                    styles.pctBig,
                    TABULAR_NUMS,
                    { color: pctColor, fontFamily: FONT_FAMILIES.monoBold },
                  ]}
                >
                  {stats.totalCounted > 0
                    ? formatPercent(stats.percentage, 1)
                    : '0.0%'}
                </Text>
                <Text
                  style={[
                    styles.predictorLine,
                    { color: pctColor, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  {stats.predictorLine}
                </Text>
              </View>

              <View style={styles.scopeRightCol}>
                <View
                  style={[
                    styles.weeklyPill,
                    {
                      backgroundColor: BRAND_COLORS.tintBg,
                      borderColor: BRAND_COLORS.tintBorder,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.weeklyPillText,
                      TABULAR_NUMS,
                      { color: BRAND_COLORS.bright, fontFamily: FONT_FAMILIES.monoBold },
                    ]}
                  >
                    Week: {weeklyStats.attended}/{weeklyStats.total}
                  </Text>
                </View>

                <View
                  style={[
                    styles.scopeToggle,
                    {
                      backgroundColor: palette.capsuleTrack,
                      borderColor: palette.border,
                    },
                  ]}
                >
                <Pressable
                  onPress={() => setAnalyticsScope('all')}
                  style={[
                    styles.scopeBtn,
                    analyticsScope === 'all' && {
                      backgroundColor: palette.capsuleActive,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.scopeText,
                      {
                        color:
                          analyticsScope === 'all'
                            ? palette.textPrimary
                            : palette.textMuted,
                        fontFamily: FONT_FAMILIES.sansBold,
                      },
                    ]}
                  >
                    All Months
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setAnalyticsScope('month')}
                  style={[
                    styles.scopeBtn,
                    analyticsScope === 'month' && {
                      backgroundColor: palette.capsuleActive,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.scopeText,
                      {
                        color:
                          analyticsScope === 'month'
                            ? palette.textPrimary
                            : palette.textMuted,
                        fontFamily: FONT_FAMILIES.sansBold,
                      },
                    ]}
                  >
                    This Month
                  </Text>
                </Pressable>
                </View>
              </View>
            </View>

            {/* 2x2 Tabular Stat Grid */}
            <View style={styles.statGrid}>
              <View
                style={[
                  styles.statBox,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <Text
                  style={[
                    styles.statLabel,
                    { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  Present
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    TABULAR_NUMS,
                    { color: BRAND_COLORS.emeraldText, fontFamily: FONT_FAMILIES.monoBold },
                  ]}
                >
                  {stats.present}
                </Text>
              </View>
              <View
                style={[
                  styles.statBox,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <Text
                  style={[
                    styles.statLabel,
                    { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  Absent
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    TABULAR_NUMS,
                    { color: SEMANTIC_COLORS.absent, fontFamily: FONT_FAMILIES.monoBold },
                  ]}
                >
                  {stats.absent}
                </Text>
              </View>
              <View
                style={[
                  styles.statBox,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <Text
                  style={[
                    styles.statLabel,
                    { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  Half Days
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    TABULAR_NUMS,
                    { color: SEMANTIC_COLORS.halfDay, fontFamily: FONT_FAMILIES.monoBold },
                  ]}
                >
                  {stats.halfDays}
                </Text>
              </View>
              <View
                style={[
                  styles.statBox,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <Text
                  style={[
                    styles.statLabel,
                    { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  OT Hours
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    TABULAR_NUMS,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.monoBold },
                  ]}
                >
                  {stats.overtimeHours}h
                </Text>
              </View>
            </View>

            {/* Spacious Simulator Preview Card */}
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setSimPresent(0);
                setSimAbsent(0);
                setSimOpen(true);
              }}
              style={[
                styles.simPreviewCard,
                {
                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                  borderColor: 'rgba(16, 185, 129, 0.30)',
                },
              ]}
            >
              <View
                style={[
                  styles.simPreviewIconWrap,
                  { backgroundColor: 'rgba(16, 185, 129, 0.20)' },
                ]}
              >
                <Target size={18} color={BRAND_COLORS.emerald} />
              </View>
              <View style={styles.simPreviewTextWrap}>
                <Text
                  style={[
                    styles.simPreviewTitle,
                    { color: BRAND_COLORS.emeraldText, fontFamily: FONT_FAMILIES.sansBold },
                  ]}
                >
                  What-If Bunk & Attendance Simulator
                </Text>
                <Text
                  style={[
                    styles.simPreviewSub,
                    { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
                  ]}
                >
                  Simulate upcoming classes before taking leave
                </Text>
              </View>
              <ArrowRight size={18} color={BRAND_COLORS.emeraldText} />
            </Pressable>

            {/* Expandable More Info */}
            <Pressable
              onPress={() => setMoreInfoOpen((v) => !v)}
              style={[
                styles.moreInfoBtn,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <Text
                style={[
                  styles.moreInfoLabel,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                ]}
              >
                More info · Monthly breakdown & notes ({savedNotes.length})
              </Text>
              {moreInfoOpen ? (
                <ChevronUp size={18} color={palette.textSecondary} />
              ) : (
                <ChevronDown size={18} color={palette.textSecondary} />
              )}
            </Pressable>

            {moreInfoOpen ? (
              <View style={styles.moreInfoBody}>
                <Text
                  style={[
                    styles.subSectionTitle,
                    { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansBold },
                  ]}
                >
                  Month-by-month breakdown
                </Text>
                {monthlyBreakdown.length === 0 ? (
                  <Text
                    style={[
                      styles.mutedNote,
                      { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansRegular },
                    ]}
                  >
                    No attendance entries recorded yet.
                  </Text>
                ) : (
                  monthlyBreakdown.map((row) => {
                    const ok =
                      row.stats.totalCounted === 0 ||
                      row.stats.percentage >= subject.targetPercentage;
                    return (
                      <View
                        key={row.monthKey}
                        style={[
                          styles.monthRow,
                          { borderBottomColor: palette.border },
                        ]}
                      >
                        <View>
                          <Text
                            style={[
                              styles.monthRowTitle,
                              { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                            ]}
                          >
                            {row.label}
                          </Text>
                          <Text
                            style={[
                              styles.monthRowSub,
                              TABULAR_NUMS,
                              { color: palette.textMuted, fontFamily: FONT_FAMILIES.monoMedium },
                            ]}
                          >
                            {row.stats.present}P · {row.stats.absent}A ·{' '}
                            {row.stats.halfDays}HD · {row.stats.overtimeHours}h OT
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.monthRowPct,
                            TABULAR_NUMS,
                            {
                              color: ok
                                ? BRAND_COLORS.emeraldText
                                : SEMANTIC_COLORS.absent,
                              fontFamily: FONT_FAMILIES.monoBold,
                            },
                          ]}
                        >
                          {row.stats.percentage.toFixed(1)}%
                        </Text>
                      </View>
                    );
                  })
                )}

                <Text
                  style={[
                    styles.subSectionTitle,
                    {
                      color: palette.textSecondary,
                      marginTop: 14,
                      fontFamily: FONT_FAMILIES.sansBold,
                    },
                  ]}
                >
                  Saved notes
                </Text>
                <View style={styles.noteFilterRow}>
                  <TextInput
                    value={noteQuery}
                    onChangeText={setNoteQuery}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollRef.current?.scrollToEnd({ animated: true });
                      }, 180);
                    }}
                    placeholder="Filter saved notes..."
                    placeholderTextColor={palette.textMuted}
                    style={[
                      styles.noteSearchInput,
                      {
                        flex: 1,
                        marginBottom: 0,
                        backgroundColor: palette.control,
                        borderColor: palette.border,
                        color: palette.textPrimary,
                        fontFamily: FONT_FAMILIES.sansRegular,
                      },
                    ]}
                  />
                  {noteQuery.trim().length > 0 ? (
                    <Pressable
                      onPress={() => {
                        Keyboard.dismiss();
                      }}
                      style={[
                        styles.noteFilterDoneBtn,
                        { backgroundColor: BRAND_COLORS.primary },
                      ]}
                      accessibilityLabel="Done filtering notes"
                    >
                      <Check size={16} color="#050608" strokeWidth={2.5} />
                    </Pressable>
                  ) : null}
                </View>
                {savedNotes.length === 0 ? (
                  <Text
                    style={[
                      styles.mutedNote,
                      { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansRegular },
                    ]}
                  >
                    No saved notes match your filter.
                  </Text>
                ) : (
                  savedNotes.map((rec) => (
                    <Pressable
                      key={rec.date}
                      onPress={() => openRecordEditor(subject.id, rec.date)}
                      style={[
                        styles.noteCard,
                        {
                          backgroundColor: palette.control,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.noteDate,
                          TABULAR_NUMS,
                          { color: palette.textSecondary, fontFamily: FONT_FAMILIES.monoMedium },
                        ]}
                      >
                        {formatDisplayDate(rec.date)}
                      </Text>
                      <Text
                        style={[
                          styles.noteBody,
                          { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansRegular },
                        ]}
                      >
                        {rec.note}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Bulk Mark Sheet Modal */}
      <Modal
        visible={bulkOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBulkOpen(false)}
      >
        <Pressable style={styles.modalOverlayBottom} onPress={() => setBulkOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.bulkSheetCard,
              { backgroundColor: palette.sheet, borderColor: palette.border },
            ]}
          >
            <View style={styles.simHeader}>
              <View>
                <Text
                  style={[
                    styles.simTitle,
                    HEADING_STYLE,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                  ]}
                >
                  Bulk Mark · {formatMonthLabel(monthKey, true)}
                </Text>
                <Text
                  style={[
                    styles.simSub,
                    { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
                  ]}
                >
                  Saves a safety snapshot automatically before updating
                </Text>
              </View>
              <Pressable
                onPress={() => setBulkOpen(false)}
                style={[styles.simCloseBtn, { backgroundColor: palette.control }]}
              >
                <X size={18} color={palette.textPrimary} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => void handleBulkUnmarkedWeekdays(false)}
              style={[
                styles.bulkActionBtn,
                {
                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                  borderColor: 'rgba(16, 185, 129, 0.30)',
                },
              ]}
            >
              <CalendarDays size={17} color={BRAND_COLORS.emeraldText} />
              <Text
                style={[
                  styles.bulkActionText,
                  { color: BRAND_COLORS.emeraldText, fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                Mark all unmarked weekdays Present
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void handleBulkUnmarkedWeekdays(true)}
              style={[
                styles.bulkActionBtn,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <Check size={17} color={palette.textPrimary} />
              <Text
                style={[
                  styles.bulkActionText,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                ]}
              >
                Mark unmarked scheduled days Present
              </Text>
            </Pressable>

            <View style={[styles.rangeBox, { backgroundColor: palette.control, borderColor: palette.border }]}>
              <Text
                style={[
                  styles.rangeTitle,
                  { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
                ]}
              >
                Mark range of dates (day of month)
              </Text>
              <View style={styles.rangeInputsRow}>
                <TextInput
                  value={rangeStart}
                  onChangeText={(t) => setRangeStart(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="From"
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.rangeInput,
                    TABULAR_NUMS,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                      color: palette.textPrimary,
                      fontFamily: FONT_FAMILIES.monoBold,
                    },
                  ]}
                />
                <Text style={{ color: palette.textMuted }}>to</Text>
                <TextInput
                  value={rangeEnd}
                  onChangeText={(t) => setRangeEnd(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="To"
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.rangeInput,
                    TABULAR_NUMS,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                      color: palette.textPrimary,
                      fontFamily: FONT_FAMILIES.monoBold,
                    },
                  ]}
                />
              </View>

              <View style={styles.rangeStatusRow}>
                {(['present', 'absent', 'holiday'] as const).map((st) => {
                  const meta = STATUS_META[st];
                  const active = rangeStatus === st;
                  return (
                    <Pressable
                      key={st}
                      onPress={() => setRangeStatus(st)}
                      style={[
                        styles.rangeStatusPill,
                        {
                          backgroundColor: active ? meta.tintBg : palette.card,
                          borderColor: active ? meta.color : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? meta.color : palette.textSecondary,
                          fontSize: 12,
                          fontFamily: FONT_FAMILIES.sansSemiBold,
                        }}
                      >
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => void handleBulkRange()}
                style={[styles.rangeApplyBtn, { backgroundColor: BRAND_COLORS.emerald }]}
              >
                <Text style={[styles.simDoneText, { fontFamily: FONT_FAMILIES.sansBold }]}>
                  Apply to date range
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Interactive "What-If" Bunk & Attendance Simulator Modal */}
      <Modal
        visible={simOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSimOpen(false)}
      >
        <Pressable style={styles.modalOverlayBottom} onPress={() => setSimOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.simModalCard,
              {
                backgroundColor: isDark ? '#0E1114' : '#FFFFFF',
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.simHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text
                  style={[
                    styles.simTitle,
                    HEADING_STYLE,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                  ]}
                >
                  What-If Bunk & Attendance Simulator
                </Text>
                <Text
                  style={[
                    styles.simSub,
                    { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
                  ]}
                >
                  {subject.name} · Target {subject.targetPercentage}%
                </Text>
              </View>
              <Pressable
                onPress={() => setSimOpen(false)}
                style={[styles.simCloseBtn, { backgroundColor: palette.control }]}
              >
                <X size={18} color={palette.textPrimary} />
              </Pressable>
            </View>

            {/* Hero Projected Ring + Current -> Simulated Comparison */}
            <View
              style={[
                styles.simResultBox,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <CircularProgressRing
                percentage={simulatedStats.percentage}
                targetPercentage={subject.targetPercentage}
                hasData={simulatedStats.totalCounted > 0}
                size={68}
                strokeWidth={6}
                trackColor={palette.card}
                textColor={palette.textPrimary}
              />

              <View style={styles.simCompareCol}>
                <View style={styles.simCompareRow}>
                  <Text
                    style={[
                      styles.simComparePct,
                      TABULAR_NUMS,
                      { color: palette.textSecondary, fontFamily: FONT_FAMILIES.monoMedium },
                    ]}
                  >
                    {formatPercent(allTimeStats.percentage, 1)}
                  </Text>
                  <ArrowRight size={14} color={palette.textMuted} />
                  <Text
                    style={[
                      styles.simProjectedPct,
                      TABULAR_NUMS,
                      {
                        color: simOnTrack
                          ? BRAND_COLORS.emeraldText
                          : SEMANTIC_COLORS.absent,
                        fontFamily: FONT_FAMILIES.monoBold,
                      },
                    ]}
                  >
                    {formatPercent(simulatedStats.percentage, 1)}
                  </Text>
                  {simPresent > 0 || simAbsent > 0 ? (
                    <View
                      style={[
                        styles.deltaPill,
                        {
                          backgroundColor:
                            simDelta >= 0
                              ? 'rgba(16, 185, 129, 0.16)'
                              : 'rgba(251, 113, 133, 0.16)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.simDelta,
                          TABULAR_NUMS,
                          {
                            color:
                              simDelta >= 0
                                ? BRAND_COLORS.emeraldText
                                : SEMANTIC_COLORS.absent,
                            fontFamily: FONT_FAMILIES.monoBold,
                          },
                        ]}
                      >
                        {simDelta >= 0
                          ? `+${formatPercent(simDelta, 1)}`
                          : formatPercent(simDelta, 1)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text
                  style={[
                    styles.simCounts,
                    TABULAR_NUMS,
                    { color: palette.textMuted, fontFamily: FONT_FAMILIES.monoMedium },
                  ]}
                >
                  {simulatedStats.countsSummary}
                </Text>
              </View>
            </View>

            {/* Crystal-Clear Live Verdict Banner */}
            <View
              style={[
                styles.verdictBanner,
                {
                  backgroundColor: simOnTrack
                    ? 'rgba(16, 185, 129, 0.14)'
                    : 'rgba(251, 113, 133, 0.14)',
                  borderColor: simOnTrack
                    ? 'rgba(16, 185, 129, 0.30)'
                    : 'rgba(251, 113, 133, 0.30)',
                },
              ]}
            >
              <Text
                style={[
                  styles.verdictText,
                  {
                    color: simOnTrack
                      ? BRAND_COLORS.emeraldText
                      : SEMANTIC_COLORS.absent,
                    fontFamily: FONT_FAMILIES.sansSemiBold,
                  },
                ]}
              >
                {simulatedStats.totalCounted === 0
                  ? 'Add simulated classes below to preview your projected percentage.'
                  : simOnTrack
                    ? simDiffFromTarget >= 0.05
                      ? `Safe — you will still be ${simDiffFromTarget.toFixed(1)}% above your ${subject.targetPercentage}% target.`
                      : `On track — you will sit right at your ${subject.targetPercentage}% target.`
                    : `Warning — you will drop below ${subject.targetPercentage}% and need ${simulatedStats.neededForTarget} extra ${simulatedStats.neededForTarget === 1 ? 'class' : 'classes'} to recover.`}
              </Text>
            </View>

            {/* Large 48x48 Stepper Controls */}
            <View style={styles.simControlsRow}>
              <View
                style={[
                  styles.simStepperCard,
                  {
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    borderColor: 'rgba(16, 185, 129, 0.30)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.simStepperLabel,
                    { color: BRAND_COLORS.emeraldText, fontFamily: FONT_FAMILIES.sansBold },
                  ]}
                >
                  Attend
                </Text>
                <View style={styles.simStepperBtns}>
                  <TactilePressable
                    onPress={() => setSimPresent((v) => Math.max(0, v - 1))}
                    style={[styles.simStepBtn, { backgroundColor: palette.card }]}
                  >
                    <Minus size={18} color={palette.textPrimary} />
                  </TactilePressable>
                  <Text
                    style={[
                      styles.simStepVal,
                      TABULAR_NUMS,
                      { color: palette.textPrimary, fontFamily: FONT_FAMILIES.monoBold },
                    ]}
                  >
                    +{simPresent}
                  </Text>
                  <TactilePressable
                    onPress={() => setSimPresent((v) => Math.min(50, v + 1))}
                    style={[styles.simStepBtn, { backgroundColor: BRAND_COLORS.primary }]}
                  >
                    <Plus size={18} color="#050608" />
                  </TactilePressable>
                </View>
              </View>

              <View
                style={[
                  styles.simStepperCard,
                  {
                    backgroundColor: 'rgba(251, 113, 133, 0.12)',
                    borderColor: 'rgba(251, 113, 133, 0.30)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.simStepperLabel,
                    { color: SEMANTIC_COLORS.absent, fontFamily: FONT_FAMILIES.sansBold },
                  ]}
                >
                  Bunk / Skip
                </Text>
                <View style={styles.simStepperBtns}>
                  <TactilePressable
                    onPress={() => setSimAbsent((v) => Math.max(0, v - 1))}
                    style={[styles.simStepBtn, { backgroundColor: palette.card }]}
                  >
                    <Minus size={18} color={palette.textPrimary} />
                  </TactilePressable>
                  <Text
                    style={[
                      styles.simStepVal,
                      TABULAR_NUMS,
                      { color: palette.textPrimary, fontFamily: FONT_FAMILIES.monoBold },
                    ]}
                  >
                    +{simAbsent}
                  </Text>
                  <TactilePressable
                    onPress={() => setSimAbsent((v) => Math.min(50, v + 1))}
                    style={[styles.simStepBtn, { backgroundColor: SEMANTIC_COLORS.absent }]}
                  >
                    <Plus size={18} color="#050608" />
                  </TactilePressable>
                </View>
              </View>
            </View>

            {/* Quick Preset Chips */}
            <View style={styles.presetRow}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSimAbsent((v) => Math.min(50, v + 2));
                }}
                style={[
                  styles.presetChip,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.presetText, { color: palette.textPrimary }]}>
                  Bunk next 2
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSimAbsent((v) => Math.min(50, v + 5));
                }}
                style={[
                  styles.presetChip,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.presetText, { color: palette.textPrimary }]}>
                  Bunk next 5
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSimPresent((v) => Math.min(50, v + 5));
                }}
                style={[
                  styles.presetChip,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.presetText, { color: BRAND_COLORS.emeraldText }]}>
                  Attend next 5
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSimPresent(0);
                  setSimAbsent(0);
                }}
                style={[
                  styles.presetChip,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <RotateCcw size={12} color={palette.textSecondary} />
                <Text style={[styles.presetText, { color: palette.textSecondary }]}>
                  Reset
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AmbientCanvas>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 8,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  rightCapsule: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  capsuleIconBtn: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleDivider: {
    width: 1,
    height: 18,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 10,
  },
  monthSwitcher: {
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNavBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthNavText: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  quickOpsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickOpPill: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  quickOpText: {
    fontSize: 12,
  },
  viewToggleFull: {
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  viewToggleFullBtn: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleText: {
    fontSize: 11.5,
  },
  calendarCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 12,
  },
  weekdayRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
  },
  weeksWrap: {
    width: '100%',
    gap: 5,
  },
  weekRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCellSlot: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2.5,
    height: 46,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  dayCell: {
    width: '100%',
    height: 46,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayNum: {
    fontSize: 15,
    lineHeight: 18,
  },
  dotIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 1,
  },
  microStatus: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  microDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  heatmapCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  heatmapTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heatmapTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  heatmapSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  streakBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  streakText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  heatmapBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heatmapDayCol: {
    gap: 4,
    paddingVertical: 1,
  },
  heatmapDayLbl: {
    fontSize: 9,
    height: 16,
    lineHeight: 16,
    textAlign: 'center',
  },
  heatmapGrid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heatmapCol: {
    gap: 4,
  },
  heatmapSquare: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  heatmapLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 3,
  },
  legendTxt: {
    fontSize: 11,
  },
  analyticsCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  analyticsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  pctBig: {
    fontSize: 24,
    fontWeight: '700',
  },
  predictorLine: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  scopeToggle: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
  },
  scopeBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scopeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    width: '48.6%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  simPreviewCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  simPreviewIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simPreviewTextWrap: {
    flex: 1,
    gap: 2,
  },
  simPreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  simPreviewSub: {
    fontSize: 12,
  },
  moreInfoBtn: {
    marginTop: 10,
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  moreInfoBody: {
    marginTop: 12,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  mutedNote: {
    fontSize: 13,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  monthRowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  monthRowPct: {
    fontSize: 15,
    fontWeight: '700',
  },
  noteSearchInput: {
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 8,
  },
  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  noteDate: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  noteBody: {
    fontSize: 13,
  },
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  bulkSheetCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  bulkActionBtn: {
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulkActionText: {
    fontSize: 13.5,
  },
  rangeBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  rangeTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  rangeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rangeInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 15,
  },
  rangeStatusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeStatusPill: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeApplyBtn: {
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simModalCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  simHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  simTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  simSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  simCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simResultBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  simCompareCol: {
    flex: 1,
    gap: 4,
  },
  simCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  simComparePct: {
    fontSize: 14,
  },
  simProjectedPct: {
    fontSize: 22,
    fontWeight: '700',
  },
  deltaPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  simDelta: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  simCounts: {
    fontSize: 12,
  },
  verdictBanner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  verdictText: {
    fontSize: 13,
    lineHeight: 18,
  },
  simControlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  simStepperCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  simStepperLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  simStepperBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  simStepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simStepVal: {
    fontSize: 17,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    width: '48.5%',
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  simDoneText: {
    color: '#050608',
    fontSize: 14,
    fontWeight: '700',
  },
  dateActionBar: {
    padding: 14,
    gap: 10,
  },
  dateActionHeaderCol: {
    flexDirection: 'column',
    gap: 2,
  },
  dateActionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  dateActionHint: {
    fontSize: 11,
    flexShrink: 1,
  },
  dateActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateActionBtn: {
    flexGrow: 1,
    minWidth: '30%',
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dateActionBtnText: {
    fontSize: 12.5,
  },
  analyticsLeftCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  scopeRightCol: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 6,
  },
  weeklyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  weeklyPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noteFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  noteFilterDoneBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
