export type NssReviewStatus = "applied" | "approved" | "pending" | "rejected";

export interface NssReviewItem {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly summary: string;
  readonly targetPath: string;
  readonly originalText: string;
  readonly previewMarkdown: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: NssReviewStatus;
  readonly stale: boolean;
  readonly sourceResponseId?: string;
  readonly proposedText?: string;
}
