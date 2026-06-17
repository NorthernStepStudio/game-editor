import type { NssReviewItem } from "../models/review.types.js";

export interface NssReviewCounts {
  readonly pending: number;
  readonly approved: number;
}

export function getActiveReview(
  reviewItems: readonly NssReviewItem[],
  activeReviewId: string | undefined,
): NssReviewItem | undefined {
  if (!activeReviewId) {
    return reviewItems[0];
  }

  return reviewItems.find((item) => item.id === activeReviewId) ?? reviewItems[0];
}

export function getReviewCounts(reviewItems: readonly NssReviewItem[]): NssReviewCounts {
  return {
    pending: reviewItems.filter((item) => item.status === "pending").length,
    approved: reviewItems.filter((item) => item.status === "approved").length,
  };
}

export function markReviewItemApplied(reviewItems: readonly NssReviewItem[], reviewId: string): NssReviewItem[] {
  return reviewItems.map((item) =>
    item.id === reviewId
      ? {
          ...item,
          status: "applied",
          stale: false,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
}
