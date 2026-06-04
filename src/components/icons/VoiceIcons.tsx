/**
 * Voice-quote icon — waveform motif.
 * Reads cleanly at small nav sizes (18–20px) and scales up to the
 * hero lime CTA. Uses currentColor so the parent decides ink vs lime.
 */
import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

/* Pure waveform: 5 vertical bars at varying heights, audio-app feel. */
export function VoiceWaveform({ size = 24, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      {...props}
    >
      <rect x="2.2"  y="9.5"  width="2.6" height="5"  rx="1.3" />
      <rect x="6.5"  y="6"    width="2.6" height="12" rx="1.3" />
      <rect x="10.7" y="2.5"  width="2.6" height="19" rx="1.3" />
      <rect x="14.9" y="6"    width="2.6" height="12" rx="1.3" />
      <rect x="19.2" y="9.5"  width="2.6" height="5"  rx="1.3" />
    </svg>
  );
}
