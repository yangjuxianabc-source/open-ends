import type { HTMLAttributes, ReactNode } from "react";

export function ClassicScrollViewport({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`classic-page-scroll ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
