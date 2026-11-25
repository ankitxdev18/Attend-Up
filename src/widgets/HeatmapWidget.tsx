import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { BRAND_LOGO_SVG } from '../components/BrandLogo';
import type { AttendanceRecord, Subject } from '../types/attendance';
import {
  computeAttendanceStats,
  computeStreak,
  getLast12WeeksGrid,
} from '../utils/attendance';

export interface HeatmapWidgetProps {
  subject: Subject;
  records: AttendanceRecord[];
}

function getHeatmapCellColor(status: string | null, isFuture: boolean): `#${string}` {
  if (isFuture) return '#14161A';
  switch (status) {
    case 'present':
      return '#10B981';
    case 'absent':
      return '#FB7185';
    case 'half_day':
      return '#FBBF24';
    default:
      return '#1E2026';
  }
}

export function HeatmapWidget({ subject, records }: HeatmapWidgetProps) {
  const subjectRecords = records.filter((r) => r.subjectId === subject.id);
  const stats = computeAttendanceStats(subjectRecords, subject.targetPercentage);
  const streak = computeStreak(subjectRecords, subject.autoMarkSundays);
  const columns = getLast12WeeksGrid(subjectRecords, subject.autoMarkSundays);

  const isOnTrack = stats.percentage >= subject.targetPercentage || stats.totalCounted === 0;
  const pctColor: `#${string}` = isOnTrack ? '#34D399' : '#FB7185';

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#101215',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Header */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <FlexWidget
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            flexGap: 6,
          }}
        >
          <SvgWidget
            svg={BRAND_LOGO_SVG}
            style={{ width: 16, height: 16 }}
          />
          <FlexWidget
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: (subject.color as `#${string}`) || '#10B981',
            }}
          />
          <TextWidget
            text={subject.name}
            maxLines={1}
            truncate="END"
            style={{
              color: '#FAFAFA',
              fontSize: 14,
              fontWeight: '700',
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
            style={{
              backgroundColor: '#18181B',
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <TextWidget
              text={`${streak}d streak`}
              style={{
                color: '#A1A1AA',
                fontSize: 10,
                fontWeight: '600',
              }}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              backgroundColor: '#18181B',
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: pctColor,
            }}
          >
            <TextWidget
              text={`${stats.percentage.toFixed(1)}%`}
              style={{
                color: pctColor,
                fontSize: 11,
                fontWeight: '700',
              }}
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
              style={{
                color: '#050608',
                fontSize: 16,
                fontWeight: '700',
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* 12 Weeks x 7 Days Heatmap Grid */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {columns.map((col, colIdx) => (
          <FlexWidget
            key={`col-${colIdx}`}
            style={{
              flexDirection: 'column',
              flexGap: 3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {col.map((cell) => (
              <FlexWidget
                key={cell.dateISO}
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  backgroundColor: getHeatmapCellColor(cell.status, cell.isFuture),
                  borderWidth: cell.isToday ? 1 : 0,
                  borderColor: cell.isToday ? '#FAFAFA' : '#27272A',
                }}
              />
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
