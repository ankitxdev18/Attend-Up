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

export type ThemeAccentId =
  | 'emerald'
  | 'sapphire'
  | 'violet'
  | 'crimson'
  | 'amber'
  | 'cyan';

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
  themeAccent: ThemeAccentId;
  semesterEndDate: string; // "YYYY-MM-DD" or ''
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
