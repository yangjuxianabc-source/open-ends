"use client";

import { useAppearance } from "@/ui/appearance/AppearanceProvider";
import { graphiteAmberTheme } from "./graphite-amber/manifest";
import type { IconSlot } from "./contracts";

export function EditionIcon({ slot, className }: { slot: IconSlot; className?: string }) {
  const { theme } = useAppearance();
  const icon = theme.icons[slot] ?? graphiteAmberTheme.icons[slot];
  if (!icon) return null;
  return (
    <svg className={className} viewBox={icon.viewBox} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {icon.paths.map((path, index) => <path key={`${slot}-${index}`} d={path} />)}
    </svg>
  );
}
