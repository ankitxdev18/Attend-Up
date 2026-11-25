import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type {
  AppSettings,
  AttendanceRecord,
  AttendanceStatus,
  SafetySnapshot,
  ShiftType,
  Subject,
  WidgetStyle,
} from '../types/attendance';
import { SUBJECT_COLORS } from '../theme/tokens';
import { formatDateISO, generateSubjectId } from '../utils/attendance';
import {
  validateBackupPayload,
  validateDateISO,
  validateNote,
  validateOvertimeHours,
  validatePin,
  validateReminderTime,
  validateShift,
  validateStatus,
  validateSubjectName,
  validateTargetPercentage,
} from '../lib/validation';

export class AttendanceLockedError extends Error {
  constructor(message = 'Attendance Lock is enabled. Only today can be edited.') {
    super(message);
    this.name = 'AttendanceLockedError';
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  lockAttendance: false,
  preferNote: false,
  darkMode: true,
  reminderEnabled: false,
  reminderTime: '20:00',
  reminderSubjectIds: [],
  widgetSubjectId: 'semester-3',
  widgetStyle: 'heatmap',
  widgetMonth: '',
  pinHash: '',
  lastBackupAt: 0,
};

const MAX_SAFETY_SNAPSHOTS = 15;

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('attendup.db');
  }
  return dbInstance;
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Initializes SQLite tables, applies lightweight column migrations,
 * and seeds default Semester-3 subject + app settings on first launch.
 */
