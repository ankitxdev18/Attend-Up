import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export interface BrandLogoProps {
  size?: number;
  showSquircle?: boolean;
}

const TRACK_RADIUS = 29;
const TRACK_CIRCUMFERENCE = 2 * Math.PI * TRACK_RADIUS;
const EMERALD_ARC_LENGTH = TRACK_CIRCUMFERENCE * 0.68;

export const BRAND_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="2" y="2" width="96" height="96" rx="24" ry="24" fill="#0B0C0E" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1.5" />
  <circle cx="50" cy="50" r="29" stroke="#22252A" stroke-width="6.2" fill="none" />
  <circle cx="50" cy="50" r="29" stroke="#10B981" stroke-width="6.2" stroke-linecap="round" stroke-dasharray="${EMERALD_ARC_LENGTH.toFixed(2)} ${TRACK_CIRCUMFERENCE.toFixed(2)}" transform="rotate(-90 50 50)" fill="none" />
  <path d="M 38.5 51.5 L 46.5 59.5 L 62.5 42.5" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>`;

/**
 * Crisp vector AttendUp brand mark:
 * obsidian squircle (#0B0C0E) with subtle border, #22252A track,
 * #10B981 68% emerald arc with rounded caps, and bold white checkmark.
 */
export function BrandLogo({ size = 36, showSquircle = true }: BrandLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {showSquircle && (
        <Rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="24"
          ry="24"
          fill="#0B0C0E"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="1.5"
        />
      )}

      {/* Dark circular track */}
      <Circle
        cx="50"
        cy="50"
        r={TRACK_RADIUS}
        stroke="#22252A"
        strokeWidth="6.2"
        fill="none"
      />

      {/* 68% Emerald progress arc */}
      <Circle
        cx="50"
        cy="50"
        r={TRACK_RADIUS}
        stroke="#10B981"
        strokeWidth="6.2"
        strokeLinecap="round"
        strokeDasharray={`${EMERALD_ARC_LENGTH.toFixed(2)} ${TRACK_CIRCUMFERENCE.toFixed(2)}`}
        transform="rotate(-90 50 50)"
        fill="none"
      />

      {/* Bold white rounded checkmark */}
      <Path
        d="M 38.5 51.5 L 46.5 59.5 L 62.5 42.5"
        stroke="#FFFFFF"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
