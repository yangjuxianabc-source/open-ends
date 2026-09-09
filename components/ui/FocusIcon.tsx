export function FocusIcon({ active = false, className = "" }: { active?: boolean; className?: string }) {
  return <svg className={`focus-icon ${active ? "is-active" : ""} ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.55 5.95L20.5 12l-5.95 2.55L12 20.5l-2.55-5.95L3.5 12l5.95-2.55L12 3.5Z" /></svg>;
}
