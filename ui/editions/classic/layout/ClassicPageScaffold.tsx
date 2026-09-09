import type { ReactNode } from "react";
import { ClassicScrollViewport } from "./ClassicScrollViewport";

export interface ClassicPageScaffoldProps {
  lead: ReactNode;
  pinned?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * The Classic page contract keeps the page lead and any input/context rail
 * outside the content scroll root.  Individual screens only own their
 * business content; the shell owns the vertical layout and scroll boundary.
 */
export function ClassicPageScaffold({
  lead,
  pinned,
  children,
  className = "",
  contentClassName = "",
}: ClassicPageScaffoldProps) {
  const classes = [
    "classic-page-scaffold",
    pinned ? "has-pinned" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <div className="classic-page-lead-row">{lead}</div>
      {pinned ? <div className="classic-page-pinned-row">{pinned}</div> : null}
      <ClassicScrollViewport>
        <div className={`classic-page-scroll-content ${contentClassName}`.trim()}>
          {children}
        </div>
      </ClassicScrollViewport>
    </section>
  );
}
