import type { ReactNode } from "react";

export interface PageLeadProps {
  title: string;
  slogan: string;
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageLead({ title, slogan, eyebrow, meta, actions, className = "" }: PageLeadProps) {
  return <header className={`page-lead ${className}`.trim()}>
    <div className="page-lead-main"><div className="page-lead-copy">{eyebrow ? <div className="page-lead-eyebrow">{eyebrow}</div> : null}<h1>{title}</h1></div>{meta ? <div className="page-lead-meta">{meta}</div> : null}</div>
    <div className="page-lead-bottom"><p>{slogan}</p>{actions ? <div className="page-lead-actions">{actions}</div> : null}</div>
  </header>;
}
