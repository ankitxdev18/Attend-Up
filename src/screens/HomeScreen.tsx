import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CalendarOff,
  CheckCheck,
  ChevronDown,
  Edit3,
  LayoutGrid,
  MoreVertical,
  Plus,
  SquarePen,
  Target,
  Trash2,
  X,
  XCircle,
} from 'lucide-react-native';
import { BrandLogo } from '../components/BrandLogo';
import type { HomeStackParamList, RootDrawerParamList } from '../navigation/types';
import type { SortMode, Subject } from '../types/attendance';
import { useAttendance } from '../context/AttendanceContext';
import {
  computeAttendanceStats,
  formatDateISO,
  getEffectiveStatus,
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
import { AmbientCanvas, MinimalMenuIcon } from '../components/AmbientCanvas';
import { CircularProgressRing } from '../components/CircularProgressRing';
import { SubjectFormModal } from '../components/SubjectFormModal';

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: 'order', label: 'Custom Order' },
  { mode: 'pct_asc', label: 'Lowest % First' },
  { mode: 'pct_desc', label: 'Highest % First' },
  { mode: 'name', label: 'A–Z' },
];

type SubjectFilterMode = 'all' | 'at_risk' | 'safe';

const FILTER_OPTIONS: { mode: SubjectFilterMode; label: string }[] = [
  { mode: 'all', label: 'All' },
  { mode: 'at_risk', label: 'At Risk < Target' },
  { mode: 'safe', label: 'Safe ≥ Target' },
];

