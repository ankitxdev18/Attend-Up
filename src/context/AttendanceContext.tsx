import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import type {
  AppSettings,
  AttendanceRecord,
  AttendanceStatus,
  SafetySnapshot,
  SortMode,
  Subject,
} from '../types/attendance';
import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  type ThemePalette,
} from '../theme/tokens';
import {
  AttendanceLockedError,
  bulkSetAllStatusForDate,
  bulkSetSubjectDatesStatus,
  DEFAULT_SETTINGS,
  deleteSubjectById,
  getAllRecords,
  getAllSnapshots,
  getAllSubjects,
  getAppSettings,
  initDatabase,
  reorderSubject as dbReorderSubject,
  restoreSafetySnapshot,
  saveDateNote as dbSaveDateNote,
  saveSubject as dbSaveSubject,
  setSubjectDayStatus,
  updateAppSettings,
  upsertAttendanceRecord,
} from '../db/database';
import type { UpdateInfo } from '../lib/appUpdater';
import {
  configureNotifications,
  handleNotificationResponse,
  scheduleDailyReminder,
} from '../lib/notifications';
import { refreshAllWidgets } from '../widgets/syncWidgets';
import { computeAttendanceStats, STATUS_META } from '../utils/attendance';
import { FloatingToast, type FloatingToastData } from '../components/FloatingToast';

export interface EditorTarget {
  subjectId: string;
  date: string;
}

interface ShowToastOptions {
  tone?: FloatingToastData['tone'];
  onUndo?: () => Promise<void> | void;
  undoLabel?: string;
}

