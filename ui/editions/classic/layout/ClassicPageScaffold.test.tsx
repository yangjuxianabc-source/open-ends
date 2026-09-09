import { Children, createElement, isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ClassicPageScaffold } from "./ClassicPageScaffold";
import { ClassicScrollViewport } from "./ClassicScrollViewport";

function propsOf(element: ReactNode) {
  if (!isValidElement(element)) throw new Error("Expected a React element");
  return element.props as { className?: string; children?: ReactNode };
}

describe("ClassicPageScaffold", () => {
  it("keeps lead, pinned content, and scroll content in separate rows", () => {
    const tree = ClassicPageScaffold({
      lead: createElement("header", null, "lead"),
      pinned: createElement("aside", null, "pinned"),
      children: createElement("article", null, "content"),
    });

    expect(isValidElement(tree)).toBe(true);
    if (!isValidElement(tree)) return;
    expect(tree.type).toBe("section");
    const scaffoldProps = propsOf(tree);
    expect(scaffoldProps.className).toContain("classic-page-scaffold");
    expect(scaffoldProps.className).toContain("has-pinned");

    const rows = Children.toArray(scaffoldProps.children);
    expect(rows).toHaveLength(3);
    expect(propsOf(rows[0]).className).toBe("classic-page-lead-row");
    expect(propsOf(rows[1]).className).toBe("classic-page-pinned-row");
    expect(isValidElement(rows[2])).toBe(true);
    if (!isValidElement(rows[2])) return;
    expect(rows[2].type).toBe(ClassicScrollViewport);
    const viewport = ClassicScrollViewport(
      rows[2].props as Parameters<typeof ClassicScrollViewport>[0],
    );
    expect(propsOf(viewport).className).toContain("classic-page-scroll");

    const scrollContent = propsOf(viewport).children;
    expect(propsOf(scrollContent).className).toContain("classic-page-scroll-content");
  });

  it("omits the pinned row when no pinned content is supplied", () => {
    const tree = ClassicPageScaffold({
      lead: createElement("header"),
      children: createElement("article"),
    });

    expect(isValidElement(tree)).toBe(true);
    if (!isValidElement(tree)) return;
    expect(propsOf(tree).className).not.toContain("has-pinned");
    expect(Children.toArray(propsOf(tree).children)).toHaveLength(2);
  });
});