export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = getDb();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        targetPercentage INTEGER NOT NULL DEFAULT 75,
        color TEXT NOT NULL DEFAULT '#10B981',
        sortOrder INTEGER NOT NULL DEFAULT 0,
        autoMarkSundays INTEGER NOT NULL DEFAULT 1,
        scheduleDays TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS records (
        subjectId TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT,
        overtimeHours REAL NOT NULL DEFAULT 0,
        shift TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (subjectId, date)
      );
      CREATE INDEX IF NOT EXISTS idx_records_subject ON records(subjectId);
      CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY NOT NULL,
        lockAttendance INTEGER NOT NULL DEFAULT 0,
        preferNote INTEGER NOT NULL DEFAULT 0,
        darkMode INTEGER NOT NULL DEFAULT 1,
        reminderEnabled INTEGER NOT NULL DEFAULT 0,
        reminderTime TEXT NOT NULL DEFAULT '20:00',
        reminderSubjectIds TEXT NOT NULL DEFAULT '[]',
        widgetSubjectId TEXT NOT NULL DEFAULT 'semester-3',
        widgetStyle TEXT NOT NULL DEFAULT 'heatmap',
        widgetMonth TEXT NOT NULL DEFAULT '',
        pinHash TEXT NOT NULL DEFAULT '',
        lastBackupAt INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        createdAt INTEGER NOT NULL,
        reason TEXT NOT NULL,
        payloadJson TEXT NOT NULL
      );
    `);

    // Migrate existing settings table columns safely if upgrading from an older schema.
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(settings)');
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has('reminderSubjectIds')) {
      await db.execAsync(
        `ALTER TABLE settings ADD COLUMN reminderSubjectIds TEXT NOT NULL DEFAULT '[]';`
      );
    }
    if (!colNames.has('widgetStyle')) {
      await db.execAsync(
        `ALTER TABLE settings ADD COLUMN widgetStyle TEXT NOT NULL DEFAULT 'heatmap';`
      );
    }
    if (!colNames.has('widgetMonth')) {
      await db.execAsync(
        `ALTER TABLE settings ADD COLUMN widgetMonth TEXT NOT NULL DEFAULT '';`
      );
    }
    if (!colNames.has('lastBackupAt')) {
      await db.execAsync(
        `ALTER TABLE settings ADD COLUMN lastBackupAt INTEGER NOT NULL DEFAULT 0;`
      );
    }

    const subCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(subjects)');
    const subColNames = new Set(subCols.map((c) => c.name));
    if (!subColNames.has('scheduleDays')) {
      await db.execAsync(
        `ALTER TABLE subjects ADD COLUMN scheduleDays TEXT NOT NULL DEFAULT '[1,2,3,4,5]';`
      );
    }

    const countRow = await db.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM subjects'
    );
    if ((countRow?.cnt ?? 0) === 0) {
      await db.runAsync(
        `INSERT INTO subjects (id, name, targetPercentage, color, sortOrder, autoMarkSundays, scheduleDays, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['semester-3', 'Semester-3', 75, SUBJECT_COLORS[0], 0, 1, '[1,2,3,4,5]', Date.now()]
      );
    }

    const settingsRow = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM settings WHERE id = ?',
      ['app']
    );
    if (!settingsRow) {
      await db.runAsync(
        `INSERT INTO settings (
          id, lockAttendance, preferNote, darkMode, reminderEnabled, reminderTime,
          reminderSubjectIds, widgetSubjectId, widgetStyle, widgetMonth, pinHash, lastBackupAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'app',
          DEFAULT_SETTINGS.lockAttendance ? 1 : 0,
          DEFAULT_SETTINGS.preferNote ? 1 : 0,
          DEFAULT_SETTINGS.darkMode ? 1 : 0,
          DEFAULT_SETTINGS.reminderEnabled ? 1 : 0,
          DEFAULT_SETTINGS.reminderTime,
          JSON.stringify(DEFAULT_SETTINGS.reminderSubjectIds),
          DEFAULT_SETTINGS.widgetSubjectId,
          DEFAULT_SETTINGS.widgetStyle,
          DEFAULT_SETTINGS.widgetMonth,
          DEFAULT_SETTINGS.pinHash,
          DEFAULT_SETTINGS.lastBackupAt,
        ]
      );
    }
  })();
  return initPromise;
}

function parseScheduleDays(raw: string | null | undefined): number[] {
  if (!raw) return [1, 2, 3, 4, 5];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [1, 2, 3, 4, 5];
    return Array.from(
      new Set(parsed.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
    ).sort((a, b) => a - b);
  } catch {
    return [1, 2, 3, 4, 5];
  }
}

export async function getAllSubjects(): Promise<Subject[]> {
  await initDatabase();
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    targetPercentage: number;
    color: string;
    sortOrder: number;
    autoMarkSundays: number;
    scheduleDays: string;
    createdAt: number;
  }>('SELECT * FROM subjects ORDER BY sortOrder ASC, createdAt ASC');

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    targetPercentage: r.targetPercentage,
    color: r.color,
    order: r.sortOrder,
    autoMarkSundays: Boolean(r.autoMarkSundays),
    scheduleDays: parseScheduleDays(r.scheduleDays),
    createdAt: r.createdAt,
  }));
}

export async function getAllRecords(): Promise<AttendanceRecord[]> {
  await initDatabase();
  const db = getDb();
  const rows = await db.getAllAsync<{
    subjectId: string;
    date: string;
    status: string | null;
    overtimeHours: number;
    shift: string;
    note: string;
    updatedAt: number;
  }>('SELECT * FROM records');

  return rows.map((r) => ({
    subjectId: r.subjectId,
    date: r.date,
    status: (r.status as AttendanceStatus) ?? null,
    overtimeHours: r.overtimeHours ?? 0,
    shift: (r.shift as ShiftType) ?? '',
    note: r.note ?? '',
    updatedAt: r.updatedAt,
  }));
}

export async function getAppSettings(): Promise<AppSettings> {
  await initDatabase();
  const db = getDb();
  const row = await db.getFirstAsync<{
    id: string;
    lockAttendance: number;
    preferNote: number;
    darkMode: number;
    reminderEnabled: number;
    reminderTime: string;
    reminderSubjectIds: string;
    widgetSubjectId: string;
    widgetStyle: string;
    widgetMonth: string;
    pinHash: string;
    lastBackupAt: number;
  }>('SELECT * FROM settings WHERE id = ?', ['app']);

  if (!row) return DEFAULT_SETTINGS;
  return {
    id: 'app',
    lockAttendance: Boolean(row.lockAttendance),
    preferNote: Boolean(row.preferNote),
    darkMode: Boolean(row.darkMode),
    reminderEnabled: Boolean(row.reminderEnabled),
    reminderTime: row.reminderTime || '20:00',
    reminderSubjectIds: parseJsonStringArray(row.reminderSubjectIds),
    widgetSubjectId: row.widgetSubjectId || 'semester-3',
    widgetStyle: (row.widgetStyle === 'calendar' ? 'calendar' : 'heatmap') as WidgetStyle,
    widgetMonth: row.widgetMonth || '',
    pinHash: row.pinHash || '',
    lastBackupAt: Number(row.lastBackupAt) || 0,
  };
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
    id: 'app',
    reminderTime:
      patch.reminderTime !== undefined
        ? validateReminderTime(patch.reminderTime)
        : current.reminderTime,
  };
  const db = getDb();
  await db.runAsync(
    `UPDATE settings
     SET lockAttendance = ?, preferNote = ?, darkMode = ?, reminderEnabled = ?,
         reminderTime = ?, reminderSubjectIds = ?, widgetSubjectId = ?,
         widgetStyle = ?, widgetMonth = ?, pinHash = ?, lastBackupAt = ?
     WHERE id = 'app'`,
    [
      next.lockAttendance ? 1 : 0,
      next.preferNote ? 1 : 0,
      next.darkMode ? 1 : 0,
      next.reminderEnabled ? 1 : 0,
      next.reminderTime,
      JSON.stringify(next.reminderSubjectIds ?? []),
      next.widgetSubjectId,
      next.widgetStyle,
      next.widgetMonth ?? '',
      next.pinHash,
      Number(next.lastBackupAt) || 0,
    ]
  );
  return next;
}

export async function saveSubject(input: {
  id?: string;
  name: string;
  targetPercentage: number;
  color: string;
  autoMarkSundays: boolean;
  scheduleDays?: number[];
}): Promise<Subject> {
  await initDatabase();
  const db = getDb();
  const existing = await getAllSubjects();
  const cleanName = validateSubjectName(input.name, existing, input.id);
  const cleanTarget = validateTargetPercentage(input.targetPercentage);
  const cleanSchedule = Array.isArray(input.scheduleDays)
    ? Array.from(
        new Set(
          input.scheduleDays
            .map(Number)
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        )
      ).sort((a, b) => a - b)
    : undefined;

  if (input.id) {
    const prev = existing.find((s) => s.id === input.id);
    const nextSchedule = cleanSchedule ?? prev?.scheduleDays ?? [1, 2, 3, 4, 5];
    await db.runAsync(
      `UPDATE subjects SET name = ?, targetPercentage = ?, color = ?, autoMarkSundays = ?, scheduleDays = ? WHERE id = ?`,
      [
        cleanName,
        cleanTarget,
        input.color,
        input.autoMarkSundays ? 1 : 0,
        JSON.stringify(nextSchedule),
        input.id,
      ]
    );
    const all = await getAllSubjects();
    return all.find((s) => s.id === input.id) ?? all[0];
  }

  const maxOrder = existing.reduce((max, s) => Math.max(max, s.order), -1);
  const newSubject: Subject = {
    id: generateSubjectId(cleanName),
    name: cleanName,
    targetPercentage: cleanTarget,
    color: input.color,
    order: maxOrder + 1,
    autoMarkSundays: input.autoMarkSundays,
    scheduleDays: cleanSchedule ?? [1, 2, 3, 4, 5],
    createdAt: Date.now(),
  };

  await db.runAsync(
    `INSERT INTO subjects (id, name, targetPercentage, color, sortOrder, autoMarkSundays, scheduleDays, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newSubject.id,
      newSubject.name,
      newSubject.targetPercentage,
      newSubject.color,
      newSubject.order,
      newSubject.autoMarkSundays ? 1 : 0,
      JSON.stringify(newSubject.scheduleDays),
      newSubject.createdAt,
    ]
  );
  return newSubject;
}

