import { strict as assert } from "node:assert";

import { canApplyReviewItem, createReviewItem } from "../../services/review/reviewService.js";

export function runReviewQueueSmoke(): void {
  const reviewItem = createReviewItem({
    title: "Proposed Edit: extension.ts",
    prompt: "Refactor activation",
    targetPath: "src/extension.ts",
    originalText: "old content",
    responseText: "Summary\n\n```ts\nexport const restored = true;\n```",
  });

  assert.equal(reviewItem.targetPath, "src/extension.ts");
  assert.equal(canApplyReviewItem(reviewItem), true);
  assert.equal(reviewItem.proposedText, "export const restored = true;");
  assert.match(reviewItem.previewMarkdown, /Apply Status/);
}
