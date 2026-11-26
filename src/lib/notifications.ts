import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { bulkSetSubjectsDayStatus, getAllSubjects, getAppSettings } from '../db/database';
import { formatDateISO } from '../utils/attendance';
import { refreshAllWidgets } from '../widgets/syncWidgets';

export const REMINDER_CATEGORY_ID = 'ATTENDANCE_REMINDER';
export const ACTION_MARK_PRESENT = 'MARK_PRESENT';
export const ACTION_MARK_ABSENT = 'MARK_ABSENT';
export const REMINDER_CHANNEL_ID = 'attendance-reminders';

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

let handlerRegistered = false;

export async function configureNotifications(): Promise<void> {
  if (!handlerRegistered) {
    handlerRegistered = true;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      // Ignore notification handler registration failures in unsupported runtimes.
    }
  }
  if (Platform.OS === 'android' && !isExpoGo()) {
    try {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Daily Attendance Reminders',
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#10B981',
      });
    } catch {
      // Ignore native channel setup errors so app startup never crashes.
    }
  }

  try {
    await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [
      {
        identifier: ACTION_MARK_PRESENT,
        buttonTitle: '✓ Mark Present',
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_MARK_ABSENT,
        buttonTitle: '✕ Mark Absent',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
  } catch {
    // Ignore category setup failures in unsupported environments (e.g. Expo Go).
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleDailyReminder(
  enabled: boolean,
  time: string,
  subjectIds: string[]
): Promise<boolean> {
  try {
    await configureNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!enabled) {
      return true;
    }

    const granted = await requestNotificationPermissions();
    if (!granted) {
      return false;
    }

    const [hourStr, minuteStr] = time.split(':');
    const hour = Math.min(23, Math.max(0, Number(hourStr) || 20));
    const minute = Math.min(59, Math.max(0, Number(minuteStr) || 0));

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'AttendUp Daily Check-In',
        body: 'Tap below to mark today’s attendance in one tap.',
        categoryIdentifier: REMINDER_CATEGORY_ID,
        data: { subjectIds },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId:
          Platform.OS === 'android' && !isExpoGo() ? REMINDER_CHANNEL_ID : undefined,
      },
    });

    return true;
  } catch {
    return false;
  }
}

export async function sendTestReminderNotification(subjectIds: string[]): Promise<boolean> {
  try {
    await configureNotifications();
    const granted = await requestNotificationPermissions();
    if (!granted) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'AttendUp Test Reminder',
        body: 'Try tapping ✓ Mark Present or ✕ Mark Absent below.',
        categoryIdentifier: REMINDER_CATEGORY_ID,
        data: { subjectIds },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId:
          Platform.OS === 'android' && !isExpoGo() ? REMINDER_CHANNEL_ID : undefined,
      },
    });

    return true;
  } catch {
    return false;
  }
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<{ handled: boolean; status?: 'present' | 'absent'; count?: number }> {
  try {
    const action = response.actionIdentifier;
    if (action !== ACTION_MARK_PRESENT && action !== ACTION_MARK_ABSENT) {
      return { handled: false };
    }

    const status = action === ACTION_MARK_PRESENT ? 'present' : 'absent';
    const todayISO = formatDateISO(new Date());
    const settings = await getAppSettings();
    const subjects = await getAllSubjects();

    const dataSubjectIds = response.notification.request.content.data?.subjectIds;
    const preferredIds = Array.isArray(dataSubjectIds)
      ? dataSubjectIds.filter((id): id is string => typeof id === 'string')
      : settings.reminderSubjectIds;

    const targetSubjects =
      preferredIds.length > 0
        ? subjects.filter((s) => preferredIds.includes(s.id))
        : subjects;

    const listToUpdate = targetSubjects.length > 0 ? targetSubjects : subjects;
    await bulkSetSubjectsDayStatus(
      listToUpdate.map((s) => s.id),
      todayISO,
      status
    );
    await refreshAllWidgets();

    return { handled: true, status, count: listToUpdate.length };
  } catch {
    return { handled: false };
  }
}
