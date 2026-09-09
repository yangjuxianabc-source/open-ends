"use client";

import type { ReactNode } from "react";

interface InsightDocumentProps {
  content: string;
  className?: string;
}

type TextBlock = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };
type Section = { heading?: string; blocks: TextBlock[] };

/** Render the small, trusted Markdown subset produced by the AI routes. */
export function InsightDocument({ content, className = "" }: InsightDocumentProps) {
  const sections = parseSections(content);
  return (
    <article className={`insight-document ${className}`.trim()}>
      {sections.map((section, index) => (
        <section className={`insight-section${section.heading ? " has-heading" : ""}`} key={`${section.heading ?? "plain"}-${index}`}>
          {section.heading ? <h3>{inlineText(section.heading)}</h3> : null}
          {section.blocks.map((block, blockIndex) => block.kind === "paragraph"
            ? <p key={`p-${blockIndex}`}>{inlineText(block.text)}</p>
            : <ul key={`ul-${blockIndex}`}>{block.items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{inlineText(item)}</li>)}</ul>)}
        </section>
      ))}
    </article>
  );
}

function parseSections(content: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { blocks: [] };
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    current.blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    current.blocks.push({ kind: "list", items: [...list] });
    list = [];
  };
  const flushSection = () => {
    flushParagraph();
    flushList();
    if (current.heading || current.blocks.length) sections.push(current);
  };

  for (const rawLine of content.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushSection();
      current = { heading: heading[1], blocks: [] };
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushSection();
  return sections;
}

function inlineText(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}
