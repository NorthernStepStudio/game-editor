import { extractCodeFence, truncateText } from "../../helpers/text.js";
import type { NssReviewItem } from "../../models/review.types.js";

export interface CreateReviewItemInput {
  readonly title: string;
  readonly prompt: string;
  readonly targetPath: string;
  readonly originalText: string;
  readonly responseText: string;
  readonly proposedText?: string;
  readonly sourceResponseId?: string;
}

export function createReviewItem(input: CreateReviewItemInput): NssReviewItem {
  const resolvedProposedText = input.proposedText ?? extractCodeFence(input.responseText);
  const now = new Date().toISOString();

  return {
    id: `review-${Date.now()}`,
    title: input.title,
    prompt: input.prompt,
    summary: truncateText(input.responseText.replace(/\s+/g, " ").trim(), 220),
    targetPath: input.targetPath,
    originalText: input.originalText,
    previewMarkdown: buildReviewPreviewMarkdown(input, resolvedProposedText),
    createdAt: now,
    updatedAt: now,
    status: "pending",
    stale: false,
    sourceResponseId: input.sourceResponseId,
    proposedText: resolvedProposedText,
  };
}

export function canApplyReviewItem(item: NssReviewItem): boolean {
  return typeof item.proposedText === "string" && item.proposedText.trim().length > 0;
}

export function approveReviewItem(item: NssReviewItem): NssReviewItem {
  return {
    ...item,
    status: "approved",
    updatedAt: new Date().toISOString(),
  };
}

export function rejectReviewItem(item: NssReviewItem): NssReviewItem {
  return {
    ...item,
    status: "rejected",
    updatedAt: new Date().toISOString(),
  };
}

export function markReviewItemStale(item: NssReviewItem, stale: boolean): NssReviewItem {
  return {
    ...item,
    stale,
    updatedAt: new Date().toISOString(),
  };
}

function buildReviewPreviewMarkdown(input: CreateReviewItemInput, proposedText: string | undefined): string {
  return [
    `## ${input.title}`,
    "",
    `Target: \`${input.targetPath}\``,
    "",
    `Prompt: ${input.prompt}`,
    "",
    "### Proposal Summary",
    input.responseText,
    "",
    "### Apply Status",
    proposedText
      ? "A concrete proposed file body is available and can be applied to the active file after confirmation."
      : "No concrete proposed file body was returned. This proposal can be reviewed, but not auto-applied yet.",
  ].join("\n");
}