export async function reorderSubject(
  subjectId: string,
  direction: 'up' | 'down'
): Promise<Subject[]> {
  await initDatabase();
  const db = getDb();
  const subjects = await getAllSubjects();
  const idx = subjects.findIndex((s) => s.id === subjectId);
  if (idx === -1) return subjects;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= subjects.length) return subjects;

  const reordered = [...subjects];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(swapIdx, 0, moved);

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < reordered.length; i += 1) {
      await db.runAsync('UPDATE subjects SET sortOrder = ? WHERE id = ?', [i, reordered[i].id]);
    }
  });

  return getAllSubjects();
}

export async function deleteSubjectById(subjectId: string): Promise<void> {
  await initDatabase();
  const db = getDb();
  await createSafetySnapshot('Before deleting subject');
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM records WHERE subjectId = ?', [subjectId]);
    await db.runAsync('DELETE FROM subjects WHERE id = ?', [subjectId]);
  });
}

async function assertAttendanceUnlockedForDate(date: string): Promise<void> {
  const settings = await getAppSettings();
  if (settings.lockAttendance && date !== formatDateISO(new Date())) {
    throw new AttendanceLockedError();
  }
}

export async function setSubjectDayStatus(
  subjectId: string,
  date: string,
  status: AttendanceStatus
): Promise<void> {
  await initDatabase();
  const validDate = validateDateISO(date);
  const validStatus = validateStatus(status);
  await assertAttendanceUnlockedForDate(validDate);

  const db = getDb();
  const existing = await db.getFirstAsync<{
    overtimeHours: number;
    shift: string;
    note: string;
  }>('SELECT overtimeHours, shift, note FROM records WHERE subjectId = ? AND date = ?', [
    subjectId,
    validDate,
  ]);

  const overtimeHours = existing?.overtimeHours ?? 0;
  const shift = existing?.shift ?? '';
  const note = existing?.note ?? '';

  if (validStatus === null && overtimeHours <= 0 && !shift && !note.trim()) {
    await db.runAsync('DELETE FROM records WHERE subjectId = ? AND date = ?', [
      subjectId,
      validDate,
    ]);
    return;
  }

  await db.runAsync(
    `INSERT INTO records (subjectId, date, status, overtimeHours, shift, note, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(subjectId, date) DO UPDATE SET
       status = excluded.status,
       overtimeHours = excluded.overtimeHours,
       shift = excluded.shift,
       note = excluded.note,
       updatedAt = excluded.updatedAt`,
    [subjectId, validDate, validStatus, overtimeHours, shift, note, Date.now()]
  );
}

