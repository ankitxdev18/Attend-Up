import type {
  AppSettings,
  AttendanceRecord,
  AttendanceStatus,
  ShiftType,
  Subject,
  WidgetStyle,
} from '../types/attendance';
import { SUBJECT_COLORS } from '../theme/tokens';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const VALID_STATUSES: ReadonlySet<Exclude<AttendanceStatus, null>> = new Set([
  'present',
  'absent',
  'half_day',
  'holiday',
  'weekly_off',
  'leave',
]);

export const VALID_SHIFTS: ReadonlySet<ShiftType> = new Set([
  '',
  'Morning',
  'Regular',
  'Evening',
  'Lab',
]);

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024; // 5 MB

function stripControlChars(input: string, allowNewlines = false): string {
  // Strip C0/DEL control characters cleanly for safe offline storage and export.
  return allowNewlines
    ? input.replace(/\r\n/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    : input.replace(/[\u0000-\u001F\u007F]/g, '');
}

export function validateSubjectName(
  rawName: string,
  existingSubjects: Pick<Subject, 'id' | 'name'>[] = [],
  editingId?: string
): string {
  const trimmed = stripControlChars(String(rawName ?? '')).trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    throw new ValidationError('Subject name must be between 1 and 40 characters.');
  }
  const lower = trimmed.toLowerCase();
  const duplicate = existingSubjects.find(
    (s) =>
      s.id !== editingId &&
      stripControlChars(s.name).trim().toLowerCase() === lower
  );
  if (duplicate) {
    throw new ValidationError(`A subject named "${duplicate.name}" already exists.`);
  }
  return trimmed;
}

export function validateTargetPercentage(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new ValidationError('Target percentage must be between 1 and 100.');
  }
  return Math.min(100, Math.max(1, Math.round(num)));
}

export function validateDateISO(dateStr: string): string {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new ValidationError(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    throw new ValidationError(`Invalid calendar date "${dateStr}".`);
  }
  return dateStr;
}

export function validateOvertimeHours(hours: number): number {
  const num = Number(hours);
  if (!Number.isFinite(num)) {
    return 0;
  }
  const clamped = Math.min(24, Math.max(0, num));
  return Math.round(clamped * 10) / 10;
}

export function validateShift(shift: string): ShiftType {
  if (!VALID_SHIFTS.has(shift as ShiftType)) {
    throw new ValidationError(`Invalid shift "${shift}".`);
  }
  return shift as ShiftType;
}

export function validateNote(note: string): string {
  if (typeof note !== 'string') {
    throw new ValidationError('Note must be text.');
  }
  return stripControlChars(note, true).trim().slice(0, 300);
}

export function validateStatus(status: unknown): AttendanceStatus {
  if (status === null || status === undefined) return null;
  if (typeof status === 'string' && VALID_STATUSES.has(status as Exclude<AttendanceStatus, null>)) {
    return status as AttendanceStatus;
  }
  throw new ValidationError(`Invalid attendance status "${String(status)}".`);
}

export function validateReminderTime(time: string): string {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new ValidationError('Reminder time must be in 24-hour HH:MM format.');
  }
  return time;
}

export function validatePin(pin: string): string {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw new ValidationError('PIN must be exactly 4 digits.');
  }
  return pin;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively clones plain JSON data while removing prototype-pollution keys.
 */
