import type { ReviewPeriod, ReviewView } from "@/ui/view-models/review";

export interface ReviewNavigationState {
  period: ReviewPeriod;
  view: ReviewView;
}

export const initialReviewNavigationState: ReviewNavigationState = {
  period: "weekly",
  view: "facts",
};

export function changeReviewView(
  state: ReviewNavigationState,
  view: ReviewView,
): ReviewNavigationState {
  return { ...state, view };
}

export function changeReviewPeriod(
  state: ReviewNavigationState,
  period: ReviewPeriod,
): ReviewNavigationState {
  return { period, view: "facts" };
}
