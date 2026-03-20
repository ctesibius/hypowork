import { cn } from "@/lib/utils";

/**
 * Abstract H mark — staggered verticals + floating bridge (depth / “hypo” read).
 * Uses currentColor for light / mid / dark themes.
 */
export function HypoworkMark({ className }: { className?: string }) {
  const r = 1.35;
  /** Crossbar x=5.35 → outer edge x=20 (flush with right column) to avoid a corner notch. */
  const bridgeW = 14.65;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn(className)}
      aria-hidden
    >
      <g opacity={0.26} transform="translate(0.95 0.65)">
        <rect x="4" y="4.5" width="2.65" height="9.25" rx={r} fill="currentColor" />
        <rect x="17.35" y="10" width="2.65" height="10.5" rx={r} fill="currentColor" />
        <rect x="5.35" y="10" width={bridgeW} height="2.65" rx={r} fill="currentColor" />
      </g>
      <rect x="4" y="4.5" width="2.65" height="9.25" rx={r} fill="currentColor" />
      <rect x="17.35" y="10" width="2.65" height="10.5" rx={r} fill="currentColor" />
      <rect x="5.35" y="10" width={bridgeW} height="2.65" rx={r} fill="currentColor" />
    </svg>
  );
}
