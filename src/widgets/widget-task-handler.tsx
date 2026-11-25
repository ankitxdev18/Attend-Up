import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import {
  getAllRecords,
  getAllSubjects,
  getAppSettings,
  setSubjectDayStatus,
  updateAppSettings,
} from '../db/database';
import { formatDateISO, formatMonthKey, shiftMonthKey } from '../utils/attendance';
import { HeatmapWidget } from './HeatmapWidget';
import { CalendarWidget } from './CalendarWidget';

async function loadWidgetContext() {
  const [subjects, records, settings] = await Promise.all([
    getAllSubjects(),
    getAllRecords(),
    getAppSettings(),
  ]);
  const subject =
    subjects.find((s) => s.id === settings.widgetSubjectId) ?? subjects[0];
  return { subject, records, settings };
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, widgetAction } = props;

  if (widgetAction === 'WIDGET_DELETED') {
    return;
  }

  let { subject, records, settings } = await loadWidgetContext();

  if (widgetAction === 'WIDGET_CLICK') {
    if (props.clickAction === 'MARK_PRESENT_TODAY') {
      const targetSubjectId =
        (props.clickActionData?.subjectId as string | undefined) || subject?.id;
      if (targetSubjectId) {
        try {
          await setSubjectDayStatus(targetSubjectId, formatDateISO(new Date()), 'present');
        } catch {
          // Enforce lockAttendance & validation safely without crashing widget receiver.
        }
        ({ subject, records, settings } = await loadWidgetContext());
      }
    } else if (props.clickAction === 'PREV_MONTH' || props.clickAction === 'NEXT_MONTH') {
      const baseMonth =
        (props.clickActionData?.monthKey as string | undefined) ||
        settings.widgetMonth ||
        formatMonthKey();
      const delta = props.clickAction === 'PREV_MONTH' ? -1 : 1;
      const nextMonth = shiftMonthKey(baseMonth, delta);
      settings = await updateAppSettings({ widgetMonth: nextMonth });
    }
  }

  if (!subject) {
    return;
  }

  if (widgetInfo.widgetName === 'AttendUpCalendar') {
    props.renderWidget(
      <CalendarWidget
        subject={subject}
        records={records}
        monthKey={settings.widgetMonth || formatMonthKey()}
      />
    );
    return;
  }

  props.renderWidget(<HeatmapWidget subject={subject} records={records} />);
}