export function HomeScreen() {
  const stackNav = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const drawerNav = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const insets = useSafeAreaInsets();

  const {
    subjects,
    records,
    palette,
    activeAccent,
    isDark,
    overallPercentage,
    sortMode,
    setSortMode,
    bulkMarkDate,
    deleteSubject,
    reorderSubject,
    saveSubject,
    showToast,
  } = useAttendance();

  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<SubjectFilterMode>('all');
  const [sortFilterOpen, setSortFilterOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [actionSubject, setActionSubject] = useState<Subject | null>(null);

  const todayISO = formatDateISO(new Date());

  const hasAnyCounted = useMemo(
    () =>
      records.some(
        (r) => r.status === 'present' || r.status === 'absent' || r.status === 'half_day'
      ),
    [records]
  );

  const ambientTone: AmbientTone = !hasAnyCounted
    ? 'sapphire'
    : overallPercentage < 75
      ? 'alert'
      : 'healthy';

  const subjectCardsData = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mapped = subjects.map((subject) => {
      const subRecords = records.filter((r) => r.subjectId === subject.id);
      const stats = computeAttendanceStats(subRecords, subject.targetPercentage);
      const todayRec = subRecords.find((r) => r.date === todayISO);
      const effectiveToday = getEffectiveStatus(
        todayRec,
        todayISO,
        subject.autoMarkSundays
      );
      return { subject, stats, todayStatus: effectiveToday.status };
    });

    const byQuery = q
      ? mapped.filter((item) => item.subject.name.toLowerCase().includes(q))
      : mapped;

    const filtered = byQuery.filter((item) => {
      if (filterMode === 'all') return true;
      const isAtRisk =
        item.stats.totalCounted > 0 &&
        item.stats.percentage < item.subject.targetPercentage;
      return filterMode === 'at_risk' ? isAtRisk : !isAtRisk;
    });

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return a.subject.name.localeCompare(b.subject.name);
        case 'pct_desc':
          return b.stats.percentage - a.stats.percentage;
        case 'pct_asc':
          return a.stats.percentage - b.stats.percentage;
        default:
          return a.subject.order - b.subject.order;
      }
    });
  }, [subjects, records, query, filterMode, sortMode, todayISO]);

  const handleOpenAdd = () => {
    void Haptics.selectionAsync();
    setEditingSubject(null);
    setFormVisible(true);
  };

  const handleConfirmDelete = (subject: Subject) => {
    setActionSubject(null);
    if (subjects.length <= 1) {
      showToast('Keep at least one subject in AttendUp.', 'error');
      return;
    }
    Alert.alert(
      `Delete "${subject.name}"?`,
      'A safety snapshot will be saved automatically before deleting this subject and its logs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteSubject(subject.id);
          },
        },
      ]
    );
  };

  const handleToggleSundays = async (subject: Subject) => {
    setActionSubject(null);
    await saveSubject({
      id: subject.id,
      name: subject.name,
      targetPercentage: subject.targetPercentage,
      color: subject.color,
      autoMarkSundays: !subject.autoMarkSundays,
      scheduleDays: subject.scheduleDays,
    });
    showToast(
      `Sunday auto-holiday ${!subject.autoMarkSundays ? 'enabled' : 'disabled'}`,
      'info'
    );
  };

  const actionSubjectIndex = actionSubject
    ? subjects.findIndex((s) => s.id === actionSubject.id)
    : -1;

  const primarySubject = subjects[0];

  const heroHeadline = hasAnyCounted
    ? `${overallPercentage.toFixed(1)}% overall`
    : 'Overall Attendance';

  const heroSubline = hasAnyCounted
    ? overallPercentage >= 75
      ? 'You are on track across your subjects'
      : 'Below 75% target — catch up today'
    : `${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'} ready to log`;

  const rowIconColor = palette.isDark
    ? BRAND_COLORS.iconMonochrome
    : palette.textPrimary;

  return (
    <AmbientCanvas tone={ambientTone}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex1}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex1}
        >
          {/* Minimalist Signature Top Bar */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable
                onPress={() => drawerNav.openDrawer()}
                style={[
                  styles.circleGlassBtn,
                  {
                    backgroundColor: palette.glass,
                    borderColor: palette.glassBorder,
                  },
                ]}
                accessibilityLabel="Open navigation menu"
              >
                <MinimalMenuIcon color={palette.textPrimary} />
              </Pressable>

              <Pressable
                onPress={() => setSortFilterOpen(true)}
                style={styles.brandTrigger}
                accessibilityLabel="Sort and filter subjects"
              >
                <Text
                  style={[
                    styles.brandTitle,
                    HEADING_STYLE,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                  ]}
                >
                  Attend
                  <Text style={{ color: palette.textSecondary }}>Up</Text>
                </Text>
                <ChevronDown size={16} color={palette.textSecondary} />
              </Pressable>
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
                onPress={() => {
                  void Haptics.selectionAsync();
                  drawerNav.navigate('QuickAttendance');
                }}
                style={styles.capsuleIconBtn}
                accessibilityLabel="Quick Attendance"
              >
                <SquarePen size={18} color={palette.textPrimary} strokeWidth={1.75} />
              </Pressable>
              <View
                style={[styles.capsuleDivider, { backgroundColor: palette.glassBorder }]}
              />
              <Pressable
                onPress={() => setOverflowOpen(true)}
                style={styles.capsuleIconBtn}
                accessibilityLabel="More options"
              >
                <MoreVertical size={18} color={palette.textPrimary} />
              </Pressable>
            </View>
          </View>

          {/* Main Scrollable Content */}
          <FlatList
            data={subjectCardsData}
            keyExtractor={(item) => item.subject.id}
            style={styles.flatList}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 102 },
            ]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              query.trim() ? undefined : (
                <View style={styles.heroWrap}>
                  <View style={styles.heroHeadingBlock}>
                    <BrandLogo size={36} />
                    <Text
                      style={[
                        styles.heroTitle,
                        HEADING_STYLE,
                        TABULAR_NUMS,
                        {
                          color: palette.textPrimary,
                          fontFamily: FONT_FAMILIES.sansBold,
                        },
                      ]}
                    >
                      {heroHeadline}
                    </Text>
                    <Text
                      style={[
                        styles.heroSub,
                        {
                          color: palette.textSecondary,
                          fontFamily: FONT_FAMILIES.sansMedium,
                        },
                      ]}
                    >
                      {heroSubline}
                    </Text>
                  </View>

                  {/* 3 Clean Quick-Action Rows with Monochrome Circular Badges */}
                  <View
                    style={[
                      styles.quickRowsCard,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        void Haptics.selectionAsync();
                        drawerNav.navigate('QuickAttendance');
                      }}
                      style={[
                        styles.quickActionRow,
                        { borderBottomColor: palette.border, borderBottomWidth: 1 },
                      ]}
                    >
                      <View
                        style={[
                          styles.quickIconCircle,
                          {
                            backgroundColor: palette.isDark
                              ? BRAND_COLORS.iconBadgeBg
                              : palette.control,
                          },
                        ]}
                      >
                        <CalendarDays
                          size={15}
                          color={rowIconColor}
                          strokeWidth={1.5}
                        />
                      </View>
                      <Text
                        style={[
                          styles.quickActionText,
                          {
                            color: palette.textPrimary,
                            fontFamily: FONT_FAMILIES.sansMedium,
                          },
                        ]}
                      >
                        Mark today’s classes
                      </Text>
                      <ArrowRight size={15} color={palette.textMuted} strokeWidth={1.5} />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        void Haptics.selectionAsync();
                        drawerNav.navigate('Settings');
                      }}
                      style={[
                        styles.quickActionRow,
                        { borderBottomColor: palette.border, borderBottomWidth: 1 },
                      ]}
                    >
                      <View
                        style={[
                          styles.quickIconCircle,
                          {
                            backgroundColor: palette.isDark
                              ? BRAND_COLORS.iconBadgeBg
                              : palette.control,
                          },
                        ]}
                      >
                        <LayoutGrid
                          size={15}
                          color={rowIconColor}
                          strokeWidth={1.5}
                        />
                      </View>
                      <Text
                        style={[
                          styles.quickActionText,
                          {
                            color: palette.textPrimary,
                            fontFamily: FONT_FAMILIES.sansMedium,
                          },
                        ]}
                      >
                        View 12-week heatmap
                      </Text>
                      <ArrowRight size={15} color={palette.textMuted} strokeWidth={1.5} />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (!primarySubject) return;
                        void Haptics.selectionAsync();
                        stackNav.navigate('SubjectDetail', {
                          subjectId: primarySubject.id,
                        });
                      }}
                      style={styles.quickActionRow}
                    >
                      <View
                        style={[
                          styles.quickIconCircle,
                          {
                            backgroundColor: palette.isDark
                              ? BRAND_COLORS.iconBadgeBg
                              : palette.control,
                          },
                        ]}
                      >
                        <Target size={15} color={rowIconColor} strokeWidth={1.5} />
                      </View>
                      <Text
                        style={[
                          styles.quickActionText,
                          {
                            color: palette.textPrimary,
                            fontFamily: FONT_FAMILIES.sansMedium,
                          },
                        ]}
                      >
                        Check bunk predictor
                      </Text>
                      <ArrowRight size={15} color={palette.textMuted} strokeWidth={1.5} />
                    </Pressable>
                  </View>

                  <View style={styles.sectionHeaderRow}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        {
                          color: palette.textSecondary,
                          fontFamily: FONT_FAMILIES.sansSemiBold,
                        },
                      ]}
                    >
                      Subjects ({subjectCardsData.length})
                    </Text>
                    {filterMode !== 'all' ? (
                      <Pressable
                        onPress={() => setFilterMode('all')}
                        style={[
                          styles.activeFilterPill,
                          { backgroundColor: BRAND_COLORS.emeraldPresentBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.activeFilterText,
                            {
                              color: BRAND_COLORS.emeraldText,
                              fontFamily: FONT_FAMILIES.sansSemiBold,
                            },
                          ]}
                        >
                          {filterMode === 'at_risk' ? 'At Risk' : 'Safe'} · Clear
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )
            }
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
                  No matching subjects
                </Text>
                <Text
                  style={[
                    styles.emptySub,
                    {
                      color: palette.textSecondary,
                      fontFamily: FONT_FAMILIES.sansRegular,
                    },
                  ]}
                >
                  Clear your search or tap + in the dock below to add a subject.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const { subject, stats, todayStatus } = item;
              const todayMeta = todayStatus ? STATUS_META[todayStatus] : null;
              const isOnTrack =
                stats.totalCounted === 0 ||
                stats.percentage >= subject.targetPercentage;
              const predictorColor =
                stats.totalCounted === 0
                  ? palette.textMuted
                  : isOnTrack
                    ? BRAND_COLORS.emeraldText
                    : SEMANTIC_COLORS.absent;

              return (
                <Pressable
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    stackNav.navigate('SubjectDetail', { subjectId: subject.id });
                  }}
                  style={styles.cardPressableWrap}
                >
                  <View
                    style={[
                      styles.subjectCard,
                      {
                        backgroundColor: isDark ? '#101215' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                      },
                    ]}
                  >
                    {/* Left Info Column */}
                    <View style={styles.cardLeft}>
                      <View style={styles.cardTitleRow}>
                        <View
                          style={[styles.colorDot, { backgroundColor: subject.color }]}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.subjectName,
                            HEADING_STYLE,
                            {
                              color: palette.textPrimary,
                              fontFamily: FONT_FAMILIES.sansBold,
                            },
                          ]}
                        >
                          {subject.name}
                        </Text>
                        <View
                          style={[
                            styles.todayCapsule,
                            {
                              backgroundColor: todayMeta
                                ? todayMeta.tintBg
                                : palette.control,
                            },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.todayCapsuleText,
                              {
                                color: todayMeta ? todayMeta.color : palette.textMuted,
                                fontFamily: FONT_FAMILIES.sansSemiBold,
                              },
                            ]}
                          >
                            {todayMeta ? `Today: ${todayMeta.label}` : 'Today: Unmarked'}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.countsText,
                          TABULAR_NUMS,
                          {
                            color: palette.textSecondary,
                            fontFamily: FONT_FAMILIES.monoMedium,
                          },
                        ]}
                      >
                        {stats.countsSummary}
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.predictorText,
                          {
                            color: predictorColor,
                            fontFamily: FONT_FAMILIES.sansSemiBold,
                          },
                        ]}
                      >
                        {stats.predictorLine}
                      </Text>
                    </View>

                    {/* Right Action Column (Fixed side-by-side 52x52 ring + 36x36 menu) */}
                    <View style={styles.cardRight}>
                      <CircularProgressRing
                        percentage={stats.percentage}
                        targetPercentage={subject.targetPercentage}
                        hasData={stats.totalCounted > 0}
                        size={52}
                        strokeWidth={5}
                        trackColor={palette.control}
                        textColor={palette.textPrimary}
                      />
                      <Pressable
                        onPress={() => setActionSubject(subject)}
                        hitSlop={10}
                        style={[
                          styles.cardMenuBtn,
                          { backgroundColor: palette.control },
                        ]}
                        accessibilityLabel={`Options for ${subject.name}`}
                      >
                        <MoreVertical size={15} color={palette.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />

          {/* Floating Bottom Pill Dock (Thumb Zone) */}
          <View
            pointerEvents="box-none"
            style={[
              styles.dockWrap,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
          >
            <View
              style={[
                styles.floatingDock,
                {
                  backgroundColor: palette.dock,
                  borderColor: palette.glassBorder,
                },
              ]}
            >
              <Pressable
                onPress={handleOpenAdd}
                style={[styles.dockPlusBtn, { backgroundColor: palette.control }]}
                accessibilityLabel="Add subject"
              >
                <Plus size={19} color={palette.textPrimary} />
              </Pressable>

              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search or quick mark..."
                placeholderTextColor={palette.textMuted}
                style={[
                  styles.dockInput,
                  {
                    color: palette.textPrimary,
                    fontFamily: FONT_FAMILIES.sansMedium,
                  },
                ]}
              />

              {query ? (
                <Pressable
                  onPress={() => setQuery('')}
                  hitSlop={8}
                  style={{ paddingHorizontal: 4 }}
                >
                  <X size={16} color={palette.textMuted} />
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  drawerNav.navigate('QuickAttendance');
                }}
                style={[
                  styles.dockActionBtn,
                  { backgroundColor: activeAccent.primary },
                ]}
                accessibilityLabel="Open Quick Attendance"
              >
                <CheckCheck size={18} color="#050608" strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Sort & Filter Sheet Modal (AttendUp ⌄) */}
      <Modal
        visible={sortFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortFilterOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSortFilterOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            style={[
              styles.sheetCard,
              { backgroundColor: palette.sheet, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.sheetTitle,
                HEADING_STYLE,
                { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
              ]}
            >
              Sort & filter subjects
            </Text>

            <Text
              style={[
                styles.sortHeader,
                { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
              ]}
            >
              Sort by
            </Text>
            <View style={styles.sortGrid}>
              {SORT_OPTIONS.map((opt) => {
                const active = sortMode === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    onPress={() => {
                      setSortMode(opt.mode);
                      setSortFilterOpen(false);
                    }}
                    style={[
                      styles.sortPill,
                      {
                        backgroundColor: active
                          ? activeAccent.tintBg
                          : palette.control,
                        borderColor: active
                          ? activeAccent.primary
                          : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active
                          ? activeAccent.bright
                          : palette.textPrimary,
                        fontSize: 13,
                        fontFamily: FONT_FAMILIES.sansSemiBold,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[
                styles.sortHeader,
                { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
              ]}
            >
              Filter by status
            </Text>
            <View style={styles.sortGrid}>
              {FILTER_OPTIONS.map((opt) => {
                const active = filterMode === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    onPress={() => {
                      setFilterMode(opt.mode);
                      setSortFilterOpen(false);
                    }}
                    style={[
                      styles.sortPill,
                      {
                        backgroundColor: active
                          ? activeAccent.tintBg
                          : palette.control,
                        borderColor: active
                          ? activeAccent.primary
                          : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active
                          ? activeAccent.bright
                          : palette.textPrimary,
                        fontSize: 13,
                        fontFamily: FONT_FAMILIES.sansSemiBold,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Overflow Menu Modal */}
      <Modal
        visible={overflowOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOverflowOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setOverflowOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            style={[
              styles.sheetCard,
              { backgroundColor: palette.sheet, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.sheetTitle,
                HEADING_STYLE,
                { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
              ]}
            >
              Quick actions
            </Text>

            <Pressable
              onPress={async () => {
                setOverflowOpen(false);
                await bulkMarkDate(todayISO, 'present', 'Set All Present Today');
              }}
              style={[
                styles.sheetRow,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <CheckCheck size={18} color={BRAND_COLORS.emeraldText} />
              <Text
                style={[
                  styles.sheetRowText,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                ]}
              >
                Set All Present Today
              </Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                setOverflowOpen(false);
                await bulkMarkDate(todayISO, 'absent', 'Set All Absent Today');
              }}
              style={[
                styles.sheetRow,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <XCircle size={18} color={SEMANTIC_COLORS.absent} />
              <Text
                style={[
                  styles.sheetRowText,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                ]}
              >
                Set All Absent Today
              </Text>
            </Pressable>

            <Text
              style={[
                styles.sortHeader,
                { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
              ]}
            >
              Sort by
            </Text>
            <View style={styles.sortGrid}>
              {SORT_OPTIONS.map((opt) => {
                const active = sortMode === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    onPress={() => {
                      setSortMode(opt.mode);
                      setOverflowOpen(false);
                    }}
                    style={[
                      styles.sortPill,
                      {
                        backgroundColor: active
                          ? palette.capsuleActive
                          : palette.control,
                        borderColor: active
                          ? BRAND_COLORS.emerald
                          : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active
                          ? BRAND_COLORS.emeraldText
                          : palette.textPrimary,
                        fontSize: 13,
                        fontFamily: FONT_FAMILIES.sansSemiBold,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Subject Action Sheet Modal */}
      <Modal
        visible={Boolean(actionSubject)}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSubject(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActionSubject(null)}
        >
          {actionSubject ? (
            <Pressable
              onPress={() => {}}
              style={[
                styles.sheetCard,
                { backgroundColor: palette.sheet, borderColor: palette.border },
              ]}
            >
              <Text
                style={[
                  styles.sheetTitle,
                  HEADING_STYLE,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                {actionSubject.name}
              </Text>

              <Pressable
                onPress={() => {
                  const target = actionSubject;
                  setActionSubject(null);
                  setEditingSubject(target);
                  setFormVisible(true);
                }}
                style={[
                  styles.sheetRow,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <Edit3 size={18} color={palette.textPrimary} />
                <Text
                  style={[
                    styles.sheetRowText,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  Edit Name, Schedule, Target % & Color
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleToggleSundays(actionSubject)}
                style={[
                  styles.sheetRow,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <CalendarOff size={18} color={palette.textPrimary} />
                <Text
                  style={[
                    styles.sheetRowText,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  Sunday Auto-Holiday:{' '}
                  {actionSubject.autoMarkSundays ? 'On' : 'Off'}
                </Text>
              </Pressable>

              <View style={styles.reorderRow}>
                <Pressable
                  disabled={actionSubjectIndex <= 0}
                  onPress={async () => {
                    const id = actionSubject.id;
                    setActionSubject(null);
                    await reorderSubject(id, 'up');
                  }}
                  style={[
                    styles.reorderBtn,
                    {
                      backgroundColor: palette.control,
                      borderColor: palette.border,
                      opacity: actionSubjectIndex <= 0 ? 0.4 : 1,
                    },
                  ]}
                >
                  <ArrowUp size={16} color={palette.textPrimary} />
                  <Text
                    style={[
                      styles.sheetRowText,
                      { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                    ]}
                  >
                    Move Up
                  </Text>
                </Pressable>

                <Pressable
                  disabled={actionSubjectIndex >= subjects.length - 1}
                  onPress={async () => {
                    const id = actionSubject.id;
                    setActionSubject(null);
                    await reorderSubject(id, 'down');
                  }}
                  style={[
                    styles.reorderBtn,
                    {
                      backgroundColor: palette.control,
                      borderColor: palette.border,
                      opacity: actionSubjectIndex >= subjects.length - 1 ? 0.4 : 1,
                    },
                  ]}
                >
                  <ArrowDown size={16} color={palette.textPrimary} />
                  <Text
                    style={[
                      styles.sheetRowText,
                      { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                    ]}
                  >
                    Move Down
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => handleConfirmDelete(actionSubject)}
                style={[
                  styles.sheetRow,
                  {
                    backgroundColor: 'rgba(251, 113, 133, 0.14)',
                    borderColor: 'rgba(251, 113, 133, 0.35)',
                  },
                ]}
              >
                <Trash2 size={18} color={SEMANTIC_COLORS.absent} />
                <Text
                  style={[
                    styles.sheetRowText,
                    { color: SEMANTIC_COLORS.absent, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  Delete subject
                </Text>
              </Pressable>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      <SubjectFormModal
        visible={formVisible}
        editingSubject={editingSubject}
        onClose={() => setFormVisible(false)}
      />
    </AmbientCanvas>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flatList: {
    flex: 1,
    width: '100%',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleGlassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  brandTitle: {
    fontSize: 20,
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
  heroWrap: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  heroHeadingBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sparkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  quickRowsCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  quickActionRow: {
    height: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    flex: 1,
    fontSize: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  listContent: {
    width: '100%',
    alignItems: 'stretch',
    paddingHorizontal: 16,
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  cardPressableWrap: {
    width: '100%',
    marginBottom: 12,
  },
  subjectCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
    flexDirection: 'column',
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  todayCapsule: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
  },
  todayCapsuleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  countsText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  predictorText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  cardMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dockWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
  floatingDock: {
    height: 58,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dockPlusBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  dockActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheetCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  sheetRow: {
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  sheetRowText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reorderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reorderBtn: {
    flex: 1,
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sortHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  sortGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
