import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { LiquidGlassCard } from './LiquidGlassCard';
import type { Subject } from '../types/attendance';
import { useAttendance } from '../context/AttendanceContext';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  HEADING_STYLE,
  SUBJECT_COLORS,
  TABULAR_NUMS,
  UI_METRICS,
} from '../theme/tokens';
import { ValidationError } from '../lib/validation';

interface SubjectFormModalProps {
  visible: boolean;
  editingSubject: Subject | null;
  onClose: () => void;
}

const WEEKDAY_CHIPS: { day: number; label: string }[] = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
];

function SubjectFormBody({
  editingSubject,
  onClose,
}: {
  editingSubject: Subject | null;
  onClose: () => void;
}) {
  const { palette, saveSubject, showToast } = useAttendance();
  const [name, setName] = useState(editingSubject?.name ?? '');
  const [target, setTarget] = useState(
    String(editingSubject?.targetPercentage ?? 75)
  );
  const [color, setColor] = useState<string>(
    editingSubject?.color ?? SUBJECT_COLORS[0]
  );
  const [autoMarkSundays, setAutoMarkSundays] = useState(
    editingSubject?.autoMarkSundays ?? true
  );
  const [scheduleDays, setScheduleDays] = useState<number[]>(
    editingSubject?.scheduleDays ?? [1, 2, 3, 4, 5]
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleScheduleDay = (day: number) => {
    setScheduleDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError('');
    const parsedTarget = Number(target);
    if (!target.trim() || !Number.isFinite(parsedTarget) || parsedTarget < 1 || parsedTarget > 100) {
      setError('Target percentage must be between 1 and 100.');
      return;
    }
    setSubmitting(true);
    try {
      await saveSubject({
        id: editingSubject?.id,
        name,
        targetPercentage: parsedTarget,
        color,
        autoMarkSundays,
        scheduleDays,
      });
      showToast(editingSubject ? 'Subject updated' : 'Subject added', 'success');
      onClose();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError('Could not save subject.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.backdrop}
    >
      <LiquidGlassCard borderRadius={28} useNativeBlur focused style={styles.card}>
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              HEADING_STYLE,
              { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
            ]}
          >
            {editingSubject ? 'Edit subject' : 'Add subject'}
          </Text>
          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: palette.control }]}
          >
            <X size={18} color={palette.textPrimary} />
          </Pressable>
        </View>

        <Text
          style={[
            styles.label,
            { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
          ]}
        >
          Subject name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={40}
          placeholder="e.g. Operating Systems"
          placeholderTextColor={palette.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: palette.control,
              borderColor: palette.border,
              color: palette.textPrimary,
              fontFamily: FONT_FAMILIES.sansRegular,
            },
          ]}
        />

        <Text
          style={[
            styles.label,
            { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
          ]}
        >
          Target percentage (1–100)
        </Text>
        <TextInput
          value={target}
          onChangeText={(t) => setTarget(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="75"
          placeholderTextColor={palette.textMuted}
          style={[
            styles.input,
            TABULAR_NUMS,
            {
              backgroundColor: palette.control,
              borderColor: palette.border,
              color: palette.textPrimary,
              fontFamily: FONT_FAMILIES.monoBold,
            },
          ]}
        />

        <Text
          style={[
            styles.label,
            { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
          ]}
        >
          Weekly class schedule
        </Text>
        <View style={styles.daysRow}>
          {WEEKDAY_CHIPS.map(({ day, label }) => {
            const active = scheduleDays.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleScheduleDay(day)}
                style={[
                  styles.dayPill,
                  {
                    backgroundColor: active
                      ? BRAND_COLORS.emeraldPresentBg
                      : palette.control,
                    borderColor: active ? BRAND_COLORS.emerald : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayPillText,
                    {
                      color: active
                        ? BRAND_COLORS.emeraldText
                        : palette.textSecondary,
                      fontFamily: FONT_FAMILIES.sansSemiBold,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={[
            styles.label,
            { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansSemiBold },
          ]}
        >
          Accent color
        </Text>
        <View style={styles.swatchRow}>
          {SUBJECT_COLORS.map((swatch) => {
            const selected = color === swatch;
            return (
              <Pressable
                key={swatch}
                onPress={() => setColor(swatch)}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: swatch,
                    borderWidth: selected ? 2.5 : 0,
                    borderColor: palette.textPrimary,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={[
                styles.switchTitle,
                { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
              ]}
            >
              Auto-mark Sundays as Holiday
            </Text>
            <Text
              style={[
                styles.switchDesc,
                { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansRegular },
              ]}
            >
              Can still be overridden manually on any Sunday
            </Text>
          </View>
          <Switch
            value={autoMarkSundays}
            onValueChange={setAutoMarkSundays}
            trackColor={{ false: palette.control, true: BRAND_COLORS.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            style={[
              styles.cancelBtn,
              { backgroundColor: palette.control, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.cancelText,
                { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
              ]}
            >
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.saveBtn, { backgroundColor: BRAND_COLORS.primary }]}
          >
            <Text
              style={[
                styles.saveText,
                HEADING_STYLE,
                { color: '#050608', fontFamily: FONT_FAMILIES.sansBold },
              ]}
            >
              {submitting ? 'Saving...' : editingSubject ? 'Save changes' : 'Create'}
            </Text>
          </Pressable>
        </View>
      </LiquidGlassCard>
    </KeyboardAvoidingView>
  );
}

export function SubjectFormModal({
  visible,
  editingSubject,
  onClose,
}: SubjectFormModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible ? (
        <SubjectFormBody
          key={editingSubject?.id ?? 'new-subject'}
          editingSubject={editingSubject}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 14,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  dayPill: {
    paddingHorizontal: 11,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: '#FB7185',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1.3,
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
