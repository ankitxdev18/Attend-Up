import type { AttendanceRecord, AttendanceStatus } from '../types/attendance';
import { SEMANTIC_COLORS } from '../theme/tokens';

export interface AttendanceStats {
  present: number;
  absent: number;
  halfDays: number;
  holiday: number;
  weeklyOff: number;
  leave: number;
  overtimeHours: number;
  totalCounted: number;
  attendedUnits: number;
  percentage: number;
  neededForTarget: number;
  safeToBunk: number;
  countsSummary: string;
  predictorLine: string;
}

export interface CalendarCell {
  dateISO: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSunday: boolean;
}

export interface MonthlyBreakdownRow {
  monthKey: string; // YYYY-MM
  label: string;
  stats: AttendanceStats;
}

export function formatDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function parseMonthKey(monthKey: string): { year: number; monthIndex: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  return {
    year: Number(match[1]),
    monthIndex: Math.min(11, Math.max(0, Number(match[2]) - 1)),
  };
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const shifted = new Date(year, monthIndex + delta, 1);
  return formatMonthKey(shifted);
}

export function formatMonthLabel(monthKey: string, shortMonth = false): string {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString('en-US', {
    month: shortMonth ? 'short' : 'long',
    year: 'numeric',
  });
}

export function parseDateISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isSundayISO(dateStr: string): boolean {
  return parseDateISO(dateStr).getDay() === 0;
}

