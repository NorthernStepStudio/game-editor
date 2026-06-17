import type { NssServerHealth } from "./api.types.js";
import type { NssResponseKind } from "./command.types.js";
import type { NssModeId } from "./mode.types.js";
import type { NssReviewStatus } from "./review.types.js";

export interface NssDebugStateSnapshot {
  readonly serverHealth: NssServerHealth;
  readonly mode: NssModeId;
  readonly presetId: string;
  readonly studioProjectId: string;
  readonly currentFilePath?: string;
  readonly latestResponse?: {
    readonly title: string;
    readonly body: string;
    readonly kind: NssResponseKind;
    readonly sourceCommand: string;
  };
  readonly activeReview?: {
    readonly title: string;
    readonly status: NssReviewStatus;
    readonly targetPath: string;
    readonly hasProposedText: boolean;
  };
  readonly reviewItemCount: number;
}