export async function upsertAttendanceRecord(
  record: Omit<AttendanceRecord, 'updatedAt'>
): Promise<void> {
  await initDatabase();
  const validDate = validateDateISO(record.date);
  const validStatus = validateStatus(record.status);
  const validOt = validateOvertimeHours(record.overtimeHours || 0);
  const validShift = validateShift(record.shift || '');
  const validNote = validateNote(record.note || '');

  await assertAttendanceUnlockedForDate(validDate);

  const db = getDb();
  const isEmpty =
    validStatus === null && validOt <= 0 && !validShift && !validNote.trim();

  if (isEmpty) {
    await db.runAsync('DELETE FROM records WHERE subjectId = ? AND date = ?', [
      record.subjectId,
      validDate,
    ]);
    return;
  }

  await db.runAsync(
    `INSERT INTO records (subjectId, date, status, overtimeHours, shift, note, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(subjectId, date) DO UPDATE SET
       status = excluded.status,
       overtimeHours = excluded.overtimeHours,
       shift = excluded.shift,
       note = excluded.note,
       updatedAt = excluded.updatedAt`,
    [
      record.subjectId,
      validDate,
      validStatus,
      validOt,
      validShift,
      validNote,
      Date.now(),
    ]
  );
}

export async function createSafetySnapshot(reason: string): Promise<SafetySnapshot> {
  await initDatabase();
  const db = getDb();
  const [subjects, records, settings] = await Promise.all([
    getAllSubjects(),
    getAllRecords(),
    getAppSettings(),
  ]);

  const snapshot: SafetySnapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    reason,
    subjects,
    records,
    settings,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO snapshots (id, createdAt, reason, payloadJson) VALUES (?, ?, ?, ?)`,
      [
        snapshot.id,
        snapshot.createdAt,
        snapshot.reason,
        JSON.stringify({ subjects, records, settings }),
      ]
    );

    // Prune older snapshots atomically so at most MAX_SAFETY_SNAPSHOTS remain.
    await db.runAsync(
      `DELETE FROM snapshots WHERE id NOT IN (
         SELECT id FROM snapshots ORDER BY createdAt DESC LIMIT ?
       )`,
      [MAX_SAFETY_SNAPSHOTS]
    );
  });

  return snapshot;
}

async function applyValidatedStateInTransaction(payload: {
  subjects: Subject[];
  records: AttendanceRecord[];
  settings?: Partial<AppSettings>;
}): Promise<void> {
  const db = getDb();
  const currentSettings = await getAppSettings();
  const mergedSettings: AppSettings = {
    ...currentSettings,
    ...(payload.settings ?? {}),
    id: 'app',
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM subjects');
    await db.runAsync('DELETE FROM records');

    for (const s of payload.subjects) {
      await db.runAsync(
        `INSERT INTO subjects (id, name, targetPercentage, color, sortOrder, autoMarkSundays, scheduleDays, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.name,
          s.targetPercentage,
          s.color,
          s.order,
          s.autoMarkSundays ? 1 : 0,
          JSON.stringify(s.scheduleDays ?? [1, 2, 3, 4, 5]),
          s.createdAt,
        ]
      );
    }

    for (const r of payload.records) {
      await db.runAsync(
        `INSERT INTO records (subjectId, date, status, overtimeHours, shift, note, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          r.subjectId,
          r.date,
          r.status,
          r.overtimeHours,
          r.shift,
          r.note,
          r.updatedAt,
        ]
      );
    }

    await db.runAsync(
      `UPDATE settings
       SET lockAttendance = ?, preferNote = ?, darkMode = ?, reminderEnabled = ?,
           reminderTime = ?, reminderSubjectIds = ?, widgetSubjectId = ?,
           widgetStyle = ?, widgetMonth = ?, pinHash = ?, lastBackupAt = ?
       WHERE id = 'app'`,
      [
        mergedSettings.lockAttendance ? 1 : 0,
        mergedSettings.preferNote ? 1 : 0,
        mergedSettings.darkMode ? 1 : 0,
        mergedSettings.reminderEnabled ? 1 : 0,
        mergedSettings.reminderTime,
        JSON.stringify(mergedSettings.reminderSubjectIds ?? []),
        mergedSettings.widgetSubjectId,
        mergedSettings.widgetStyle,
        mergedSettings.widgetMonth ?? '',
        mergedSettings.pinHash || '',
        Number(mergedSettings.lastBackupAt) || 0,
      ]
    );
  });
}

export async function restoreSafetySnapshot(snapshotId: string): Promise<boolean> {
  await initDatabase();
  const db = getDb();
  const row = await db.getFirstAsync<{ payloadJson: string }>(
    'SELECT payloadJson FROM snapshots WHERE id = ?',
    [snapshotId]
  );
  if (!row) return false;

  const parsed = JSON.parse(row.payloadJson) as unknown;
  const validated = validateBackupPayload(parsed);
  await applyValidatedStateInTransaction(validated);
  return true;
}

export async function restoreFromBackupJson(rawPayload: unknown): Promise<void> {
  await initDatabase();
  const validated = validateBackupPayload(rawPayload);
  await createSafetySnapshot('Before backup restore');
  await applyValidatedStateInTransaction(validated);
}

export async function getAllSnapshots(): Promise<SafetySnapshot[]> {
  await initDatabase();
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string;
    createdAt: number;
    reason: string;
    payloadJson: string;
  }>('SELECT * FROM snapshots ORDER BY createdAt DESC');

  return rows.map((r) => {
    const parsed = JSON.parse(r.payloadJson) as {
      subjects: Subject[];
      records: AttendanceRecord[];
      settings: AppSettings;
    };
    return {
      id: r.id,
      createdAt: r.createdAt,
      reason: r.reason,
      subjects: parsed.subjects ?? [],
      records: parsed.records ?? [],
      settings: parsed.settings ?? DEFAULT_SETTINGS,
    };
  });
}

async function upsertDayStatusesInTransaction(
  subjectIds: string[],
  dates: string[],
  status: AttendanceStatus
): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const subjectId of subjectIds) {
      for (const date of dates) {
        const existing = await db.getFirstAsync<{
          overtimeHours: number;
          shift: string;
          note: string;
        }>('SELECT overtimeHours, shift, note FROM records WHERE subjectId = ? AND date = ?', [
          subjectId,
          date,
        ]);

        const overtimeHours = existing?.overtimeHours ?? 0;
        const shift = existing?.shift ?? '';
        const note = existing?.note ?? '';

        if (status === null && overtimeHours <= 0 && !shift && !note.trim()) {
          await db.runAsync('DELETE FROM records WHERE subjectId = ? AND date = ?', [
            subjectId,
            date,
          ]);
          continue;
        }

        await db.runAsync(
          `INSERT INTO records (subjectId, date, status, overtimeHours, shift, note, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(subjectId, date) DO UPDATE SET
             status = excluded.status,
             overtimeHours = excluded.overtimeHours,
             shift = excluded.shift,
             note = excluded.note,
             updatedAt = excluded.updatedAt`,
          [subjectId, date, status, overtimeHours, shift, note, now]
        );
      }
    }
  });
}

export async function bulkSetAllStatusForDate(
  date: string,
  status: Exclude<AttendanceStatus, null>,
  reason: string
): Promise<SafetySnapshot> {
  await initDatabase();
  const validDate = validateDateISO(date);
  const validStatus = validateStatus(status);
  if (!validStatus) {
    throw new Error('Status is required for bulk update.');
  }
  await assertAttendanceUnlockedForDate(validDate);
  const snapshot = await createSafetySnapshot(reason);
  const subjects = await getAllSubjects();
  await upsertDayStatusesInTransaction(
    subjects.map((s) => s.id),
    [validDate],
    validStatus
  );
  return snapshot;
}

export async function bulkSetSubjectsDayStatus(
  subjectIds: string[],
  date: string,
  status: AttendanceStatus
): Promise<void> {
  await initDatabase();
  const validDate = validateDateISO(date);
  const validStatus = validateStatus(status);
  await assertAttendanceUnlockedForDate(validDate);
  if (subjectIds.length === 0) return;
  await upsertDayStatusesInTransaction(subjectIds, [validDate], validStatus);
}

export async function bulkSetSubjectDatesStatus(
  subjectId: string,
  dates: string[],
  status: Exclude<AttendanceStatus, null>,
  reason: string
): Promise<SafetySnapshot> {
  await initDatabase();
  const validStatus = validateStatus(status);
  if (!validStatus) {
    throw new Error('Status is required for bulk update.');
  }
  const uniqueDates = Array.from(new Set(dates)).map((d) => validateDateISO(d));
  for (const d of uniqueDates) {
    await assertAttendanceUnlockedForDate(d);
  }

  const snapshot = await createSafetySnapshot(reason);
  await upsertDayStatusesInTransaction([subjectId], uniqueDates, validStatus);
  return snapshot;
}

/**
 * Hashes a 4-digit PIN with a cryptographic random 16-byte hex salt using SHA-256.
 * Stored format: `<saltHex>$<sha256Hex>`
 */
export async function hashPin(pin: string): Promise<string> {
  const validPin = validatePin(pin);
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const saltHex = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${saltHex}:${validPin}`
  );
  return `${saltHex}$${digest}`;
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.includes('$')) return false;
  if (!/^\d{4}$/.test(pin)) return false;
  const [saltHex, expectedDigest] = storedHash.split('$');
  if (!saltHex || !expectedDigest) return false;
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${saltHex}:${pin}`
  );
  return digest === expectedDigest;
}
