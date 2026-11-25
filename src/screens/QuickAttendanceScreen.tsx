import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckCheck } from 'lucide-react-native';
import type { RootDrawerParamList } from '../navigation/types';
import type { AttendanceStatus } from '../types/attendance';
import { useAttendance } from '../context/AttendanceContext';
import {
  formatDateISO,
  formatDisplayDate,
  getEffectiveStatus,
  parseDateISO,
  STATUS_META,
} from '../utils/attendance';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  HEADING_STYLE,
  TABULAR_NUMS,
} from '../theme/tokens';
import { AmbientBackground } from '../components/AmbientBackground';

const QUICK_PILLS: {
  status: Exclude<AttendanceStatus, null>;
  short: string;
}[] = [
  { status: 'present', short: 'P' },
  { status: 'absent', short: 'A' },
  { status: 'half_day', short: 'HD' },
  { status: 'holiday', short: 'H' },
];

const DATE_PILL_WIDTH = 60;
const DATE_PILL_GAP = 8;

export function QuickAttendanceScreen() {
  const drawerNav = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const { subjects, records, palette, activeAccent, markDayStatus, bulkMarkDate, showToast } =
    useAttendance();

  const todayISO = formatDateISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const dateListRef =
    useRef<FlatList<{ dateISO: string; day: string; num: number; isFuture: boolean }>>(null);

  const dateStrip = useMemo(() => {
    const base = new Date();
    const list: { dateISO: string; day: string; num: number; isFuture: boolean }[] = [];
    for (let offset = -45; offset <= 7; offset += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() + offset);
      const iso = formatDateISO(d);
      list.push({
        dateISO: iso,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        num: d.getDate(),
        isFuture: iso > todayISO,
      });
    }
    return list;
  }, [todayISO]);

  const scrollDateToCenter = useCallback(
    (index: number, animated = true) => {
      if (index < 0 || index >= dateStrip.length) return;
      dateListRef.current?.scrollToIndex({
        index,
        animated,
        viewPosition: 0.5,
      });
    },
    [dateStrip.length]
  );

  useEffect(() => {
    const idx = dateStrip.findIndex((d) => d.dateISO === selectedDate);
    if (idx >= 0) {
      const timer = setTimeout(() => scrollDateToCenter(idx, true), 80);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [selectedDate, dateStrip, scrollDateToCenter]);

  const recordMap = useMemo(() => {
    const map = new Map<string, (typeof records)[number]>();
    for (const r of records) {
      if (r.date === selectedDate) {
        map.set(r.subjectId, r);
      }
    }
    return map;
  }, [records, selectedDate]);

  const selectedWeekday = parseDateISO(selectedDate).getDay();
  const isFutureSelected = selectedDate > todayISO;

  const selectedLabel =
    selectedDate === todayISO
      ? `Today · ${formatDisplayDate(selectedDate)}`
      : isFutureSelected
        ? `Future date · ${formatDisplayDate(selectedDate)}`
        : formatDisplayDate(selectedDate);

  return (
    <AmbientBackground tone="healthy">
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.container}
      >
        {/* Sticky Top Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: palette.border },
          ]}
        >
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => drawerNav.navigate('HomeStack', { screen: 'HomeDashboard' })}
              style={[
                styles.iconBtn,
                { backgroundColor: palette.glass, borderColor: palette.glassBorder },
              ]}
            >
              <ArrowLeft size={20} color={palette.textPrimary} />
            </Pressable>
            <View>
              <Text
                style={[
                  styles.title,
                  HEADING_STYLE,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                Quick Attendance
              </Text>
              <Text
                style={[
                  styles.subDate,
                  { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
                ]}
              >
                {selectedLabel}
              </Text>
            </View>
          </View>

          <Pressable
            disabled={isFutureSelected}
            onPress={async () => {
              if (isFutureSelected) return;
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await bulkMarkDate(
                selectedDate,
                'present',
                `Quick Attendance All Present (${selectedDate})`
              );
            }}
            style={[
              styles.allPresentBtn,
              {
                backgroundColor: activeAccent.tintBg,
                borderColor: activeAccent.primary,
                opacity: isFutureSelected ? 0.4 : 1,
              },
            ]}
          >
            <CheckCheck size={15} color={activeAccent.bright} />
            <Text
              style={[
                styles.allPresentText,
                { color: activeAccent.bright, fontFamily: FONT_FAMILIES.sansBold },
              ]}
            >
              All P
            </Text>
          </Pressable>
        </View>

        {/* Auto-Centering Horizontal Date Strip */}
        <View style={styles.stripWrap}>
          <FlatList
            ref={dateListRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={dateStrip}
            keyExtractor={(item) => item.dateISO}
            contentContainerStyle={styles.stripContent}
            getItemLayout={(_, index) => ({
              length: DATE_PILL_WIDTH + DATE_PILL_GAP,
              offset: (DATE_PILL_WIDTH + DATE_PILL_GAP) * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => scrollDateToCenter(index, false), 100);
            }}
            renderItem={({ item, index }) => {
              const active = item.dateISO === selectedDate;
              const isToday = item.dateISO === todayISO;
              return (
                <Pressable
                  onPress={async () => {
                    if (item.isFuture) {
                      showToast('Future date — upcoming days cannot be marked yet.', 'info');
                      return;
                    }
                    await Haptics.selectionAsync();
                    setSelectedDate(item.dateISO);
                    scrollDateToCenter(index, true);
                  }}
                  style={[
                    styles.datePill,
                    {
                      backgroundColor: active
                        ? activeAccent.primary
                        : palette.card,
                      borderColor: active
                        ? activeAccent.primary
                        : isToday
                          ? activeAccent.bright
                          : palette.border,
                      opacity: item.isFuture ? 0.38 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.datePillDay,
                      {
                        color: active ? '#050608' : palette.textMuted,
                        fontFamily: FONT_FAMILIES.sansSemiBold,
                      },
                    ]}
                  >
                    {item.isFuture ? 'Future' : item.day}
                  </Text>
                  <Text
                    style={[
                      styles.datePillNum,
                      TABULAR_NUMS,
                      {
                        color: active ? '#050608' : palette.textPrimary,
                        fontFamily: FONT_FAMILIES.monoBold,
                      },
                    ]}
                  >
                    {item.num}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        {isFutureSelected ? (
          <View
            style={[
              styles.futureNotice,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.futureNoticeText,
                { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
              ]}
            >
              Future date selected — attendance marking is disabled for upcoming dates.
            </Text>
          </View>
        ) : null}

        {/* Stacked Subject Rows */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {subjects.map((sub) => {
            const rec = recordMap.get(sub.id);
            const { status, isAutoSunday } = getEffectiveStatus(
              rec,
              selectedDate,
              sub.autoMarkSundays
            );
            const activeColor = status ? STATUS_META[status].color : palette.textMuted;
            const isScheduled = sub.scheduleDays.includes(selectedWeekday);

            return (
              <View
                key={sub.id}
                style={[
                  styles.subjectRow,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    opacity: isFutureSelected ? 0.45 : 1,
                  },
                ]}
              >
                <View style={styles.subjectInfo}>
                  <View style={styles.subjectTitleRow}>
                    <View style={[styles.dot, { backgroundColor: sub.color }]} />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.subjectName,
                        { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                      ]}
                    >
                      {sub.name}
                    </Text>
                  </View>

                  <View style={styles.metaLine}>
                    <Text
                      style={[
                        styles.statusHint,
                        { color: activeColor, fontFamily: FONT_FAMILIES.sansMedium },
                      ]}
                    >
                      {status
                        ? isAutoSunday
                          ? 'Holiday (Auto Sunday)'
                          : STATUS_META[status].label
                        : `Unmarked · ${parseDateISO(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </Text>
                    {isScheduled ? (
                      <View
                        style={[
                          styles.scheduledBadge,
                          { backgroundColor: BRAND_COLORS.emeraldPresentBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.scheduledText,
                            {
                              color: BRAND_COLORS.emeraldText,
                              fontFamily: FONT_FAMILIES.sansSemiBold,
                            },
                          ]}
                        >
                          {selectedDate === todayISO ? 'Scheduled Today' : 'Scheduled'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.pillsRow}>
                  {QUICK_PILLS.map((pill) => {
                    const meta = STATUS_META[pill.status];
                    const active = status === pill.status && !isAutoSunday;
                    return (
                      <Pressable
                        key={pill.status}
                        disabled={isFutureSelected}
                        onPress={async () => {
                          if (isFutureSelected) return;
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const next = active ? null : pill.status;
                          await markDayStatus(sub.id, selectedDate, next);
                        }}
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: active ? meta.color : palette.control,
                            borderColor: active ? meta.color : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            {
                              color: active ? '#050608' : palette.textPrimary,
                              fontFamily: FONT_FAMILIES.sansBold,
                            },
                          ]}
                        >
                          {pill.short}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subDate: {
    fontSize: 12,
    marginTop: 1,
  },
  allPresentBtn: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allPresentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stripWrap: {
    paddingVertical: 12,
  },
  stripContent: {
    paddingLeft: 16,
    paddingRight: 24,
    gap: DATE_PILL_GAP,
  },
  datePill: {
    width: DATE_PILL_WIDTH,
    height: 62,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePillDay: {
    fontSize: 10,
    fontWeight: '600',
  },
  datePillNum: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  futureNotice: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  futureNoticeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 10,
  },
  subjectRow: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  statusHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  scheduledBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  scheduledText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    width: 38,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
