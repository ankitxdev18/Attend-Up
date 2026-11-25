import React from 'react';
import { getAllRecords, getAllSubjects, getAppSettings } from '../db/database';
import { isNativeWidgetSupported } from '../lib/nativeWidgetSupport';
import { formatMonthKey } from '../utils/attendance';

/**
 * Pushes updated SQLite attendance data to any active Android Home Screen widgets.
 * Safely no-ops on non-Android platforms, Expo Go, or if widgets are not pinned.
 */
export async function refreshAllWidgets(): Promise<void> {
  if (!isNativeWidgetSupported()) return;

  try {
    // Lazy-require so Expo Go never evaluates native widget TurboModules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { HeatmapWidget } = require('./HeatmapWidget') as typeof import('./HeatmapWidget');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CalendarWidget } = require('./CalendarWidget') as typeof import('./CalendarWidget');

    const [subjects, records, settings] = await Promise.all([
      getAllSubjects(),
      getAllRecords(),
      getAppSettings(),
    ]);

    const subject =
      subjects.find((s) => s.id === settings.widgetSubjectId) ?? subjects[0];
    if (!subject) return;

    await Promise.all([
      requestWidgetUpdate({
        widgetName: 'AttendUpHeatmap',
        renderWidget: () =>
          React.createElement(HeatmapWidget, { subject, records }),
        widgetNotFound: () => {},
      }),
      requestWidgetUpdate({
        widgetName: 'AttendUpCalendar',
        renderWidget: () =>
          React.createElement(CalendarWidget, {
            subject,
            records,
            monthKey: settings.widgetMonth || formatMonthKey(),
          }),
        widgetNotFound: () => {},
      }),
    ]);
  } catch {
    // Ignore errors when native widget receiver is unavailable.
  }
}
