interface ClipCaptionsMarkProps {
  size?: number;
  className?: string;
}

/**
 * Crisp scalable ClipCaptions brand mark:
 * mint rounded frame, two subtitle rows, and one mint highlighted word.
 */
export function ClipCaptionsMark({
  size = 32,
  className = "",
}: ClipCaptionsMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="64" height="64" rx="16" fill="#070B10" />
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="13"
        stroke="#49E6B3"
        strokeWidth="4"
      />
      <rect x="13" y="20" width="22" height="8" rx="4" fill="#F5F1E8" />
      <rect
        x="39"
        y="20"
        width="12"
        height="8"
        rx="4"
        fill="#F5F1E8"
        fillOpacity="0.72"
      />
      <rect x="13" y="36" width="20" height="8" rx="4" fill="#49E6B3" />
      <rect x="37" y="36" width="14" height="8" rx="4" fill="#F5F1E8" />
    </svg>
  );
}

interface ClipCaptionsLockupProps {
  markSize?: number;
  compact?: boolean;
}

export function ClipCaptionsLockup({
  markSize = 32,
  compact = false,
}: ClipCaptionsLockupProps) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5">
      <ClipCaptionsMark size={markSize} className="shrink-0" />
      <span
        className={`font-bold tracking-[-0.02em] text-[#F5F1E8] ${
          compact ? "text-sm" : "text-sm sm:text-base"
        }`}
      >
        Clip<span className="text-[#49E6B3]">Captions</span>
      </span>
    </span>
  );
}