export function formatDisplayDate(dateStr: string): string {
  return parseDateISO(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getEffectiveStatus(
  record: AttendanceRecord | undefined,
  dateStr: string,
  autoMarkSundays?: boolean
): { status: AttendanceStatus; isAutoSunday: boolean } {
  if (record?.status) {
    return { status: record.status, isAutoSunday: false };
  }
  if (autoMarkSundays && isSundayISO(dateStr)) {
    return { status: 'holiday', isAutoSunday: true };
  }
  return { status: null, isAutoSunday: false };
}

export function computeAttendanceStats(
  records: AttendanceRecord[],
  targetPercentage = 75
): AttendanceStats {
  let present = 0;
  let absent = 0;
  let halfDays = 0;
  let holiday = 0;
  let weeklyOff = 0;
  let leave = 0;
  let overtimeHours = 0;

  for (const r of records) {
    overtimeHours += r.overtimeHours || 0;
    switch (r.status) {
      case 'present':
        present += 1;
        break;
      case 'absent':
        absent += 1;
        break;
      case 'half_day':
        halfDays += 1;
        break;
      case 'holiday':
        holiday += 1;
        break;
      case 'weekly_off':
        weeklyOff += 1;
        break;
      case 'leave':
        leave += 1;
        break;
      default:
        break;
    }
  }

  const totalCounted = present + absent + halfDays;
  const attendedUnits = present + halfDays * 0.5;
  const percentage = totalCounted > 0 ? (attendedUnits / totalCounted) * 100 : 0;

  const target = Math.min(100, Math.max(1, targetPercentage));
  const targetRatio = target / 100;

  let neededForTarget = 0;
  let safeToBunk = 0;
  const countedWord = totalCounted === 1 ? 'class' : 'classes';
  const countsSummary = `${present}P · ${absent}A · ${totalCounted} ${countedWord}`;
  let predictorLine = 'No classes logged yet';

  if (totalCounted > 0) {
    if (percentage < target) {
      if (targetRatio >= 1) {
        predictorLine = 'Attend every class for 100%';
      } else {
        neededForTarget = Math.max(
          1,
          Math.ceil((targetRatio * totalCounted - attendedUnits) / (1 - targetRatio))
        );
        predictorLine = `Attend ${neededForTarget} more for ${target}%`;
      }
    } else {
      safeToBunk = Math.max(
        0,
        Math.floor((attendedUnits - targetRatio * totalCounted) / targetRatio)
      );
      if (safeToBunk > 0) {
        const clsWord = safeToBunk === 1 ? 'class' : 'classes';
        predictorLine = `Safe to bunk ${safeToBunk} ${clsWord}`;
      } else {
        predictorLine = `On track for ${target}%`;
      }
    }
  }

  return {
    present,
    absent,
    halfDays,
    holiday,
    weeklyOff,
    leave,
    overtimeHours,
    totalCounted,
    attendedUnits,
    percentage,
    neededForTarget,
    safeToBunk,
    countsSummary,
    predictorLine,
  };
}

export function getMonthGrid(monthKey: string): CalendarCell[] {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startOffset = firstDay.getDay(); // 0 = Sun
  const totalDays = lastDay.getDate();
  const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
  const todayISO = formatDateISO(new Date());

  const cells: CalendarCell[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(year, monthIndex, 1 - startOffset + i);
    const dateISO = formatDateISO(cellDate);
    cells.push({
      dateISO,
      dayNumber: cellDate.getDate(),
      inCurrentMonth: cellDate.getMonth() === monthIndex,
      isToday: dateISO === todayISO,
      isSunday: cellDate.getDay() === 0,
    });
  }
  return cells;
}

/**
 * Computes consecutive attended days (Present or Half Day) up to today.
 * Holidays, weekly offs, leaves, and auto-Sundays do not break the streak.
 */
export function computeStreak(
  records: AttendanceRecord[],
  autoMarkSundays: boolean
): number {
  const map = new Map<string, AttendanceRecord>();
  for (const r of records) {
    map.set(r.date, r);
  }

  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const dateISO = formatDateISO(cursor);
    const rec = map.get(dateISO);
    const { status } = getEffectiveStatus(rec, dateISO, autoMarkSundays);

    if (status === 'present' || status === 'half_day') {
      streak += 1;
    } else if (status === 'absent') {
      break;
    } else if (status === null) {
      // If today isn't marked yet, check yesterday before ending streak.
      if (i > 0) break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface HeatmapCell {
  dateISO: string;
  status: AttendanceStatus;
  isFuture: boolean;
  isToday: boolean;
}

/**
 * Generates a 12-column (weeks) x 7-row (Sun-Sat) grid ending with the current week.
 */
export function getLast12WeeksGrid(
  records: AttendanceRecord[],
  autoMarkSundays: boolean
): HeatmapCell[][] {
  const map = new Map<string, AttendanceRecord>();
  for (const r of records) {
    map.set(r.date, r);
  }

  const today = new Date();
  const todayISO = formatDateISO(today);
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay()); // Sunday of this week

  const gridStart = new Date(currentWeekStart);
  gridStart.setDate(currentWeekStart.getDate() - 11 * 7);

  const columns: HeatmapCell[][] = [];
  for (let w = 0; w < 12; w += 1) {
    const col: HeatmapCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + w * 7 + d);
      const dateISO = formatDateISO(cellDate);
      const { status } = getEffectiveStatus(map.get(dateISO), dateISO, autoMarkSundays);
      col.push({
        dateISO,
        status,
        isFuture: dateISO > todayISO,
        isToday: dateISO === todayISO,
      });
    }
    columns.push(col);
  }
  return columns;
}

export function computeMonthlyBreakdown(
  records: AttendanceRecord[],
  targetPercentage: number
): MonthlyBreakdownRow[] {
  const grouped = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const key = r.date.slice(0, 7);
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }

  return Array.from(grouped.keys())
    .sort((a, b) => b.localeCompare(a))
    .map((monthKey) => ({
      monthKey,
      label: formatMonthLabel(monthKey),
      stats: computeAttendanceStats(grouped.get(monthKey) ?? [], targetPercentage),
    }));
}

export function generateSubjectId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `sub-${Date.now().toString(36)}`;
}

export const STATUS_META: Record<
  Exclude<AttendanceStatus, null>,
  { label: string; short: string; color: string; tintBg: string }
> = {
  present: {
    label: 'Present',
    short: 'P',
    color: SEMANTIC_COLORS.present,
    tintBg: 'rgba(16, 185, 129, 0.16)',
  },
  absent: {
    label: 'Absent',
    short: 'A',
    color: SEMANTIC_COLORS.absent,
    tintBg: 'rgba(251, 113, 133, 0.16)',
  },
  half_day: {
    label: 'Half Day',
    short: 'HD',
    color: SEMANTIC_COLORS.halfDay,
    tintBg: 'rgba(251, 191, 36, 0.16)',
  },
  holiday: {
    label: 'Holiday',
    short: 'H',
    color: SEMANTIC_COLORS.holiday,
    tintBg: 'rgba(148, 163, 184, 0.14)',
  },
  weekly_off: {
    label: 'Weekly Off',
    short: 'WO',
    color: SEMANTIC_COLORS.holiday,
    tintBg: 'rgba(148, 163, 184, 0.14)',
  },
  leave: {
    label: 'Leave',
    short: 'L',
    color: SEMANTIC_COLORS.holiday,
    tintBg: 'rgba(148, 163, 184, 0.14)',
  },
};
