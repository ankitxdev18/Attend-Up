import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import {
  Bell,
  Calendar,
  Clock,
  Copy,
  Info,
  LayoutGrid,
  Lock,
  Moon,
  RefreshCw,
  Send,
  Share2,
  Shield,
  Smartphone,
  StickyNote,
  X,
} from 'lucide-react-native';
import type { RootDrawerParamList } from '../navigation/types';
import { useAttendance } from '../context/AttendanceContext';
import { hashPin } from '../db/database';
import { isNativeWidgetSupported } from '../lib/nativeWidgetSupport';
import {
  checkForAppUpdate,
  getInstalledVersion,
  LATEST_RELEASES_PAGE,
  type UpdateInfo,
} from '../lib/appUpdater';
import { sendTestReminderNotification } from '../lib/notifications';
import { UpdateModal } from '../components/UpdateModal';
import { validatePin, ValidationError } from '../lib/validation';
import {
  computeAttendanceStats,
  computeStreak,
  formatDisplayDate,
  formatMonthKey,
  formatMonthLabel,
  getEffectiveStatus,
  getLast12WeeksGrid,
  getMonthGrid,
  parseDateISO,
  STATUS_META,
} from '../utils/attendance';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  HEADING_STYLE,
  SEMANTIC_COLORS,
  TABULAR_NUMS,
  UI_METRICS,
} from '../theme/tokens';
import { AmbientCanvas, MinimalMenuIcon } from '../components/AmbientCanvas';

function timeStringToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 20, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function SettingsScreen() {
  const drawerNav = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const {
    subjects,
    records,
    settings,
    palette,
    saveSettingsPatch,
    showToast,
  } = useAttendance();

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSemesterPicker, setShowSemesterPicker] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [manualUpdateInfo, setManualUpdateInfo] = useState<UpdateInfo | null>(null);
  const installedVersion = getInstalledVersion();
  const [previewTab, setPreviewTab] = useState<'heatmap' | 'calendar'>(
    settings.widgetStyle
  );

  const pinnedSubject = useMemo(
    () => subjects.find((s) => s.id === settings.widgetSubjectId) ?? subjects[0],
    [subjects, settings.widgetSubjectId]
  );

  const nativeWidgetReady = isNativeWidgetSupported();

  const handleTogglePinLock = async (enable: boolean) => {
    if (enable) {
      setPinInput('');
      setPinConfirm('');
      setPinError('');
      setPinModalOpen(true);
    } else {
      await saveSettingsPatch({ pinHash: '' });
      showToast('App PIN Lock disabled', 'info');
    }
  };

  const handleSavePin = async () => {
    setPinError('');
    try {
      validatePin(pinInput);
      if (pinInput !== pinConfirm) {
        setPinError('PIN entries do not match.');
        return;
      }
      const hashed = await hashPin(pinInput);
      await saveSettingsPatch({ pinHash: hashed });
      setPinModalOpen(false);
      showToast('4-digit PIN Lock enabled', 'success');
    } catch (err) {
      if (err instanceof ValidationError) {
        setPinError(err.message);
      } else {
        setPinError('Could not save PIN.');
      }
    }
  };

  const handleToggleReminderSubject = async (subjectId: string) => {
    const current = settings.reminderSubjectIds;
    const exists = current.includes(subjectId);
    const next = exists
      ? current.filter((id) => id !== subjectId)
      : [...current, subjectId];
    await saveSettingsPatch({ reminderSubjectIds: next });
  };

  const handleTimeValueChange = async (
    _event: DateTimePickerChangeEvent,
    selectedDate: Date
  ) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    const nextTime = dateToTimeString(selectedDate);
    await saveSettingsPatch({ reminderTime: nextTime });
    showToast(`Daily reminder set for ${nextTime}`, 'success');
  };

  const handleToggleReminder = async (enabled: boolean) => {
    await saveSettingsPatch({ reminderEnabled: enabled });
    showToast(
      enabled
        ? `Daily reminder scheduled at ${settings.reminderTime}`
        : 'Daily reminder disabled',
      'info'
    );
  };

  const handleSendTest = async () => {
    const ok = await sendTestReminderNotification(settings.reminderSubjectIds);
    if (ok) {
      showToast('Test notification sent! Pull down notification shade.', 'success');
    } else {
      showToast('Notification permission not granted.', 'error');
    }
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
          <Text
            style={[
              styles.headerTitle,
              HEADING_STYLE,
              { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
            ]}
          >
            Settings
          </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* General Preferences Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.groupTitle, { color: palette.textSecondary }]}>
            General
          </Text>

          <View style={[styles.settingRow, { borderBottomColor: palette.border }]}>
            <View style={styles.rowLeft}>
              <View style={styles.settingIconBadge}>
                <Lock size={16} color={BRAND_COLORS.iconMonochrome} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>
                  Lock Attendance
                </Text>
                <Text style={[styles.rowDesc, { color: palette.textMuted }]}>
                  Restrict edits strictly to today’s date
                </Text>
              </View>
            </View>
            <Switch
              value={settings.lockAttendance}
              onValueChange={(val) => void saveSettingsPatch({ lockAttendance: val })}
              trackColor={{ false: palette.control, true: SEMANTIC_COLORS.present }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: palette.border }]}>
            <View style={styles.rowLeft}>
              <View style={styles.settingIconBadge}>
                <StickyNote size={16} color={BRAND_COLORS.iconMonochrome} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>
                  Prefer Note
                </Text>
                <Text style={[styles.rowDesc, { color: palette.textMuted }]}>
                  Focus saved notes automatically when opening a date
                </Text>
              </View>
            </View>
            <Switch
              value={settings.preferNote}
              onValueChange={(val) => void saveSettingsPatch({ preferNote: val })}
              trackColor={{ false: palette.control, true: SEMANTIC_COLORS.present }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <View style={styles.settingIconBadge}>
                <Moon size={16} color={BRAND_COLORS.iconMonochrome} />
              </View>
              <View style={styles.rowText}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  Dark Mode
                </Text>
                <Text
                  style={[
                    styles.rowDesc,
                    { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansRegular },
                  ]}
                >
                  Low-glare charcoal theme for night use
                </Text>
              </View>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={(val) => void saveSettingsPatch({ darkMode: val })}
              trackColor={{ false: palette.control, true: BRAND_COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Pressable
            onPress={() => setShowSemesterPicker(true)}
            style={[styles.settingRow, { borderTopColor: palette.border, borderTopWidth: 1, borderBottomWidth: 0 }]}
          >
            <View style={styles.rowLeft}>
              <View style={styles.settingIconBadge}>
                <Calendar size={16} color={BRAND_COLORS.bright} />
              </View>
              <View style={styles.rowText}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  Semester End Date
                </Text>
                <Text
                  style={[
                    styles.rowDesc,
                    { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansRegular },
                  ]}
                >
                  {settings.semesterEndDate
                    ? `Ends ${formatDisplayDate(settings.semesterEndDate)}`
                    : 'Optional cutoff for semester countdown'}
                </Text>
              </View>
            </View>
            {settings.semesterEndDate ? (
              <Pressable
                onPress={() => void saveSettingsPatch({ semesterEndDate: '' })}
                hitSlop={8}
                style={[styles.clearPill, { backgroundColor: palette.control, borderColor: palette.border }]}
              >
                <Text style={[styles.clearPillText, { color: palette.textSecondary }]}>Clear</Text>
              </Pressable>
            ) : null}
          </Pressable>

          {showSemesterPicker ? (
            <DateTimePicker
              value={
                settings.semesterEndDate
                  ? parseDateISO(settings.semesterEndDate)
                  : new Date()
              }
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onValueChange={(_event: DateTimePickerChangeEvent, selectedDate: Date) => {
                if (Platform.OS === 'android') {
                  setShowSemesterPicker(false);
                }
                const y = selectedDate.getFullYear();
                const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const d = String(selectedDate.getDate()).padStart(2, '0');
                void saveSettingsPatch({ semesterEndDate: `${y}-${m}-${d}` });
              }}
              onDismiss={() => setShowSemesterPicker(false)}
            />
          ) : null}
        </View>

        {/* Security: App PIN Lock */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.groupTitle, { color: palette.textSecondary }]}>
            Security
          </Text>
          <View
            style={[
              styles.settingRow,
              { borderBottomWidth: settings.pinHash ? 1 : 0, borderBottomColor: palette.border },
            ]}
          >
            <View style={styles.rowLeft}>
              <View style={styles.settingIconBadge}>
                <Shield size={16} color={BRAND_COLORS.emerald} />
              </View>
              <View style={styles.rowText}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                  ]}
                >
                  App PIN Lock
                </Text>
                <Text
                  style={[
                    styles.rowDesc,
                    { color: palette.textMuted, fontFamily: FONT_FAMILIES.sansRegular },
                  ]}
                >
                  Protect your attendance records with a 4-digit PIN
                </Text>
              </View>
            </View>
            <Switch
              value={Boolean(settings.pinHash)}
              onValueChange={handleTogglePinLock}
              trackColor={{ false: palette.control, true: BRAND_COLORS.emerald }}
              thumbColor="#FFFFFF"
            />
          </View>

          {settings.pinHash ? (
            <Pressable
              onPress={() => {
                setPinInput('');
                setPinConfirm('');
                setPinError('');
                setPinModalOpen(true);
              }}
              style={[
                styles.secondaryBtn,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: palette.textPrimary }]}>
                Change 4-digit PIN
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Daily Reminder Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.groupTitle, { color: palette.textSecondary }]}>
            Daily Reminder
          </Text>

          <View style={[styles.settingRow, { borderBottomColor: palette.border }]}>
            <View style={styles.rowLeft}>
              <View style={styles.settingIconBadge}>
                <Bell size={16} color={BRAND_COLORS.iconMonochrome} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>
                  Enable daily reminder
                </Text>
                <Text style={[styles.rowDesc, { color: palette.textMuted }]}>
                  Includes ✓ Mark Present & ✕ Mark Absent quick actions
                </Text>
              </View>
            </View>
            <Switch
              value={settings.reminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: palette.control, true: SEMANTIC_COLORS.present }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.timePickerRow}>
            <View style={styles.rowLeft}>
              <View style={styles.settingIconBadge}>
                <Clock size={15} color="#94A3B8" />
              </View>
              <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>
                Reminder time
              </Text>
            </View>
            <Pressable
              onPress={() => setShowTimePicker((prev) => !prev)}
              style={[
                styles.timePill,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <Text
                style={[
                  styles.timePillText,
                  TABULAR_NUMS,
                  { color: SEMANTIC_COLORS.present },
                ]}
              >
                {settings.reminderTime}
              </Text>
            </Pressable>
          </View>

          {showTimePicker ? (
            <DateTimePicker
              value={timeStringToDate(settings.reminderTime)}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={handleTimeValueChange}
              onDismiss={() => setShowTimePicker(false)}
            />
          ) : null}

          <Text style={[styles.subLabel, { color: palette.textSecondary }]}>
            Subjects to mark from notification actions (empty = all)
          </Text>
          <View style={styles.chipsWrap}>
            {subjects.map((sub) => {
              const selected = settings.reminderSubjectIds.includes(sub.id);
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => handleToggleReminderSubject(sub.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? 'rgba(16, 185, 129, 0.14)'
                        : palette.control,
                      borderColor: selected
                        ? SEMANTIC_COLORS.present
                        : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: selected
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

          <Pressable
            onPress={handleSendTest}
            style={[
              styles.secondaryBtn,
              {
                backgroundColor: palette.control,
                borderColor: palette.border,
                marginTop: 12,
              },
            ]}
          >
            <Send size={15} color={SEMANTIC_COLORS.present} />
            <Text style={[styles.secondaryBtnText, { color: palette.textPrimary }]}>
              Send Test Notification
            </Text>
          </Pressable>
        </View>

        {/* App & Updates Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.appUpdateHeader}>
            <View>
              <Text style={[styles.groupTitle, { color: palette.textSecondary, marginBottom: 2 }]}>
                App & Updates
              </Text>
              <Text
                style={[
                  styles.versionCaption,
                  TABULAR_NUMS,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.monoBold },
                ]}
              >
                AttendUp v{installedVersion}
              </Text>
            </View>

            <Pressable
              disabled={checkingUpdate}
              onPress={async () => {
                setCheckingUpdate(true);
                try {
                  const info = await checkForAppUpdate({ force: true });
                  if (info) {
                    setManualUpdateInfo(info);
                  } else {
                    showToast("You're on the latest version", 'success');
                  }
                } finally {
                  setCheckingUpdate(false);
                }
              }}
              style={[
                styles.checkUpdateBtn,
                {
                  backgroundColor: BRAND_COLORS.tintBg,
                  borderColor: BRAND_COLORS.tintBorder,
                  opacity: checkingUpdate ? 0.7 : 1,
                },
              ]}
            >
              {checkingUpdate ? (
                <ActivityIndicator size="small" color={BRAND_COLORS.bright} />
              ) : (
                <RefreshCw size={14} color={BRAND_COLORS.bright} />
              )}
              <Text
                style={[
                  styles.checkUpdateText,
                  { color: BRAND_COLORS.bright, fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                {checkingUpdate ? 'Checking...' : 'Check for Updates'}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.apkLinkBox,
              { backgroundColor: palette.control, borderColor: palette.border },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.apkLinkText,
                { color: palette.textSecondary, fontFamily: FONT_FAMILIES.monoMedium },
              ]}
            >
              {LATEST_RELEASES_PAGE}
            </Text>
          </View>

          <View style={styles.shareActionsRow}>
            <Pressable
              onPress={async () => {
                try {
                  await Share.share({
                    message: `Download AttendUp APK (v${installedVersion}): ${LATEST_RELEASES_PAGE}`,
                  });
                } catch {
                  // Ignore share sheet cancellation
                }
              }}
              style={[
                styles.shareActionBtn,
                { backgroundColor: BRAND_COLORS.primary },
              ]}
            >
              <Share2 size={15} color="#050608" />
              <Text
                style={[
                  styles.shareActionText,
                  { color: '#050608', fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                Share App Link
              </Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(LATEST_RELEASES_PAGE);
                showToast('APK download link copied', 'success');
              }}
              style={[
                styles.shareActionBtn,
                {
                  backgroundColor: palette.control,
                  borderColor: palette.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Copy size={15} color={palette.textPrimary} />
              <Text
                style={[
                  styles.shareActionText,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansSemiBold },
                ]}
              >
                Copy Link
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Home Screen Widget Configuration Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.widgetHeaderRow}>
            <View style={styles.settingIconBadge}>
              <LayoutGrid size={16} color={BRAND_COLORS.emerald} />
            </View>
            <Text style={[styles.groupTitle, { color: palette.textSecondary, marginBottom: 0 }]}>
              Home Screen Widget
            </Text>
          </View>

          <Text style={[styles.subLabel, { color: palette.textSecondary, marginTop: 10 }]}>
            Pinned subject
          </Text>
          <View style={styles.chipsWrap}>
            {subjects.map((sub) => {
              const selected = settings.widgetSubjectId === sub.id;
              return (
                <Pressable
                  key={sub.id}
                  onPress={() =>
                    void saveSettingsPatch({ widgetSubjectId: sub.id })
                  }
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? 'rgba(16, 185, 129, 0.14)'
                        : palette.control,
                      borderColor: selected
                        ? SEMANTIC_COLORS.present
                        : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: selected
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

          {/* Preview Switcher */}
          <View
            style={[
              styles.previewToggle,
              { backgroundColor: palette.capsuleTrack, borderColor: palette.border },
            ]}
          >
            {(['heatmap', 'calendar'] as const).map((tab) => {
              const active = previewTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => {
                    setPreviewTab(tab);
                    void saveSettingsPatch({ widgetStyle: tab });
                  }}
                  style={[
                    styles.previewTabBtn,
                    active && { backgroundColor: palette.capsuleActive },
                  ]}
                >
                  <Text
                    style={[
                      styles.previewTabText,
                      {
                        color: active ? palette.textPrimary : palette.textMuted,
                      },
                    ]}
                  >
                    {tab === 'heatmap' ? 'GitHub Heatmap' : 'Monthly Calendar'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Live Widget Preview */}
          {pinnedSubject ? (
            <View style={styles.previewWrap}>
              {nativeWidgetReady ? (
                <NativeWidgetPreviewCard
                  mode={previewTab}
                  subject={pinnedSubject}
                  records={records}
                  monthKey={settings.widgetMonth || formatMonthKey()}
                />
              ) : (
                <FallbackWidgetPreview
                  mode={previewTab}
                  subject={pinnedSubject}
                  records={records}
                  monthKey={settings.widgetMonth || formatMonthKey()}
                />
              )}
            </View>
          ) : null}

          {!nativeWidgetReady ? (
            <View
              style={[
                styles.expoGoNoteBox,
                { backgroundColor: palette.control, borderColor: palette.border },
              ]}
            >
              <View style={styles.infoIconBadge}>
                <Info size={14} color={BRAND_COLORS.emerald} />
              </View>
              <Text style={[styles.expoGoNoteText, { color: palette.textSecondary }]}>
                Running in Expo Go — install the built APK to pin real widgets to your Android home screen.
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.guideBox,
              { backgroundColor: palette.control, borderColor: palette.border },
            ]}
          >
            <View style={styles.infoIconBadge}>
              <Smartphone size={14} color="#94A3B8" />
            </View>
            <Text style={[styles.guideText, { color: palette.textSecondary }]}>
              Android setup: Long-press your home screen → Widgets → AttendUp → drag
              “AttendUp Heatmap” (4×2) or “AttendUp Calendar” (4×4). Tap + on
              either widget to mark Present instantly.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Set / Change 4-Digit PIN Modal */}
      <Modal
        visible={pinModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPinModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
                Set 4-digit PIN
              </Text>
              <Pressable
                onPress={() => setPinModalOpen(false)}
                style={[styles.closeBtn, { backgroundColor: palette.control }]}
              >
                <X size={18} color={palette.textPrimary} />
              </Pressable>
            </View>

            <Text style={[styles.subLabel, { color: palette.textSecondary }]}>
              Enter 4-digit PIN
            </Text>
            <TextInput
              value={pinInput}
              onChangeText={(t) => setPinInput(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={palette.textMuted}
              style={[
                styles.pinInput,
                TABULAR_NUMS,
                {
                  backgroundColor: palette.control,
                  borderColor: palette.border,
                  color: palette.textPrimary,
                },
              ]}
            />

            <Text style={[styles.subLabel, { color: palette.textSecondary }]}>
              Confirm 4-digit PIN
            </Text>
            <TextInput
              value={pinConfirm}
              onChangeText={(t) => setPinConfirm(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={palette.textMuted}
              style={[
                styles.pinInput,
                TABULAR_NUMS,
                {
                  backgroundColor: palette.control,
                  borderColor: palette.border,
                  color: palette.textPrimary,
                },
              ]}
            />

            {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}

            <Pressable
              onPress={handleSavePin}
              style={[
                styles.savePinBtn,
                { backgroundColor: SEMANTIC_COLORS.present },
              ]}
            >
              <Text style={styles.savePinText}>Save PIN</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
      <UpdateModal
        updateInfo={manualUpdateInfo}
        onClose={() => setManualUpdateInfo(null)}
      />
    </AmbientCanvas>
  );
}

function NativeWidgetPreviewCard({
  mode,
  subject,
  records,
  monthKey,
}: {
  mode: 'heatmap' | 'calendar';
  subject: NonNullable<ReturnType<typeof useAttendance>['subjects'][number]>;
  records: ReturnType<typeof useAttendance>['records'];
  monthKey: string;
}) {
  // Lazy-require only when native widget support is verified.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WidgetPreview } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HeatmapWidget } = require('../widgets/HeatmapWidget') as typeof import('../widgets/HeatmapWidget');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CalendarWidget } = require('../widgets/CalendarWidget') as typeof import('../widgets/CalendarWidget');

  if (mode === 'heatmap') {
    return (
      <WidgetPreview
        renderWidget={() => <HeatmapWidget subject={subject} records={records} />}
        width={310}
        height={152}
      />
    );
  }

  return (
    <WidgetPreview
      renderWidget={() => (
        <CalendarWidget
          subject={subject}
          records={records}
          monthKey={monthKey}
        />
      )}
      width={310}
      height={292}
    />
  );
}

const PREVIEW_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function FallbackWidgetPreview({
  mode,
  subject,
  records,
  monthKey,
}: {
  mode: 'heatmap' | 'calendar';
  subject: NonNullable<ReturnType<typeof useAttendance>['subjects'][number]>;
  records: ReturnType<typeof useAttendance>['records'];
  monthKey: string;
}) {
  const subRecords = records.filter((r) => r.subjectId === subject.id);
  const stats = computeAttendanceStats(subRecords, subject.targetPercentage);
  const streak = computeStreak(subRecords, subject.autoMarkSundays);
  const columns = getLast12WeeksGrid(subRecords, subject.autoMarkSundays);
  const monthCells = getMonthGrid(monthKey);

  const recordMap = new Map<string, (typeof subRecords)[number]>();
  for (const r of subRecords) {
    recordMap.set(r.date, r);
  }

  if (mode === 'heatmap') {
    return (
      <View style={styles.fallbackCard}>
        <View style={styles.fallbackHeader}>
          <Text numberOfLines={1} style={styles.fallbackTitle}>
            {subject.name}
          </Text>
          <View style={styles.fallbackBadges}>
            <Text style={[styles.fallbackChip, TABULAR_NUMS]}>
              {streak}d streak
            </Text>
            <Text
              style={[
                styles.fallbackChip,
                TABULAR_NUMS,
                {
                  color:
                    stats.percentage >= subject.targetPercentage ||
                    stats.totalCounted === 0
                      ? '#34D399'
                      : '#FB7185',
                },
              ]}
            >
              {stats.percentage.toFixed(1)}%
            </Text>
            <View style={styles.fallbackPlus}>
              <Text style={styles.fallbackPlusText}>+</Text>
            </View>
          </View>
        </View>
        <View style={styles.fallbackHeatmapGrid}>
          {columns.map((col, idx) => (
            <View key={`c-${idx}`} style={styles.fallbackHeatmapCol}>
              {col.map((cell) => {
                const bg = cell.isFuture
                  ? '#14161A'
                  : cell.status === 'present'
                    ? '#10B981'
                    : cell.status === 'absent'
                      ? '#FB7185'
                      : cell.status === 'half_day'
                        ? '#FBBF24'
                        : '#1E2026';
                return (
                  <View
                    key={cell.dateISO}
                    style={[styles.fallbackCell, { backgroundColor: bg }]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fallbackCard}>
      <View style={styles.fallbackHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fallbackTitle}>{formatMonthLabel(monthKey)}</Text>
          <Text numberOfLines={1} style={styles.fallbackSubTitle}>
            {subject.name}
          </Text>
        </View>
        <View style={styles.fallbackPlus}>
          <Text style={styles.fallbackPlusText}>+</Text>
        </View>
      </View>

      <View style={styles.fallbackWeekdayRow}>
        {PREVIEW_WEEKDAYS.map((day, idx) => (
          <Text
            key={`pwd-${idx}`}
            style={[
              styles.fallbackWeekdayText,
              { color: idx === 0 ? '#A1A1AA' : '#71717A' },
            ]}
          >
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.fallbackCalGrid}>
        {monthCells.map((cell) => {
          const rec = recordMap.get(cell.dateISO);
          const { status } = getEffectiveStatus(
            rec,
            cell.dateISO,
            subject.autoMarkSundays
          );
          const meta = cell.inCurrentMonth && status ? STATUS_META[status] : null;
          return (
            <View key={cell.dateISO} style={styles.fallbackCalCell}>
              <View
                style={[
                  styles.fallbackCalDayBadge,
                  cell.isToday && styles.fallbackCalTodayBadge,
                ]}
              >
                <Text
                  style={[
                    styles.fallbackCalNum,
                    TABULAR_NUMS,
                    {
                      color: cell.isToday
                        ? '#050608'
                        : cell.inCurrentMonth
                          ? '#FAFAFA'
                          : '#3F3F46',
                      fontWeight: cell.isToday ? '700' : '500',
                    },
                  ]}
                >
                  {cell.dayNumber}
                </Text>
              </View>
              {meta ? (
                <View
                  style={[
                    styles.fallbackCalPill,
                    { backgroundColor: meta.color },
                  ]}
                >
                  <Text style={styles.fallbackCalPillText}>{meta.short}</Text>
                </View>
              ) : (
                <View style={styles.fallbackCalPillSpacer} />
              )}
            </View>
          );
        })}
      </View>
    </View>
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
    paddingBottom: 32,
    gap: 14,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  secondaryBtn: {
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  timePill: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  widgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewToggle: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    marginTop: 14,
    marginBottom: 12,
  },
  previewTabBtn: {
    flex: 1,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  expoGoNoteBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  expoGoNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  guideBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guideText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 6,
    marginBottom: 12,
  },
  errorText: {
    color: '#F43F5E',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  savePinBtn: {
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  savePinText: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '700',
  },
  fallbackCard: {
    width: '100%',
    backgroundColor: '#101215',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
  },
  fallbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  fallbackTitle: {
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  fallbackBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fallbackChip: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#18181B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fallbackPlus: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: BRAND_COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackPlusText: {
    color: '#050608',
    fontSize: 15,
    fontWeight: '700',
  },
  settingIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND_COLORS.iconBadgeBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.iconBadgeBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackHeatmapGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fallbackHeatmapCol: {
    gap: 3,
  },
  fallbackCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  fallbackSubTitle: {
    color: '#A1A1AA',
    fontSize: 11,
    marginTop: 1,
  },
  fallbackWeekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fallbackWeekdayText: {
    width: '14.285%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
  },
  fallbackCalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fallbackCalCell: {
    width: '14.285%',
    alignItems: 'center',
    paddingVertical: 3,
  },
  fallbackCalDayBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackCalTodayBadge: {
    backgroundColor: '#10B981',
  },
  fallbackCalNum: {
    fontSize: 11,
  },
  fallbackCalPill: {
    marginTop: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  fallbackCalPillText: {
    color: '#09090B',
    fontSize: 8,
    fontWeight: '700',
  },
  fallbackCalPillSpacer: {
    height: 12,
  },
  clearPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  clearPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  appUpdateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  versionCaption: {
    fontSize: 15,
    fontWeight: '700',
  },
  checkUpdateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
  },
  checkUpdateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  apkLinkBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  apkLinkText: {
    fontSize: 11.5,
  },
  shareActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shareActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  shareActionText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
