export type FoundryCriterionType =
  | "property_equals"
  | "property_range"
  | "node_exists"
  | "movement_position"
  | "health_damage"
  | "timed_scenario"
  | "visual_baseline"
  | "visual_similarity"
  | "composition"
  | "pixel_integrity"
  | "palette_constraint"
  | "animation_state"
  | "animation_loop"
  | "semantic_ui"
  | "world_state"
  | "collision"
  | "navigation"
  | "performance_budget"
  | "memory_budget"
  | "audio_event"
  | "input_response"
  | "replay_checksum"
  | "asset_integrity"
  | "generic";

export interface FoundryCriterionV2 {
  readonly protocol: "nss.foundry.criterion.v2";
  readonly id: string;
  readonly description: string;
  readonly type: FoundryCriterionType;
  readonly target?: string;
  readonly expected?: unknown;
  readonly tolerance?: number;
  readonly evidenceRequired?: boolean;
  readonly tags?: readonly string[];
}

export interface FoundryCriterionEvidenceV2 {
  readonly criterionId: string;
  readonly executionId: string;
  readonly outcome: "passed" | "failed" | "blocked" | "unknown";
  readonly actual?: unknown;
  readonly evidenceUris?: readonly string[];
  readonly timestamp: string;
}
