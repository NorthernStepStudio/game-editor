export type FoundryQaIncidentKind =
  | "runtime_not_ready"
  | "runtime_error"
  | "scene_missing"
  | "duplicate_node_path"
  | "low_fps"
  | "frame_time_budget"
  | "memory_budget"
  | "object_budget";

export type FoundryQaSeverity = "info" | "warning" | "error" | "critical";

export interface FoundryQaIncident {
  readonly id: string;
  readonly kind: FoundryQaIncidentKind;
  readonly severity: FoundryQaSeverity;
  readonly summary: string;
  readonly runtimeSessionId: string;
  readonly capturedAt: string;
  readonly target?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
}
