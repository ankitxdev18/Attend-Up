import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { Minus, Plus, Trash2, X } from 'lucide-react-native';
import type { AttendanceRecord, AttendanceStatus, ShiftType, Subject } from '../types/attendance';
import { useAttendance } from '../context/AttendanceContext';
import { formatDateISO, formatDisplayDate, STATUS_META } from '../utils/attendance';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  HEADING_STYLE,
  SEMANTIC_COLORS,
  TABULAR_NUMS,
  UI_METRICS,
} from '../theme/tokens';

const PRIMARY_STATUSES: Exclude<AttendanceStatus, null>[] = [
  'present',
  'absent',
  'half_day',
];
const SECONDARY_STATUSES: Exclude<AttendanceStatus, null>[] = [
  'holiday',
  'weekly_off',
  'leave',
];
const SHIFTS: Exclude<ShiftType, ''>[] = ['Morning', 'Regular', 'Evening', 'Lab'];

interface RecordEditorBodyProps {
  subjectId: string;
  date: string;
  targetSubject: Subject | null;
  existingRecord: AttendanceRecord | undefined;
  preferNote: boolean;
  lockAttendance: boolean;
  onClose: () => void;
}

function RecordEditorBody({
  subjectId,
  date,
  targetSubject,
  existingRecord,
  preferNote,
  lockAttendance,
  onClose,
}: RecordEditorBodyProps) {
  const { palette, activeAccent, saveFullRecord, showToast } = useAttendance();
  const noteInputRef = useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);

  const [status, setStatus] = useState<AttendanceStatus>(existingRecord?.status ?? null);
  const [overtimeHours, setOvertimeHours] = useState(existingRecord?.overtimeHours ?? 0);
  const [shift, setShift] = useState<ShiftType>(existingRecord?.shift ?? '');
  const [note, setNote] = useState(existingRecord?.note ?? '');
  const [saving, setSaving] = useState(false);

  const todayISO = formatDateISO(new Date());
  const isToday = date === todayISO;
  const isFutureDate = date > todayISO;
  const isLockedOtherDay = Boolean(lockAttendance && !isToday);
  const isReadOnly = isFutureDate || isLockedOtherDay;

  useEffect(() => {
    if (preferNote && existingRecord?.note?.trim() && !isReadOnly) {
      const timer = setTimeout(() => {
        (noteInputRef.current as unknown as { focus?: () => void } | null)?.focus?.();
      }, 280);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [preferNote, existingRecord?.note, isReadOnly]);

  const handleSelectStatus = async (next: Exclude<AttendanceStatus, null>) => {
    if (isFutureDate) {
      showToast('Future dates cannot be marked yet.', 'info');
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStatus((prev) => (prev === next ? null : next));
  };

  const adjustOt = async (delta: number) => {
    if (isFutureDate) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOvertimeHours((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.min(24, Math.max(0, next));
    });
  };

  const handleSave = async () => {
    if (saving || isFutureDate) return;
    if (note.length > 300) {
      showToast('Note cannot exceed 300 characters.', 'error');
      return;
    }
    setSaving(true);
    try {
      const ok = await saveFullRecord({
        subjectId,
        date,
        status,
        overtimeHours,
        shift,
        note: note.trim(),
      });
      if (ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClearEntry = async () => {
    if (saving || isFutureDate) return;
    setSaving(true);
    try {
      const ok = await saveFullRecord({
        subjectId,
        date,
        status: null,
        overtimeHours: 0,
        shift: '',
        note: '',
      });
      if (ok) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <View style={styles.dateBadgeRow}>
            <Text
              style={[
                styles.dateTitle,
                HEADING_STYLE,
                TABULAR_NUMS,
                { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
              ]}
            >
              {formatDisplayDate(date)}
            </Text>
            {isToday ? (
              <View
                style={[
                  styles.todayBadge,
                  {
                    backgroundColor: palette.isDark
                      ? BRAND_COLORS.emeraldPresentBg
                      : 'rgba(16, 185, 129, 0.14)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.todayBadgeText,
                    { color: BRAND_COLORS.emeraldText, fontFamily: FONT_FAMILIES.sansBold },
                  ]}
                >
                  Today
                </Text>
              </View>
            ) : null}
            {isFutureDate ? (
              <View style={[styles.futureBadge, { backgroundColor: palette.control }]}>
                <Text
                  style={[
                    styles.futureBadgeText,
                    { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  Future date
                </Text>
              </View>
            ) : null}
          </View>
          {targetSubject ? (
            <Text
              style={[
                styles.subjectSub,
                { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
              ]}
            >
              {targetSubject.name}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={onClose}
          style={[
            styles.closeBtn,
            { backgroundColor: palette.control, borderColor: palette.border },
          ]}
          accessibilityLabel="Close sheet"
        >
          <X size={18} color={palette.textPrimary} />
        </Pressable>
      </View>

      {isFutureDate ? (
        <View
          style={[
            styles.infoBanner,
            { backgroundColor: palette.control, borderColor: palette.border },
          ]}
        >
          <Text
            style={[
              styles.infoBannerText,
              { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
            ]}
          >
            Future date — attendance can only be recorded for today or past dates.
          </Text>
        </View>
      ) : isLockedOtherDay ? (
        <View style={styles.lockBanner}>
          <Text style={[styles.lockBannerText, { fontFamily: FONT_FAMILIES.sansSemiBold }]}>
            Attendance Lock is active. Only today’s records can be saved.
          </Text>
        </View>
      ) : null}

      {/* Primary Status Grid + OT Stepper */}
      <View style={{ opacity: isFutureDate ? 0.45 : 1 }}>
        <Text
          style={[
            styles.sectionLabel,
            { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
          ]}
        >
          Status & overtime
        </Text>
        <View style={styles.primaryGrid}>
          {PRIMARY_STATUSES.map((st) => {
            const meta = STATUS_META[st];
            const active = status === st;
            return (
              <Pressable
                key={st}
                disabled={isFutureDate}
                onPress={() => handleSelectStatus(st)}
                style={[
                  styles.statusBtn,
                  {
                    backgroundColor: active ? meta.tintBg : palette.control,
                    borderColor: active ? meta.color : palette.border,
                  },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: meta.color }]} />
                <Text
                  style={[
                    styles.statusLabel,
                    {
                      color: active ? meta.color : palette.textPrimary,
                      fontFamily: FONT_FAMILIES.sansSemiBold,
                    },
                  ]}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}

          {/* Inline OT Hrs Stepper */}
          <View
            style={[
              styles.otStepperBox,
              { backgroundColor: palette.control, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.otLabel,
                { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
              ]}
            >
              OT Hrs
            </Text>
            <View style={styles.otControls}>
              <Pressable
                disabled={isFutureDate}
                onPress={() => adjustOt(-0.5)}
                style={[styles.otStepBtn, { backgroundColor: palette.card }]}
                accessibilityLabel="Decrease overtime hours"
              >
                <Minus size={14} color={palette.textPrimary} />
              </Pressable>
              <Text
                style={[
                  styles.otValue,
                  TABULAR_NUMS,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.monoBold },
                ]}
              >
                {overtimeHours}
              </Text>
              <Pressable
                disabled={isFutureDate}
                onPress={() => adjustOt(0.5)}
                style={[styles.otStepBtn, { backgroundColor: palette.card }]}
                accessibilityLabel="Increase overtime hours"
              >
                <Plus size={14} color={palette.textPrimary} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Secondary Row */}
        <View style={styles.secondaryRow}>
          {SECONDARY_STATUSES.map((st) => {
            const meta = STATUS_META[st];
            const active = status === st;
            return (
              <Pressable
                key={st}
                disabled={isFutureDate}
                onPress={() => handleSelectStatus(st)}
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: active ? meta.tintBg : palette.control,
                    borderColor: active ? meta.color : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.secondaryLabel,
                    {
                      color: active ? meta.color : palette.textSecondary,
                      fontFamily: FONT_FAMILIES.sansSemiBold,
                    },
                  ]}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Shift Selector */}
        <Text
          style={[
            styles.sectionLabel,
            { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
          ]}
        >
          Shift
        </Text>
        <View style={styles.shiftRow}>
          {SHIFTS.map((item) => {
            const active = shift === item;
            return (
              <Pressable
                key={item}
                disabled={isFutureDate}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShift((prev) => (prev === item ? '' : item));
                }}
                style={[
                  styles.shiftPill,
                  {
                    backgroundColor: active
                      ? palette.capsuleActive
                      : palette.control,
                    borderColor: active ? BRAND_COLORS.emerald : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.shiftText,
                    {
                      color: active ? BRAND_COLORS.emeraldText : palette.textSecondary,
                      fontFamily: FONT_FAMILIES.sansSemiBold,
                    },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Date Note */}
        <View style={styles.noteHeaderRow}>
          <Text
            style={[
              styles.sectionLabel,
              { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
            ]}
          >
            Date note
          </Text>
          <Text
            style={[
              styles.charCount,
              TABULAR_NUMS,
              { color: palette.textMuted, fontFamily: FONT_FAMILIES.monoMedium },
            ]}
          >
            {note.length}/300
          </Text>
        </View>
        <BottomSheetTextInput
          ref={noteInputRef}
          editable={!isFutureDate}
          value={note}
          onChangeText={setNote}
          maxLength={300}
          multiline
          placeholder="Add class topic, reason, or reminder..."
          placeholderTextColor={palette.textMuted}
          style={[
            styles.noteInput,
            {
              backgroundColor: palette.control,
              borderColor: palette.border,
              color: palette.textPrimary,
              fontFamily: FONT_FAMILIES.sansRegular,
            },
          ]}
        />

        {/* Actions */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleClearEntry}
            disabled={saving || isFutureDate}
            style={[
              styles.clearBtn,
              {
                backgroundColor: palette.control,
                borderColor: palette.border,
              },
            ]}
          >
            <Trash2 size={16} color={SEMANTIC_COLORS.absent} />
            <Text
              style={[
                styles.clearText,
                { color: SEMANTIC_COLORS.absent, fontFamily: FONT_FAMILIES.sansSemiBold },
              ]}
            >
              Clear entry
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={saving || isFutureDate}
            style={[
              styles.saveBtn,
              {
                backgroundColor: activeAccent.primary,
                opacity: saving || isFutureDate ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.saveText, { fontFamily: FONT_FAMILIES.sansBold }]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheetScrollView>
  );
}

export function RecordEditorSheet() {
  const {
    editorTarget,
    closeRecordEditor,
    subjects,
    records,
    settings,
    palette,
  } = useAttendance();

  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['74%', '90%'], []);

  const targetSubject = useMemo(
    () => subjects.find((s) => s.id === editorTarget?.subjectId) ?? null,
    [subjects, editorTarget]
  );

  const existingRecord = useMemo(() => {
    if (!editorTarget) return undefined;
    return records.find(
      (r) => r.subjectId === editorTarget.subjectId && r.date === editorTarget.date
    );
  }, [records, editorTarget]);

  useEffect(() => {
    if (editorTarget) {
      const id = requestAnimationFrame(() => {
        sheetRef.current?.present();
      });
      return () => cancelAnimationFrame(id);
    }
    sheetRef.current?.dismiss();
    return undefined;
  }, [editorTarget]);

  const handleDismiss = useCallback(() => {
    closeRecordEditor();
  }, [closeRecordEditor]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      backgroundStyle={{
        backgroundColor: palette.sheet,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: palette.border,
      }}
      handleIndicatorStyle={{
        backgroundColor: palette.textMuted,
        width: 40,
      }}
    >
      {editorTarget ? (
        <RecordEditorBody
          key={`${editorTarget.subjectId}:${editorTarget.date}:${existingRecord?.updatedAt ?? 0}`}
          subjectId={editorTarget.subjectId}
          date={editorTarget.date}
          targetSubject={targetSubject}
          existingRecord={existingRecord}
          preferNote={settings.preferNote}
          lockAttendance={settings.lockAttendance}
          onClose={closeRecordEditor}
        />
      ) : (
        <View style={{ height: 1 }} />
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  dateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  futureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  futureBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subjectSub: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBanner: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  infoBannerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  lockBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.14)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  lockBannerText: {
    color: SEMANTIC_COLORS.absent,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  primaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  statusBtn: {
    width: '48.5%',
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  otStepperBox: {
    width: '48.5%',
    height: UI_METRICS.buttonHeight,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  otLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  otControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  otStepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otValue: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 22,
    textAlign: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  secondaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  shiftRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  shiftPill: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  charCount: {
    fontSize: 11,
  },
  noteInput: {
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clearBtn: {
    flex: 1,
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1.4,
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#050608',
    fontSize: 15,
    fontWeight: '700',
  },
});
