export type NssRoadmapStatus = "done" | "open";

export interface NssRoadmapNote {
  readonly id: string;
  readonly projectId: string;
  readonly note: string;
  readonly status: NssRoadmapStatus;
  readonly createdAt: string;
}
