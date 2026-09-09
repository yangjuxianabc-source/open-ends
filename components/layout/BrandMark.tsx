export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      role="img"
      aria-label="未了"
      focusable="false"
    >
      <rect x="1" y="1" width="38" height="38" rx="13" fill="currentColor" opacity=".08" />
      <path
        d="M28.8 11.8a12.7 12.7 0 1 0 2.4 15.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M28.8 11.8 34 9.5M31.2 27.6l5.1 2.8"
        fill="none"
        stroke="var(--oe-accent)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle cx="28.8" cy="11.8" r="2" fill="var(--oe-accent)" />
      <circle cx="31.2" cy="27.6" r="2" fill="var(--oe-accent)" />
    </svg>
  );
}
