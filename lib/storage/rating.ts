import type { Rating } from "@/types";

export interface RatingChangeEvent {
  type: "rating_changed";
  rating?: Rating;
}

/** Returns the durable event payload only when the effective rating changes. */
export function ratingChangeEvent(previous: Rating | undefined, next: Rating | undefined): RatingChangeEvent | undefined {
  if (previous === next) return undefined;
  return next === undefined ? { type: "rating_changed" } : { type: "rating_changed", rating: next };
}
