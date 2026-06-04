/**
 * Custom voice-quote icons for the primary mic CTA.
 * All are designed to read at ~64px inside a lime circular button on ink,
 * and at 20px inside the bottom nav. currentColor is used for stroke/fill
 * so the parent decides ink vs lime.
 */
import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

/* 1 — Distinctive capsule mic. Bolder, squarer than the default lucide mic,
   with a soft inner notch and a confident stand. */
export function VoiceMic({ size = 24, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Capsule body */}
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" stroke="none" />
      {/* Inner notch — gives it a branded silhouette */}
      <line x1="12" y1="6.5" x2="12" y2="10.5" stroke="var(--ink)" strokeWidth={1.5} opacity="0.35" />
      {/* Cradle arc */}
      <path d="M5 11.5a7 7 0 0 0 14 0" />
      {/* Stand */}
      <line x1="12" y1="18.5" x2="12" y2="22" />
      <line x1="8.5" y1="22" x2="15.5" y2="22" />
    </svg>
  );
}

/* 2 — Mic + radiating sound waves on the right. Voice-first, dynamic. */
export function VoiceMicWave({ size = 24, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 28 24"
      width={size}
      height={size * (24 / 28)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Capsule mic, shifted left */}
      <rect x="6" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" stroke="none" />
      <path d="M2.5 11.5a7 7 0 0 0 14 0" />
      <line x1="9.5" y1="18.5" x2="9.5" y2="22" />
      <line x1="6" y1="22" x2="13" y2="22" />
      {/* Radiating waves */}
      <path d="M19 8.5a4.5 4.5 0 0 1 0 7" strokeWidth={2} />
      <path d="M22.5 5.5a8.5 8.5 0 0 1 0 13" strokeWidth={2} opacity="0.55" />
    </svg>
  );
}

/* 3 — Pure waveform: 5 vertical bars at varying heights, audio-app feel. */
export function VoiceWaveform({ size = 24, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      stroke="none"
      {...props}
    >
      {/* Centered around y=12. Each bar is 2.6 wide, fully rounded. */}
      <rect x="2.2"  y="9.5"  width="2.6" height="5"  rx="1.3" />
      <rect x="6.5"  y="6"    width="2.6" height="12" rx="1.3" />
      <rect x="10.7" y="2.5"  width="2.6" height="19" rx="1.3" />
      <rect x="14.9" y="6"    width="2.6" height="12" rx="1.3" />
      <rect x="19.2" y="9.5"  width="2.6" height="5"  rx="1.3" />
    </svg>
  );
}
