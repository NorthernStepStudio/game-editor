export interface NssWorkflowDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly steps: readonly string[];
}

export type NssWorkflowStatus = "active" | "cancelled" | "completed";

export interface NssWorkflowRun {
  readonly id: string;
  readonly workflowId: string;
  readonly title: string;
  readonly steps: readonly string[];
  readonly currentStepIndex: number;
  readonly status: NssWorkflowStatus;
  readonly startedAt: string;
  readonly updatedAt: string;
}
