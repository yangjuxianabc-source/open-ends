import { describe, expect, it } from "vitest";
import { formatRating, ratingFromKey } from "./StarRating";

describe("StarRating", () => {
  it("supports half-star keyboard steps and bounds", () => {
    expect(ratingFromKey(4.5, "ArrowRight")).toBe(5);
    expect(ratingFromKey(0.5, "ArrowLeft")).toBe(0.5);
    expect(ratingFromKey(undefined, "ArrowRight")).toBe(1);
    expect(ratingFromKey(3, "Home")).toBe(0.5);
    expect(ratingFromKey(3, "End")).toBe(5);
    expect(ratingFromKey(3, "Delete")).toBeUndefined();
  });

  it("uses accessible numeric copy", () => {
    expect(formatRating(4.5)).toBe("4.5 / 5");
    expect(formatRating(undefined)).toBe("未评分");
  });
});
