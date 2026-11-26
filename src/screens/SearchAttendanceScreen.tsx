import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Search, StickyNote, X } from 'lucide-react-native';
import type { RootDrawerParamList } from '../navigation/types';
import type { AttendanceRecord } from '../types/attendance';
import { useAttendance } from '../context/AttendanceContext';
import {
  formatDisplayDate,
  formatMonthLabel,
  STATUS_META,
} from '../utils/attendance';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  HEADING_STYLE,
  SEMANTIC_COLORS,
  TABULAR_NUMS,
} from '../theme/tokens';
import { AmbientCanvas, MinimalMenuIcon } from '../components/AmbientCanvas';

type FilterChipKey =
  | 'all'
  | 'present'
  | 'absent'
  | 'half_day'
  | 'holiday'
  | 'leave'
  | 'has_note';

const FILTER_CHIPS: { key: FilterChipKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'half_day', label: 'Half Day' },
  { key: 'holiday', label: 'Holiday' },
  { key: 'leave', label: 'Leave' },
  { key: 'has_note', label: 'Has Note' },
];

export function SearchAttendanceScreen() {
  const drawerNav = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const route = useRoute<RouteProp<RootDrawerParamList, 'SearchAttendance'>>();
  const { subjects, records, palette, openRecordEditor } = useAttendance();

  const [filterChip, setFilterChip] = useState<FilterChipKey>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    route.params?.initialSubjectId ?? 'all'
  );
  const [lastInitialParam, setLastInitialParam] = useState<string | undefined>(
    route.params?.initialSubjectId
  );
  const [keyword, setKeyword] = useState('');

  const nextInitialParam = route.params?.initialSubjectId;
  if (nextInitialParam && nextInitialParam !== lastInitialParam) {
    setLastInitialParam(nextInitialParam);
    setSelectedSubjectId(nextInitialParam);
  }

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const sections = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const filtered = records
      .filter((r) =>
        selectedSubjectId === 'all' ? true : r.subjectId === selectedSubjectId
      )
      .filter((r) => {
        if (filterChip === 'all') return true;
        if (filterChip === 'has_note') return r.note.trim().length > 0;
        return r.status === filterChip;
      })
      .filter((r) => {
        if (!q) return true;
        const subName = subjectMap.get(r.subjectId)?.name.toLowerCase() ?? '';
        return (
          r.note.toLowerCase().includes(q) ||
          r.date.includes(q) ||
          r.shift.toLowerCase().includes(q) ||
          subName.includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const grouped = new Map<string, AttendanceRecord[]>();
    for (const r of filtered) {
      const monthKey = r.date.slice(0, 7);
      const arr = grouped.get(monthKey) ?? [];
      arr.push(r);
      grouped.set(monthKey, arr);
    }

    return Array.from(grouped.entries()).map(([monthKey, data]) => ({
      title: formatMonthLabel(monthKey),
      data,
    }));
  }, [records, selectedSubjectId, filterChip, keyword, subjectMap]);

  return (
    <AmbientCanvas tone="sapphire">
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => drawerNav.openDrawer()}
            style={[
              styles.iconBtn,
              { backgroundColor: palette.glass, borderColor: palette.glassBorder },
            ]}
          >
            <MinimalMenuIcon color={palette.textPrimary} />
          </Pressable>
        <Text
          style={[
            styles.headerTitle,
            HEADING_STYLE,
            { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
          ]}
        >
          Search Attendance
        </Text>
      </View>

      {/* Keyword Search Input */}
      <View
        style={[
          styles.searchBar,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Search size={17} color={palette.textMuted} />
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Search notes, dates, shifts..."
          placeholderTextColor={palette.textMuted}
          style={[
            styles.searchInput,
            { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansRegular },
          ]}
        />
        {keyword ? (
          <Pressable onPress={() => setKeyword('')} hitSlop={8}>
            <X size={16} color={palette.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Filter Chip Bar (trailing paddingRight: 24 prevents right-edge clipping) */}
      <View style={styles.chipBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScrollContent}
        >
          {FILTER_CHIPS.map((chip) => {
            const active = filterChip === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setFilterChip(chip.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active
                      ? BRAND_COLORS.emeraldPresentBg
                      : palette.card,
                    borderColor: active
                      ? BRAND_COLORS.emerald
                      : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active
                        ? BRAND_COLORS.emeraldText
                        : palette.textSecondary,
                      fontFamily: FONT_FAMILIES.sansSemiBold,
                    },
                  ]}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Subject Picker Chips */}
      <View style={styles.chipBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectScrollContent}
        >
          <Pressable
            onPress={() => setSelectedSubjectId('all')}
            style={[
              styles.subjectChip,
              {
                backgroundColor:
                  selectedSubjectId === 'all' ? palette.control : palette.card,
                borderColor:
                  selectedSubjectId === 'all'
                    ? BRAND_COLORS.emerald
                    : palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    selectedSubjectId === 'all'
                      ? palette.textPrimary
                      : palette.textSecondary,
                  fontFamily: FONT_FAMILIES.sansSemiBold,
                },
              ]}
            >
              All Subjects
            </Text>
          </Pressable>
          {subjects.map((sub) => {
            const active = selectedSubjectId === sub.id;
            return (
              <Pressable
                key={sub.id}
                onPress={() => setSelectedSubjectId(sub.id)}
                style={[
                  styles.subjectChip,
                  {
                    backgroundColor: active ? palette.control : palette.card,
                    borderColor: active ? sub.color : palette.border,
                  },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: sub.color }]} />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active
                        ? palette.textPrimary
                        : palette.textSecondary,
                      fontFamily: FONT_FAMILIES.sansSemiBold,
                    },
                  ]}
                >
                  {sub.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Grouped Monthly Results */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.subjectId}-${item.date}`}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.emptyTitle,
                HEADING_STYLE,
                { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
              ]}
            >
              No matching records
            </Text>
            <Text
              style={[
                styles.emptySub,
                { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansRegular },
              ]}
            >
              Adjust your filter chips or search query to view saved logs.
            </Text>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text
            style={[
              styles.sectionHeader,
              { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansBold },
            ]}
          >
            {title}
          </Text>
        )}
        renderItem={({ item }) => {
          const sub = subjectMap.get(item.subjectId);
          const meta = item.status ? STATUS_META[item.status] : null;
          return (
            <Pressable
              onPress={() => openRecordEditor(item.subjectId, item.date)}
              style={[
                styles.resultRow,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <View style={styles.rowLeft}>
                <View style={styles.rowTopLine}>
                  <Text
                    style={[
                      styles.rowDate,
                      TABULAR_NUMS,
                      { color: palette.textPrimary, fontFamily: FONT_FAMILIES.monoBold },
                    ]}
                  >
                    {formatDisplayDate(item.date)}
                  </Text>
                  {item.overtimeHours > 0 ? (
                    <Text
                      style={[
                        styles.otTag,
                        TABULAR_NUMS,
                        { color: SEMANTIC_COLORS.halfDay, fontFamily: FONT_FAMILIES.monoBold },
                      ]}
                    >
                      +{item.overtimeHours}h OT
                    </Text>
                  ) : null}
                </View>
                <View style={styles.metaRow}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.rowSub,
                      { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
                    ]}
                  >
                    {sub?.name ?? item.subjectId}
                  </Text>
                  {item.shift ? (
                    <View
                      style={[
                        styles.shiftBadge,
                        { backgroundColor: palette.control, borderColor: palette.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.shiftBadgeText,
                          { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                        ]}
                      >
                        {item.shift}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {item.note ? (
                  <View
                    style={[
                      styles.noteBox,
                      { backgroundColor: palette.control, borderColor: palette.border },
                    ]}
                  >
                    <StickyNote size={12} color={BRAND_COLORS.emerald} />
                    <Text
                      numberOfLines={3}
                      style={[
                        styles.noteText,
                        { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansRegular },
                      ]}
                    >
                      {item.note}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: meta ? meta.tintBg : palette.control,
                    borderColor: meta ? meta.color : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color: meta ? meta.color : palette.textMuted,
                      fontFamily: FONT_FAMILIES.sansBold,
                    },
                  ]}
                >
                  {meta ? meta.label : 'Unmarked'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      </SafeAreaView>
    </AmbientCanvas>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  chipBarWrap: {
    width: '100%',
  },
  chipScrollContent: {
    paddingLeft: 16,
    paddingRight: 24,
    paddingBottom: 8,
    gap: 8,
  },
  subjectScrollContent: {
    paddingLeft: 16,
    paddingRight: 24,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  resultRow: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 15,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLeft: {
    flex: 1,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowDate: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  otTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  rowSub: {
    fontSize: 12.5,
  },
  shiftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  shiftBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
