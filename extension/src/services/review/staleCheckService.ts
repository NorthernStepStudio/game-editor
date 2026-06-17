import type { NssReviewItem } from "../../models/review.types.js";

export function isReviewItemStale(item: NssReviewItem, currentText: string): boolean {
  return item.originalText !== currentText;
}
