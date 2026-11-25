import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { FileSpreadsheet, FileText } from 'lucide-react-native';
import type { RootDrawerParamList } from '../navigation/types';
import { useAttendance } from '../context/AttendanceContext';
import {
  computeAttendanceStats,
  formatMonthKey,
  formatMonthLabel,
} from '../utils/attendance';
import {
  exportAttendanceCsv,
  exportAttendancePdf,
  type ReportScope,
} from '../lib/reports';
import {
  FONT_FAMILIES,
  HEADING_STYLE,
  SEMANTIC_COLORS,
  TABULAR_NUMS,
  UI_METRICS,
} from '../theme/tokens';
import { AmbientCanvas, MinimalMenuIcon } from '../components/AmbientCanvas';

export function ReportsScreen() {
  const drawerNav = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const { subjects, records, palette, activeAccent, showToast } = useAttendance();

  const [subjectId, setSubjectId] = useState<string | 'all'>('all');
  const [scope, setScope] = useState<ReportScope>('this_month');
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);

  const activeMonth = formatMonthKey();

  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => (subjectId === 'all' ? true : r.subjectId === subjectId))
      .filter((r) => (scope === 'this_month' ? r.date.startsWith(activeMonth) : true));
  }, [records, subjectId, scope, activeMonth]);

  const targetPct = useMemo(() => {
    if (subjectId === 'all') return 75;
    return subjects.find((s) => s.id === subjectId)?.targetPercentage ?? 75;
  }, [subjectId, subjects]);

  const stats = useMemo(
    () => computeAttendanceStats(filteredRecords, targetPct),
    [filteredRecords, targetPct]
  );

  const handleExportPdf = async () => {
    if (busy) return;
    setBusy('pdf');
    try {
      await exportAttendancePdf({ subjects, records, subjectId, scope });
      showToast('PDF report ready to share', 'success');
    } catch {
      showToast('Failed to generate PDF report', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleExportCsv = async () => {
    if (busy) return;
    setBusy('csv');
    try {
      await exportAttendanceCsv({ subjects, records, subjectId, scope });
      showToast('Spreadsheet (.csv) ready to share', 'success');
    } catch {
      showToast('Failed to generate CSV report', 'error');
    } finally {
      setBusy(null);
    }
  };

  const isOnTrack = stats.totalCounted === 0 || stats.percentage >= targetPct;

  return (
    <AmbientCanvas tone="sapphire">
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.container}
      >
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
          Reports (PDF & Excel)
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Subject Selector */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Subject filter
          </Text>
          <View style={styles.chipsWrap}>
            <Pressable
              onPress={() => setSubjectId('all')}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    subjectId === 'all'
                      ? 'rgba(16, 185, 129, 0.14)'
                      : palette.control,
                  borderColor:
                    subjectId === 'all'
                      ? SEMANTIC_COLORS.present
                      : palette.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color:
                      subjectId === 'all'
                        ? SEMANTIC_COLORS.present
                        : palette.textPrimary,
                  },
                ]}
              >
                All Subjects
              </Text>
            </Pressable>

            {subjects.map((sub) => {
              const active = subjectId === sub.id;
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => setSubjectId(sub.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? 'rgba(16, 185, 129, 0.14)'
                        : palette.control,
                      borderColor: active
                        ? SEMANTIC_COLORS.present
                        : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active
                          ? SEMANTIC_COLORS.present
                          : palette.textPrimary,
                      },
                    ]}
                  >
                    {sub.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            style={[
              styles.cardTitle,
              { color: palette.textPrimary, marginTop: 14 },
            ]}
          >
            Time scope
          </Text>
          <View style={styles.scopeRow}>
            {(
              [
                { key: 'this_month', label: `This Month (${formatMonthLabel(activeMonth, true)})` },
                { key: 'all_months', label: 'All Months' },
              ] as const
            ).map((opt) => {
              const active = scope === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setScope(opt.key)}
                  style={[
                    styles.scopeBtn,
                    {
                      backgroundColor: active
                        ? 'rgba(16, 185, 129, 0.14)'
                        : palette.control,
                      borderColor: active
                        ? SEMANTIC_COLORS.present
                        : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.scopeText,
                      {
                        color: active
                          ? SEMANTIC_COLORS.present
                          : palette.textPrimary,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Summary Preview */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.previewHeader}>
            <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
              Summary preview
            </Text>
            <Text
              style={[
                styles.previewPct,
                TABULAR_NUMS,
                {
                  color: isOnTrack
                    ? SEMANTIC_COLORS.present
                    : SEMANTIC_COLORS.absent,
                },
              ]}
            >
              {stats.percentage.toFixed(2)}%
            </Text>
          </View>

          <View style={styles.statGrid}>
            <View
              style={[
                styles.statItem,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
                Present
              </Text>
              <Text
                style={[
                  styles.statVal,
                  TABULAR_NUMS,
                  { color: SEMANTIC_COLORS.present },
                ]}
              >
                {stats.present}
              </Text>
            </View>
            <View
              style={[
                styles.statItem,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
                Absent
              </Text>
              <Text
                style={[
                  styles.statVal,
                  TABULAR_NUMS,
                  { color: SEMANTIC_COLORS.absent },
                ]}
              >
                {stats.absent}
              </Text>
            </View>
            <View
              style={[
                styles.statItem,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
                Half Days
              </Text>
              <Text
                style={[
                  styles.statVal,
                  TABULAR_NUMS,
                  { color: SEMANTIC_COLORS.halfDay },
                ]}
              >
                {stats.halfDays}
              </Text>
            </View>
            <View
              style={[
                styles.statItem,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
                OT Hours
              </Text>
              <Text
                style={[
                  styles.statVal,
                  TABULAR_NUMS,
                  { color: palette.textPrimary },
                ]}
              >
                {stats.overtimeHours}h
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.logCountNote,
              TABULAR_NUMS,
              { color: palette.textMuted, fontFamily: FONT_FAMILIES.monoMedium },
            ]}
          >
            {filteredRecords.length}{' '}
            {filteredRecords.length === 1 ? 'entry' : 'entries'} included
          </Text>
        </View>

        {/* Export Actions */}
        <View style={styles.actionsCol}>
          <Pressable
            onPress={handleExportPdf}
            disabled={busy !== null}
            style={[
              styles.exportBtn,
              {
                backgroundColor: activeAccent.primary,
                opacity: busy === 'pdf' ? 0.7 : 1,
              },
            ]}
          >
            <FileText size={18} color="#050608" />
            <Text style={[styles.primaryBtnText, { color: '#050608', fontFamily: FONT_FAMILIES.sansBold }]}>
              {busy === 'pdf' ? 'Generating PDF...' : 'Export PDF Report'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleExportCsv}
            disabled={busy !== null}
            style={[
              styles.exportBtn,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                borderWidth: 1,
                opacity: busy === 'csv' ? 0.7 : 1,
              },
            ]}
          >
            <FileSpreadsheet size={18} color={palette.textPrimary} />
            <Text style={[styles.secondaryBtnText, { color: palette.textPrimary }]}>
              {busy === 'csv'
                ? 'Generating Spreadsheet...'
                : 'Export Excel / CSV (.csv)'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scopeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  previewPct: {
    fontSize: 18,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    width: '48.6%',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '700',
  },
  logCountNote: {
    fontSize: 12,
    marginTop: 10,
  },
  actionsCol: {
    gap: 10,
  },
  exportBtn: {
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
