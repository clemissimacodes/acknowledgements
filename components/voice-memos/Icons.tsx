type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function ShareIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 15V4" />
      <path d="m8.5 7.5 3.5-3.5 3.5 3.5" />
      <path d="M7 11H6a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18 11h-1" />
    </svg>
  );
}

export function HeartIcon({
  size = 18,
  className,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} className={className} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.2S3.5 14.9 3.5 8.9A4.4 4.4 0 0 1 12 6.6a4.4 4.4 0 0 1 8.5 2.3c0 6-8.5 11.3-8.5 11.3z" />
    </svg>
  );
}

export function TrashIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M6.3 6.5 7 18.4a1.6 1.6 0 0 0 1.6 1.5h6.8a1.6 1.6 0 0 0 1.6-1.5l.7-11.9" />
      <path d="M10 10.3v6M14 10.3v6" />
    </svg>
  );
}

export function OptionsIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="1.9" fill="var(--vm-surface, #fff)" />
      <circle cx="15" cy="12" r="1.9" fill="var(--vm-surface, #fff)" />
      <circle cx="8" cy="17" r="1.9" fill="var(--vm-surface, #fff)" />
    </svg>
  );
}

export function LoopIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M17 3.5 20 6.5l-3 3" />
      <path d="M4 11V9.5a3 3 0 0 1 3-3h13" />
      <path d="m7 20.5-3-3 3-3" />
      <path d="M20 13v1.5a3 3 0 0 1-3 3H4" />
    </svg>
  );
}

export function SearchIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} strokeWidth={2}>
      <circle cx="10.5" cy="10.5" r="6.2" />
      <path d="m15.3 15.3 4.2 4.2" />
    </svg>
  );
}

export function ChevronIcon({
  size = 16,
  className,
  direction = "left",
}: IconProps & { direction?: "left" | "right" | "down" }) {
  const rotate =
    direction === "left" ? 0 : direction === "right" ? 180 : 270;
  return (
    <svg
      {...base(size)}
      className={className}
      strokeWidth={2.2}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </svg>
  );
}

export function NoteBadgeIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.6}>
      <rect x="3.5" y="4.5" width="17" height="12" rx="2.5" />
      <path d="M8 20.5v-4" />
      <path d="M7.5 9h9M7.5 12h6" />
    </svg>
  );
}

export function MicBadgeIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.6}>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M6 11.5a6 6 0 0 0 12 0" />
      <path d="M12 17.5v3M9.5 20.5h5" />
    </svg>
  );
}

export function PlayIcon({ size = 30, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M7 4.6v14.8c0 .9 1 1.5 1.8 1L20.4 13a1.2 1.2 0 0 0 0-2L8.8 3.6C8 3.1 7 3.7 7 4.6z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 30, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="6" y="4" width="4.2" height="16" rx="1.1" fill="currentColor" />
      <rect x="13.8" y="4" width="4.2" height="16" rx="1.1" fill="currentColor" />
    </svg>
  );
}

export function Skip15Icon({
  size = 30,
  className,
  forward = false,
}: IconProps & { forward?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      style={forward ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M12 4.2a7.8 7.8 0 1 1-7.4 5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M4.9 3.6v4.3h4.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="14.6"
        textAnchor="middle"
        fontSize="7.2"
        fontWeight="600"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif"
        fill="currentColor"
        stroke="none"
        style={forward ? { transform: "scaleX(-1)", transformOrigin: "12px 12px" } : undefined}
      >
        15
      </text>
    </svg>
  );
}

export function CheckIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} strokeWidth={2.4}>
      <path d="m5 12.5 4.2 4.2L19 7.5" />
    </svg>
  );
}

export function CloseIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} strokeWidth={2}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