export function stripPrototypePollution<T>(value: unknown): T {
  if (value === null || typeof value !== 'object') {
    return value as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripPrototypePollution(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    clean[key] = stripPrototypePollution((value as Record<string, unknown>)[key]);
  }
  return clean as T;
}

export interface ValidatedBackupPayload {
  subjects: Subject[];
  records: AttendanceRecord[];
  settings?: Partial<AppSettings>;
}

export function validateBackupPayload(raw: unknown): ValidatedBackupPayload {
  const cleaned = stripPrototypePollution<Record<string, unknown>>(raw);
  if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) {
    throw new ValidationError('Backup file must contain a JSON object.');
  }

  if (!Array.isArray(cleaned.subjects) || cleaned.subjects.length === 0) {
    throw new ValidationError('Backup file must contain at least one subject.');
  }
  if (!Array.isArray(cleaned.records)) {
    throw new ValidationError('Backup file is missing the records array.');
  }

  const seenNames = new Set<string>();
  const subjectIds = new Set<string>();
  const subjects: Subject[] = [];

  for (let i = 0; i < cleaned.subjects.length; i += 1) {
    const item = cleaned.subjects[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`Invalid subject entry at index ${i}.`);
    }
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : '';
    if (!id || id.length > 80) {
      throw new ValidationError(`Invalid subject id at index ${i}.`);
    }
    const name = validateSubjectName(String(item.name ?? ''));
    const lowerName = name.toLowerCase();
    if (seenNames.has(lowerName)) {
      throw new ValidationError(`Duplicate subject name "${name}" in backup.`);
    }
    seenNames.add(lowerName);
    subjectIds.add(id);

    const targetPercentage = validateTargetPercentage(Number(item.targetPercentage ?? 75));
    const color =
      typeof item.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(item.color)
        ? item.color
        : SUBJECT_COLORS[i % SUBJECT_COLORS.length];

    const scheduleDays = Array.isArray(item.scheduleDays)
      ? Array.from(
          new Set(
            item.scheduleDays
              .map(Number)
              .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
          )
        ).sort((a, b) => a - b)
      : [1, 2, 3, 4, 5];

    subjects.push({
      id,
      name,
      targetPercentage,
      color,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : i,
      autoMarkSundays: Boolean(item.autoMarkSundays ?? true),
      scheduleDays,
      createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now(),
    });
  }

  const records: AttendanceRecord[] = [];
  for (let i = 0; i < cleaned.records.length; i += 1) {
    const item = cleaned.records[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`Invalid record entry at index ${i}.`);
    }
    const subjectId = typeof item.subjectId === 'string' ? item.subjectId.trim() : '';
    if (!subjectIds.has(subjectId)) {
      continue; // Skip orphaned records referencing deleted subjects
    }
    const date = validateDateISO(String(item.date ?? ''));
    const status = validateStatus(item.status ?? null);
    const overtimeHours = validateOvertimeHours(Number(item.overtimeHours ?? 0));
    const shift = validateShift(String(item.shift ?? ''));
    const note = validateNote(String(item.note ?? ''));
    const updatedAt = Number.isFinite(Number(item.updatedAt))
      ? Number(item.updatedAt)
      : Date.now();

    records.push({
      subjectId,
      date,
      status,
      overtimeHours,
      shift,
      note,
      updatedAt,
    });
  }

  let settings: Partial<AppSettings> | undefined;
  if (cleaned.settings && typeof cleaned.settings === 'object' && !Array.isArray(cleaned.settings)) {
    const rawSettings = cleaned.settings as Record<string, unknown>;
    const widgetStyle: WidgetStyle =
      rawSettings.widgetStyle === 'calendar' ? 'calendar' : 'heatmap';
    const reminderSubjectIds = Array.isArray(rawSettings.reminderSubjectIds)
      ? rawSettings.reminderSubjectIds
          .filter((id): id is string => typeof id === 'string' && subjectIds.has(id))
      : [];

    settings = {
      lockAttendance: Boolean(rawSettings.lockAttendance),
      preferNote: Boolean(rawSettings.preferNote),
      darkMode: rawSettings.darkMode === undefined ? true : Boolean(rawSettings.darkMode),
      reminderEnabled: Boolean(rawSettings.reminderEnabled),
      reminderTime:
        typeof rawSettings.reminderTime === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(rawSettings.reminderTime)
          ? rawSettings.reminderTime
          : '20:00',
      reminderSubjectIds,
      widgetSubjectId:
        typeof rawSettings.widgetSubjectId === 'string' &&
        subjectIds.has(rawSettings.widgetSubjectId)
          ? rawSettings.widgetSubjectId
          : subjects[0].id,
      widgetStyle,
      widgetMonth:
        typeof rawSettings.widgetMonth === 'string' &&
        /^\d{4}-\d{2}$/.test(rawSettings.widgetMonth)
          ? rawSettings.widgetMonth
          : '',
      pinHash: typeof rawSettings.pinHash === 'string' ? rawSettings.pinHash : '',
      lastBackupAt:
        typeof rawSettings.lastBackupAt === 'number' && Number.isFinite(rawSettings.lastBackupAt)
          ? rawSettings.lastBackupAt
          : 0,
    };
  }

  return { subjects, records, settings };
}

/**
 * Escapes CSV cell content and guards against spreadsheet formula injection (=, +, -, @).
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const escaped = formulaSafe.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function escapeHtml(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
