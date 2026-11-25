import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { AppSettings, AttendanceRecord, Subject } from '../types/attendance';
import {
  computeAttendanceStats,
  formatDateISO,
  formatMonthKey,
  formatMonthLabel,
  STATUS_META,
} from '../utils/attendance';
import { escapeCsvCell, escapeHtml, MAX_BACKUP_BYTES, ValidationError } from './validation';
import { restoreFromBackupJson } from '../db/database';

export type ReportScope = 'this_month' | 'all_months';

function filterRecordsByScope(
  records: AttendanceRecord[],
  subjectId: string | 'all',
  scope: ReportScope
): AttendanceRecord[] {
  const activeMonth = formatMonthKey();
  return records
    .filter((r) => (subjectId === 'all' ? true : r.subjectId === subjectId))
    .filter((r) => (scope === 'this_month' ? r.date.startsWith(activeMonth) : true))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function exportAttendancePdf(params: {
  subjects: Subject[];
  records: AttendanceRecord[];
  subjectId: string | 'all';
  scope: ReportScope;
}): Promise<void> {
  const { subjects, records, subjectId, scope } = params;
  const filteredRecords = filterRecordsByScope(records, subjectId, scope);
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const selectedSubject = subjectId === 'all' ? null : subjectMap.get(subjectId) ?? null;

  const scopeTitle =
    scope === 'this_month' ? formatMonthLabel(formatMonthKey()) : 'All Months';
  const subjectTitle = selectedSubject ? selectedSubject.name : 'All Subjects';

  const summarySubjects = selectedSubject ? [selectedSubject] : subjects;
  const summaryRowsHtml = summarySubjects
    .map((sub) => {
      const subRecords = filteredRecords.filter((r) => r.subjectId === sub.id);
      const st = computeAttendanceStats(subRecords, sub.targetPercentage);
      const badgeColor =
        st.percentage >= sub.targetPercentage || st.totalCounted === 0
          ? '#10B981'
          : '#F43F5E';
      return `
        <tr>
          <td>${escapeHtml(sub.name)}</td>
          <td class="num">${st.present}</td>
          <td class="num">${st.absent}</td>
          <td class="num">${st.halfDays}</td>
          <td class="num">${st.overtimeHours}h</td>
          <td class="num" style="color:${badgeColor};font-weight:700;">${st.percentage.toFixed(2)}%</td>
          <td>${escapeHtml(st.predictorLine)}</td>
        </tr>
      `;
    })
    .join('');

  const detailRowsHtml = filteredRecords
    .map((r) => {
      const subName = subjectMap.get(r.subjectId)?.name ?? r.subjectId;
      const meta = r.status ? STATUS_META[r.status] : null;
      return `
        <tr>
          <td class="num">${escapeHtml(r.date)}</td>
          <td>${escapeHtml(subName)}</td>
          <td style="color:${meta?.color ?? '#71717A'};font-weight:600;">${escapeHtml(meta?.label ?? 'Unmarked')}</td>
          <td class="num">${r.overtimeHours > 0 ? `${r.overtimeHours}h` : '—'}</td>
          <td>${escapeHtml(r.shift || '—')}</td>
          <td>${escapeHtml(r.note || '—')}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 28px; color: #09090B; }
          h1 { font-size: 22px; margin: 0 0 4px 0; }
          .meta { color: #52525B; font-size: 13px; margin-bottom: 20px; }
          h2 { font-size: 15px; margin: 22px 0 8px 0; color: #18181B; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #E4E4E7; padding: 8px 10px; text-align: left; }
          th { background-color: #F4F4F5; font-weight: 600; }
          .num { font-variant-numeric: tabular-nums; }
        </style>
      </head>
      <body>
        <h1>AttendUp Attendance Report</h1>
        <div class="meta">Scope: ${escapeHtml(subjectTitle)} · ${escapeHtml(scopeTitle)} · Generated ${escapeHtml(formatDateISO())}</div>

        <h2>Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Half Day</th>
              <th>OT Hrs</th>
              <th>Attendance %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRowsHtml || '<tr><td colspan="7">No subjects available.</td></tr>'}
          </tbody>
        </table>

        <h2>Detailed Logs (${filteredRecords.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Subject</th>
              <th>Status</th>
              <th>OT Hrs</th>
              <th>Shift</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${detailRowsHtml || '<tr><td colspan="6">No records found for this filter.</td></tr>'}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Attendance PDF Report',
    UTI: 'com.adobe.pdf',
  });
}

export async function exportAttendanceCsv(params: {
  subjects: Subject[];
  records: AttendanceRecord[];
  subjectId: string | 'all';
  scope: ReportScope;
}): Promise<void> {
  const { subjects, records, subjectId, scope } = params;
  const filteredRecords = filterRecordsByScope(records, subjectId, scope);
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const headers = ['Date', 'Subject', 'Status', 'OT Hours', 'Shift', 'Note'];
  const rows: string[] = [headers.map((h) => escapeCsvCell(h)).join(',')];

  for (const r of filteredRecords) {
    const subName = subjectMap.get(r.subjectId)?.name ?? r.subjectId;
    const statusLabel = r.status ? STATUS_META[r.status].label : 'Unmarked';
    rows.push(
      [
        escapeCsvCell(r.date),
        escapeCsvCell(subName),
        escapeCsvCell(statusLabel),
        escapeCsvCell(r.overtimeHours || 0),
        escapeCsvCell(r.shift || ''),
        escapeCsvCell(r.note || ''),
      ].join(',')
    );
  }

  // UTF-8 BOM ensures Excel opens unicode characters cleanly.
  const csvContent = `\uFEFF${rows.join('\r\n')}`;
  const fileName = `AttendUp-Report-${formatDateISO()}.csv`;
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(csvContent);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Share Attendance Spreadsheet (.csv)',
  });
}

export async function exportJsonBackup(params: {
  subjects: Subject[];
  records: AttendanceRecord[];
  settings: AppSettings;
}): Promise<void> {
  const payload = {
    app: 'AttendUp',
    version: 1,
    exportedAt: new Date().toISOString(),
    subjects: params.subjects,
    records: params.records,
    settings: params.settings,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = new File(Paths.cache, `AttendUp-Backup-${stamp}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(payload, null, 2));

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export AttendUp JSON Backup',
  });
}

export async function importJsonBackupFromPicker(): Promise<
  { canceled: true } | { canceled: false; subjectsCount: number; recordsCount: number }
> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return { canceled: true };
  }

  const asset = result.assets[0];
  if (typeof asset.size === 'number' && asset.size > MAX_BACKUP_BYTES) {
    throw new ValidationError('Backup file exceeds the 5 MB safety limit.');
  }

  const file = new File(asset.uri);
  if (typeof file.size === 'number' && file.size > MAX_BACKUP_BYTES) {
    throw new ValidationError('Backup file exceeds the 5 MB safety limit.');
  }

  const rawText = await file.text();
  if (rawText.length > MAX_BACKUP_BYTES) {
    throw new ValidationError('Backup file exceeds the 5 MB safety limit.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ValidationError('Selected file is not valid JSON.');
  }

  await restoreFromBackupJson(parsed);
  const obj = parsed as { subjects?: unknown[]; records?: unknown[] };
  return {
    canceled: false,
    subjectsCount: Array.isArray(obj.subjects) ? obj.subjects.length : 0,
    recordsCount: Array.isArray(obj.records) ? obj.records.length : 0,
  };
}