interface AttendanceContextValue {
  ready: boolean;
  subjects: Subject[];
  records: AttendanceRecord[];
  settings: AppSettings;
  snapshots: SafetySnapshot[];
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  palette: ThemePalette;
  isDark: boolean;
  lockedByPin: boolean;
  unlockApp: () => void;
  overallPercentage: number;
  showToast: (
    text: string,
    toneOrOptions?: FloatingToastData['tone'] | ShowToastOptions
  ) => void;
  dismissToast: () => void;
  refreshAll: () => Promise<void>;
  toggleDarkMode: () => Promise<void>;
  saveSettingsPatch: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  saveSubject: (input: {
    id?: string;
    name: string;
    targetPercentage: number;
    color: string;
    autoMarkSundays: boolean;
    scheduleDays?: number[];
  }) => Promise<Subject>;
  deleteSubject: (subjectId: string) => Promise<void>;
  reorderSubject: (subjectId: string, direction: 'up' | 'down') => Promise<void>;
  markDayStatus: (
    subjectId: string,
    date: string,
    status: AttendanceStatus
  ) => Promise<boolean>;
  saveFullRecord: (record: Omit<AttendanceRecord, 'updatedAt'>) => Promise<boolean>;
  saveDateNote: (subjectId: string, date: string, note: string) => Promise<boolean>;
  bulkMarkDate: (
    date: string,
    status: Exclude<AttendanceStatus, null>,
    reason: string
  ) => Promise<boolean>;
  bulkMarkSubjectDates: (
    subjectId: string,
    dates: string[],
    status: Exclude<AttendanceStatus, null>,
    reason: string
  ) => Promise<boolean>;
  restoreSnapshot: (snapshotId: string) => Promise<boolean>;
  editorTarget: EditorTarget | null;
  openRecordEditor: (subjectId: string, date: string) => void;
  closeRecordEditor: () => void;
  availableUpdate: UpdateInfo | null;
  setAvailableUpdate: (info: UpdateInfo | null) => void;
  updateModalOpen: boolean;
  openUpdateModal: () => void;
  closeUpdateModal: () => void;
}

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [snapshots, setSnapshots] = useState<SafetySnapshot[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [lockedByPin, setLockedByPin] = useState(false);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  const openUpdateModal = useCallback(() => {
    setUpdateModalOpen(true);
  }, []);

  const closeUpdateModal = useCallback(() => {
    setUpdateModalOpen(false);
  }, []);
  const [toast, setToast] = useState<FloatingToastData | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastOpacity] = useState(() => new Animated.Value(0));
  const appStateRef = useRef<string>(AppState.currentState ?? 'active');
  const backgroundedAtRef = useRef<number | null>(null);
  const pinHashRef = useRef(settings.pinHash);
  const recordsRef = useRef(records);

  useEffect(() => {
    pinHashRef.current = settings.pinHash;
  }, [settings.pinHash]);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
        toastTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const AUTO_LOCK_GRACE_MS = 30_000;
    const sub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background') {
        if (backgroundedAtRef.current === null) {
          backgroundedAtRef.current = Date.now();
        }
        return;
      }

      if (nextState === 'active' && prevState !== 'active') {
        const bgTime = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (
          pinHashRef.current &&
          bgTime !== null &&
          Date.now() - bgTime > AUTO_LOCK_GRACE_MS
        ) {
          setEditorTarget(null);
          setLockedByPin(true);
        }
      }
    });
    return () => sub.remove();
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [toastOpacity]);

  const showToast = useCallback(
    (
      text: string,
      toneOrOptions?: FloatingToastData['tone'] | ShowToastOptions
    ) => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
      const opts: ShowToastOptions =
        typeof toneOrOptions === 'string'
          ? { tone: toneOrOptions }
          : (toneOrOptions ?? {});

      setToast({
        id: Date.now(),
        text,
        tone: opts.tone ?? 'info',
        onUndo: opts.onUndo,
        undoLabel: opts.undoLabel,
      });

      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();

      toastTimer.current = setTimeout(() => {
        dismissToast();
      }, 3500);
    },
    [dismissToast, toastOpacity]
  );

  const refreshAll = useCallback(async () => {
    await initDatabase();
    const [subs, recs, appSettings, snaps] = await Promise.all([
      getAllSubjects(),
      getAllRecords(),
      getAppSettings(),
      getAllSnapshots(),
    ]);
    setSubjects(subs);
    setRecords(recs);
    setSettings(appSettings);
    setSnapshots(snaps);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('SQLite init timeout')), 3000);
        });

        await Promise.race([
          (async () => {
            await initDatabase();
            const [subs, recs, appSettings, snaps] = await Promise.all([
              getAllSubjects(),
              getAllRecords(),
              getAppSettings(),
              getAllSnapshots(),
            ]);
            if (!mounted) return;
            setSubjects(subs);
            setRecords(recs);
            setSettings(appSettings);
            setSnapshots(snaps);
            if (appSettings.pinHash) {
              setLockedByPin(true);
            }
          })(),
          timeoutPromise,
        ]);

        // Non-blocking notification setup so native channel quirks never stall cold boot.
        void configureNotifications().catch(() => {});
      } catch {
        // Proceed to render UI even if cold-start DB/notification init hits a timeout.
      } finally {
        if (mounted) setReady(true);
      }
    })();

    let subscription: Notifications.EventSubscription | null = null;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          try {
            const result = await handleNotificationResponse(response);
            if (result.handled) {
              await refreshAll();
              showToast(
                `Marked ${result.status === 'present' ? 'Present' : 'Absent'} for ${result.count} subject(s)`,
                'success'
              );
            }
          } catch {
            // Ignore notification action handling errors.
          }
        }
      );
    } catch {
      // Ignore listener registration failures in unsupported runtimes.
    }

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [refreshAll, showToast]);

  const palette = settings.darkMode ? DARK_PALETTE : LIGHT_PALETTE;

  const overallPercentage = useMemo(() => {
    const st = computeAttendanceStats(records, 75);
    return st.percentage;
  }, [records]);

  const saveSettingsPatch = useCallback(async (patch: Partial<AppSettings>) => {
    const updated = await updateAppSettings(patch);
    setSettings(updated);
    if (
      patch.reminderEnabled !== undefined ||
      patch.reminderTime !== undefined ||
      patch.reminderSubjectIds !== undefined
    ) {
      await scheduleDailyReminder(
        updated.reminderEnabled,
        updated.reminderTime,
        updated.reminderSubjectIds
      );
    }
    if (
      patch.widgetSubjectId !== undefined ||
      patch.widgetStyle !== undefined ||
      patch.widgetMonth !== undefined
    ) {
      await refreshAllWidgets();
    }
    return updated;
  }, []);

  const toggleDarkMode = useCallback(async () => {
    await saveSettingsPatch({ darkMode: !settings.darkMode });
  }, [saveSettingsPatch, settings.darkMode]);

  const saveSubject = useCallback(
    async (input: {
      id?: string;
      name: string;
      targetPercentage: number;
      color: string;
      autoMarkSundays: boolean;
      scheduleDays?: number[];
    }) => {
      const saved = await dbSaveSubject(input);
      await refreshAll();
      await refreshAllWidgets();
      return saved;
    },
    [refreshAll]
  );

  const deleteSubject = useCallback(
    async (subjectId: string) => {
      await deleteSubjectById(subjectId);
      await refreshAll();
      await refreshAllWidgets();
      showToast('Subject deleted · Safety snapshot saved', 'info');
    },
    [refreshAll, showToast]
  );

  const reorderSubject = useCallback(
    async (subjectId: string, direction: 'up' | 'down') => {
      await dbReorderSubject(subjectId, direction);
      await refreshAll();
    },
    [refreshAll]
  );

  const restoreSnapshot = useCallback(
    async (snapshotId: string) => {
      const ok = await restoreSafetySnapshot(snapshotId);
      if (ok) {
        await refreshAll();
        await refreshAllWidgets();
        showToast('Restored previous state', 'success');
      }
      return ok;
    },
    [refreshAll, showToast]
  );

  const markDayStatus = useCallback(
    async (subjectId: string, date: string, status: AttendanceStatus) => {
      const previous = recordsRef.current.find(
        (r) => r.subjectId === subjectId && r.date === date
      );
      try {
        await setSubjectDayStatus(subjectId, date, status);
        await refreshAll();
        void refreshAllWidgets();

        const label = status ? `Marked ${STATUS_META[status].label}` : 'Cleared entry';
        showToast(label, {
          tone: 'success',
          undoLabel: 'Undo',
          onUndo: async () => {
            await upsertAttendanceRecord({
              subjectId,
              date,
              status: previous?.status ?? null,
              overtimeHours: previous?.overtimeHours ?? 0,
              classesCount: previous?.classesCount ?? 1,
              shift: previous?.shift ?? '',
              note: previous?.note ?? '',
            });
            await refreshAll();
            void refreshAllWidgets();
          },
        });
        return true;
      } catch (err) {
        if (err instanceof AttendanceLockedError) {
          showToast(err.message, 'error');
          return false;
        }
        throw err;
      }
    },
    [refreshAll, showToast]
  );

  const saveFullRecord = useCallback(
    async (record: Omit<AttendanceRecord, 'updatedAt'>) => {
      const previous = recordsRef.current.find(
        (r) => r.subjectId === record.subjectId && r.date === record.date
      );
      try {
        await upsertAttendanceRecord(record);
        await refreshAll();
        void refreshAllWidgets();

        const isClearing =
          record.status === null &&
          !record.overtimeHours &&
          !record.shift &&
          !record.note.trim();
        const noteChanged =
          record.note.trim().length > 0 &&
          (previous?.note ?? '').trim() !== record.note.trim();
        const label = isClearing
          ? 'Cleared entry'
          : noteChanged
            ? 'Note saved'
            : record.status
              ? `Marked ${STATUS_META[record.status].label}`
              : 'Note saved';

        showToast(label, {
          tone: 'success',
          undoLabel: 'Undo',
          onUndo: async () => {
            await upsertAttendanceRecord({
              subjectId: record.subjectId,
              date: record.date,
              status: previous?.status ?? null,
              overtimeHours: previous?.overtimeHours ?? 0,
              classesCount: previous?.classesCount ?? 1,
              shift: previous?.shift ?? '',
              note: previous?.note ?? '',
            });
            await refreshAll();
            void refreshAllWidgets();
          },
        });
        return true;
      } catch (err) {
        if (err instanceof AttendanceLockedError) {
          showToast(err.message, 'error');
          return false;
        }
        throw err;
      }
    },
    [refreshAll, showToast]
  );

  const saveDateNote = useCallback(
    async (subjectId: string, date: string, note: string) => {
      const previous = recordsRef.current.find(
        (r) => r.subjectId === subjectId && r.date === date
      );
      try {
        await dbSaveDateNote(subjectId, date, note);
        await refreshAll();
        void refreshAllWidgets();

        showToast(note.trim() ? 'Note saved' : 'Note cleared', {
          tone: 'success',
          undoLabel: 'Undo',
          onUndo: async () => {
            await dbSaveDateNote(subjectId, date, previous?.note ?? '');
            await refreshAll();
            void refreshAllWidgets();
          },
        });
        return true;
      } catch (err) {
        if (err instanceof AttendanceLockedError) {
          showToast(err.message, 'error');
          return false;
        }
        throw err;
      }
    },
    [refreshAll, showToast]
  );

  const bulkMarkDate = useCallback(
    async (
      date: string,
      status: Exclude<AttendanceStatus, null>,
      reason: string
    ) => {
      try {
        const snapshot = await bulkSetAllStatusForDate(date, status, reason);
        await refreshAll();
        await refreshAllWidgets();
        showToast(`Marked all ${STATUS_META[status].label}`, {
          tone: 'success',
          undoLabel: 'Undo',
          onUndo: async () => {
            await restoreSnapshot(snapshot.id);
          },
        });
        return true;
      } catch (err) {
        if (err instanceof AttendanceLockedError) {
          showToast(err.message, 'error');
          return false;
        }
        throw err;
      }
    },
    [refreshAll, restoreSnapshot, showToast]
  );

  const bulkMarkSubjectDates = useCallback(
    async (
      subjectId: string,
      dates: string[],
      status: Exclude<AttendanceStatus, null>,
      reason: string
    ) => {
      if (dates.length === 0) {
        showToast('No matching unmarked dates in this month.', 'info');
        return false;
      }
      try {
        const snapshot = await bulkSetSubjectDatesStatus(
          subjectId,
          dates,
          status,
          reason
        );
        await refreshAll();
        await refreshAllWidgets();
        const countLabel = `${dates.length} ${dates.length === 1 ? 'day' : 'days'}`;
        showToast(`Marked ${countLabel} ${STATUS_META[status].label}`, {
          tone: 'success',
          undoLabel: 'Undo',
          onUndo: async () => {
            await restoreSnapshot(snapshot.id);
          },
        });
        return true;
      } catch (err) {
        if (err instanceof AttendanceLockedError) {
          showToast(err.message, 'error');
          return false;
        }
        throw err;
      }
    },
    [refreshAll, restoreSnapshot, showToast]
  );

  const openRecordEditor = useCallback((subjectId: string, date: string) => {
    setEditorTarget({ subjectId, date });
  }, []);

  const closeRecordEditor = useCallback(() => {
    setEditorTarget(null);
  }, []);

  const unlockApp = useCallback(() => {
    setLockedByPin(false);
  }, []);

  const value = useMemo<AttendanceContextValue>(
    () => ({
      ready,
      subjects,
      records,
      settings,
      snapshots,
      sortMode,
      setSortMode,
      palette,
      isDark: settings.darkMode,
      lockedByPin,
      unlockApp,
      overallPercentage,
      showToast,
      dismissToast,
      refreshAll,
      toggleDarkMode,
      saveSettingsPatch,
      saveSubject,
      deleteSubject,
      reorderSubject,
      markDayStatus,
      saveFullRecord,
      saveDateNote,
      bulkMarkDate,
      bulkMarkSubjectDates,
      restoreSnapshot,
      editorTarget,
      openRecordEditor,
      closeRecordEditor,
      availableUpdate,
      setAvailableUpdate,
      updateModalOpen,
      openUpdateModal,
      closeUpdateModal,
    }),
    [
      ready,
      subjects,
      records,
      settings,
      snapshots,
      sortMode,
      palette,
      lockedByPin,
      unlockApp,
      overallPercentage,
      showToast,
      dismissToast,
      refreshAll,
      toggleDarkMode,
      saveSettingsPatch,
      saveSubject,
      deleteSubject,
      reorderSubject,
      markDayStatus,
      saveFullRecord,
      saveDateNote,
      bulkMarkDate,
      bulkMarkSubjectDates,
      restoreSnapshot,
      editorTarget,
      openRecordEditor,
      closeRecordEditor,
      availableUpdate,
      updateModalOpen,
      openUpdateModal,
      closeUpdateModal,
    ]
  );

  return (
    <AttendanceContext.Provider value={value}>
      {children}
      <FloatingToast
        toast={toast}
        opacity={toastOpacity}
        isDark={settings.darkMode}
        onDismiss={dismissToast}
      />
    </AttendanceContext.Provider>
  );
}

export function useAttendance(): AttendanceContextValue {
  const ctx = useContext(AttendanceContext);
  if (!ctx) {
    throw new Error('useAttendance must be used within AttendanceProvider');
  }
  return ctx;
}
