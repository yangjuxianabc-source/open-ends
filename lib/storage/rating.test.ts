import { describe, expect, it } from "vitest";
import { ratingChangeEvent } from "./rating";

describe("rating changes", () => {
  it("emits a half-star rating event", () => {
    expect(ratingChangeEvent(undefined, 4.5)).toEqual({ type: "rating_changed", rating: 4.5 });
  });

  it("does not emit a duplicate event for the same rating", () => {
    expect(ratingChangeEvent(4.5, 4.5)).toBeUndefined();
  });

  it("keeps clear-rating semantics explicit", () => {
    expect(ratingChangeEvent(4.5, undefined)).toEqual({ type: "rating_changed" });
  });
});
