import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { AttendanceRecord, AttendanceStatus, Subject } from '../types/attendance';
import {
  formatMonthKey,
  formatMonthLabel,
  getEffectiveStatus,
  getMonthGrid,
} from '../utils/attendance';

export interface CalendarWidgetProps {
  subject: Subject;
  records: AttendanceRecord[];
  monthKey?: string;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getPillMeta(status: AttendanceStatus): { label: string; color: `#${string}` } | null {
  switch (status) {
    case 'present':
      return { label: 'P', color: '#10B981' };
    case 'absent':
      return { label: 'A', color: '#FB7185' };
    case 'half_day':
      return { label: 'HD', color: '#FBBF24' };
    case 'holiday':
      return { label: 'H', color: '#94A3B8' };
    case 'weekly_off':
      return { label: 'WO', color: '#94A3B8' };
    case 'leave':
      return { label: 'L', color: '#94A3B8' };
    default:
      return null;
  }
}

export function CalendarWidget({ subject, records, monthKey }: CalendarWidgetProps) {
  const activeMonth = monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : formatMonthKey();
  const monthLabel = formatMonthLabel(activeMonth);

  const recordMap = new Map<string, AttendanceRecord>();
  for (const r of records) {
    if (r.subjectId === subject.id) {
      recordMap.set(r.date, r);
    }
  }

  const cells = getMonthGrid(activeMonth);
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#101215',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Header */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget
            text={monthLabel}
            maxLines={1}
            style={{
              color: '#FAFAFA',
              fontSize: 13,
              fontWeight: '700',
            }}
          />
          <TextWidget
            text={subject.name}
            maxLines={1}
            truncate="END"
            style={{
              color: '#A1A1AA',
              fontSize: 10,
              fontWeight: '500',
            }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexGap: 6,
          }}
        >
          <FlexWidget
            clickAction="PREV_MONTH"
            clickActionData={{ monthKey: activeMonth }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              backgroundColor: '#18181B',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text="<"
              style={{ color: '#FAFAFA', fontSize: 13, fontWeight: '700' }}
            />
          </FlexWidget>

          <FlexWidget
            clickAction="NEXT_MONTH"
            clickActionData={{ monthKey: activeMonth }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              backgroundColor: '#18181B',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text=">"
              style={{ color: '#FAFAFA', fontSize: 13, fontWeight: '700' }}
            />
          </FlexWidget>

          <FlexWidget
            clickAction="MARK_PRESENT_TODAY"
            clickActionData={{ subjectId: subject.id }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              backgroundColor: '#10B981',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text="+"
              style={{ color: '#050608', fontSize: 16, fontWeight: '700' }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* Weekday Labels */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        {WEEKDAYS.map((day, idx) => (
          <FlexWidget
            key={`wd-${idx}`}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text={day}
              style={{
                color: idx === 0 ? '#A1A1AA' : '#71717A',
                fontSize: 10,
                fontWeight: '700',
              }}
            />
          </FlexWidget>
        ))}
      </FlexWidget>

      {/* Month Rows */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {weeks.map((week, wIdx) => (
          <FlexWidget
            key={`wk-${wIdx}`}
            style={{
              width: 'match_parent',
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {week.map((cell) => {
              const rec = recordMap.get(cell.dateISO);
              const { status } = getEffectiveStatus(rec, cell.dateISO, subject.autoMarkSundays);
              const pill = cell.inCurrentMonth ? getPillMeta(status) : null;

              return (
                <FlexWidget
                  key={cell.dateISO}
                  style={{
                    flex: 1,
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 1,
                  }}
                >
                  <FlexWidget
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: cell.isToday ? '#10B981' : '#101215',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TextWidget
                      text={String(cell.dayNumber)}
                      style={{
                        color: cell.isToday
                          ? '#050608'
                          : cell.inCurrentMonth
                            ? '#FAFAFA'
                            : '#3F3F46',
                        fontSize: 10,
                        fontWeight: cell.isToday ? '700' : '500',
                      }}
                    />
                  </FlexWidget>

                  {pill ? (
                    <FlexWidget
                      style={{
                        marginTop: 1,
                        paddingHorizontal: 4,
                        borderRadius: 4,
                        backgroundColor: pill.color,
                      }}
                    >
                      <TextWidget
                        text={pill.label}
                        style={{
                          color: '#09090B',
                          fontSize: 7,
                          fontWeight: '700',
                        }}
                      />
                    </FlexWidget>
                  ) : (
                    <FlexWidget style={{ height: 9 }} />
                  )}
                </FlexWidget>
              );
            })}
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
