import { describe, expect, it } from "vitest";
import { sparkWorkspaceMode } from "./spark-mode";

describe("Spark workspace mode", () => {
  it("uses the browse grid when no Spark is selected", () => {
    expect(sparkWorkspaceMode()).toBe("browsing");
  });

  it("uses the squeezed detail layout for a selected Spark", () => {
    expect(sparkWorkspaceMode("spark-1")).toBe("detail");
  });

  it("returns to the browse grid after going back", () => {
    expect(sparkWorkspaceMode(undefined)).toBe("browsing");
  });
});
