export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'holiday'
  | 'weekly_off'
  | 'leave'
  | null;

export type ShiftType = 'Morning' | 'Regular' | 'Evening' | 'Lab' | '';

export type WidgetStyle = 'heatmap' | 'calendar';

export interface Subject {
  id: string;
  name: string;
  targetPercentage: number;
  color: string;
  order: number;
  autoMarkSundays: boolean;
  scheduleDays: number[]; // JS weekday indices 0 (Sun) - 6 (Sat)
  createdAt: number;
}

export interface AttendanceRecord {
  subjectId: string;
  date: string; // YYYY-MM-DD (local timezone)
  status: AttendanceStatus;
  overtimeHours: number;
  classesCount?: number; // 1..4 lectures/labs logged on this day (default 1)
  shift: ShiftType;
  note: string;
  updatedAt: number;
}

export interface AppSettings {
  id: 'app';
  lockAttendance: boolean;
  preferNote: boolean;
  darkMode: boolean;
  reminderEnabled: boolean;
  reminderTime: string; // "HH:mm"
  reminderSubjectIds: string[];
  widgetSubjectId: string;
  widgetStyle: WidgetStyle;
  widgetMonth: string; // "YYYY-MM" or ''
  pinHash: string;
  lastBackupAt: number;
  semesterEndDate: string; // "YYYY-MM-DD" or ''
  lastUpdateCheckAt: number;
  dismissedVersion: string;
  notifiedUpdateVersion?: string;
}

export interface SafetySnapshot {
  id: string;
  createdAt: number;
  reason: string;
  subjects: Subject[];
  records: AttendanceRecord[];
  settings: AppSettings;
}

export type SortMode = 'order' | 'name' | 'pct_desc' | 'pct_asc';
