import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  Clock,
  Download,
  History,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react-native';
import type { RootDrawerParamList } from '../navigation/types';
import { useAttendance } from '../context/AttendanceContext';
import {
  exportJsonBackup,
  importJsonBackupFromPicker,
} from '../lib/reports';
import { ValidationError } from '../lib/validation';
import { refreshAllWidgets } from '../widgets/syncWidgets';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  HEADING_STYLE,
  SEMANTIC_COLORS,
  TABULAR_NUMS,
  UI_METRICS,
} from '../theme/tokens';
import { AmbientCanvas, MinimalMenuIcon } from '../components/AmbientCanvas';

function formatLastBackupLabel(ts: number): string {
  if (!ts || !Number.isFinite(ts)) {
    return 'Never backed up';
  }
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BackupRestoreScreen() {
  const drawerNav = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const {
    subjects,
    records,
    settings,
    snapshots,
    palette,
    activeAccent,
    refreshAll,
    restoreSnapshot,
    saveSettingsPatch,
    showToast,
  } = useAttendance();

  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const handleExport = async () => {
    if (busy) return;
    setBusy('export');
    try {
      const exportedAt = Date.now();
      await exportJsonBackup({
        subjects,
        records,
        settings: { ...settings, lastBackupAt: exportedAt },
      });
      await saveSettingsPatch({ lastBackupAt: exportedAt });
      showToast('JSON backup exported', 'success');
    } catch {
      showToast('Failed to export JSON backup', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    if (busy) return;
    setBusy('import');
    try {
      const res = await importJsonBackupFromPicker();
      if (!res.canceled) {
        await refreshAll();
        await refreshAllWidgets();
        showToast(
          `Restored ${res.subjectsCount} subjects & ${res.recordsCount} logs`,
          'success'
        );
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        showToast(err.message, 'error');
      } else {
        showToast('Could not import backup file', 'error');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmRestoreSnapshot = (snapshotId: string, reason: string) => {
    Alert.alert(
      'Restore safety snapshot?',
      `Replace current data with snapshot "${reason}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => {
            void restoreSnapshot(snapshotId);
          },
        },
      ]
    );
  };

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
        <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
          Backup & Restore
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* JSON Backup & Import Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconBadge}>
              <ShieldCheck size={16} color={BRAND_COLORS.emerald} />
            </View>
            <Text
              style={[
                styles.cardTitle,
                HEADING_STYLE,
                { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
              ]}
            >
              Backup & restore
            </Text>
          </View>
          <Text
            style={[
              styles.cardDesc,
              { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansRegular },
            ]}
          >
            Export a local backup file or restore from a previously saved AttendUp backup.
          </Text>

          <View
            style={[
              styles.lastBackupBar,
              { backgroundColor: palette.control, borderColor: palette.border },
            ]}
          >
            <View style={styles.lastBackupLeft}>
              <View style={styles.smallIconBadge}>
                <Clock
                  size={13}
                  color={settings.lastBackupAt > 0 ? BRAND_COLORS.emerald : '#94A3B8'}
                />
              </View>
              <Text
                style={[
                  styles.lastBackupLabel,
                  { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
                ]}
              >
                Last backup
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.lastBackupValue,
                TABULAR_NUMS,
                {
                  color:
                    settings.lastBackupAt > 0 ? palette.textPrimary : palette.textMuted,
                  fontFamily: FONT_FAMILIES.monoMedium,
                },
              ]}
            >
              {formatLastBackupLabel(settings.lastBackupAt)}
            </Text>
          </View>

          <View style={styles.btnCol}>
            <Pressable
              onPress={handleExport}
              disabled={busy !== null}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: activeAccent.primary,
                  opacity: busy === 'export' ? 0.7 : 1,
                },
              ]}
            >
              <Download size={17} color="#050608" />
              <Text
                style={[
                  styles.primaryBtnText,
                  { color: '#050608', fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                {busy === 'export' ? 'Exporting...' : 'Export JSON Backup'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleImport}
              disabled={busy !== null}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: palette.control,
                  borderColor: palette.border,
                  borderWidth: 1,
                  opacity: busy === 'import' ? 0.7 : 1,
                },
              ]}
            >
              <Upload size={17} color={palette.textPrimary} />
              <Text style={[styles.secondaryBtnText, { color: palette.textPrimary }]}>
                {busy === 'import' ? 'Validating & Restoring...' : 'Import JSON Backup'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Automatic Safety Snapshots */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconBadge}>
              <History size={16} color="#94A3B8" />
            </View>
            <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
              Safety snapshots ({snapshots.length}/15)
            </Text>
          </View>

          {snapshots.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>
              Automatic snapshots are created before bulk marks, subject deletions,
              and backup restores.
            </Text>
          ) : (
            <View style={styles.snapList}>
              {snapshots.map((snap) => {
                const stamp = new Date(snap.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <View
                    key={snap.id}
                    style={[
                      styles.snapRow,
                      {
                        backgroundColor: palette.control,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <View style={styles.snapInfo}>
                      <Text
                        numberOfLines={1}
                        style={[styles.snapReason, { color: palette.textPrimary }]}
                      >
                        {snap.reason}
                      </Text>
                      <Text
                        style={[
                          styles.snapMeta,
                          TABULAR_NUMS,
                          { color: palette.textMuted },
                        ]}
                      >
                        {stamp} · {snap.subjects.length} subjects ·{' '}
                        {snap.records.length} logs
                      </Text>
                    </View>

                    <Pressable
                      onPress={() =>
                        handleConfirmRestoreSnapshot(snap.id, snap.reason)
                      }
                      style={[
                        styles.restoreBtn,
                        {
                          backgroundColor: palette.card,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <RotateCcw size={14} color={SEMANTIC_COLORS.present} />
                      <Text
                        style={[
                          styles.restoreText,
                          { color: SEMANTIC_COLORS.present },
                        ]}
                      >
                        Restore
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.iconBadgeBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.iconBadgeBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastBackupBar: {
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  lastBackupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastBackupLabel: {
    fontSize: 12.5,
  },
  lastBackupValue: {
    fontSize: 12,
    flexShrink: 1,
    textAlign: 'right',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  btnCol: {
    gap: 10,
  },
  actionBtn: {
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
  },
  snapList: {
    gap: 8,
    marginTop: 4,
  },
  snapRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  snapInfo: {
    flex: 1,
    minWidth: 0,
  },
  snapReason: {
    fontSize: 13,
    fontWeight: '700',
  },
  snapMeta: {
    fontSize: 11,
    marginTop: 3,
  },
  restoreBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  restoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
