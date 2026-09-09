import { describe, expect, it } from "vitest";
import {
  changeReviewPeriod,
  changeReviewView,
  initialReviewNavigationState,
} from "./review-state";

describe("Review presentation navigation", () => {
  it("opens the summary and profile surfaces from facts", () => {
    expect(changeReviewView(initialReviewNavigationState, "summary")).toEqual({
      period: "weekly",
      view: "summary",
    });
    expect(changeReviewView(initialReviewNavigationState, "profile")).toEqual({
      period: "weekly",
      view: "profile",
    });
  });

  it("returns from a reading surface to facts", () => {
    expect(
      changeReviewView({ period: "monthly", view: "summary" }, "facts"),
    ).toEqual({ period: "monthly", view: "facts" });
  });

  it("changes period and resets the current view to facts", () => {
    expect(changeReviewPeriod({ period: "weekly", view: "profile" }, "yearly")).toEqual({
      period: "yearly",
      view: "facts",
    });
  });
});
