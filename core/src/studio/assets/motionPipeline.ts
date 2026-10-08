export type NssMotionWorkflowStage =
  | "consistent-still"
  | "key-pose"
  | "interpolation-candidates"
  | "frame-selection"
  | "stitch"
  | "sentinel-validation";

export interface NssMotionAnimationState {
  readonly id: string;
  readonly description: string;
  readonly required: boolean;
}

export interface NssMotionPlan {
  readonly id: string;
  readonly characterManifestId: string;
  readonly actionId: string;
  readonly startReferenceUri: string;
  readonly keyPoseReferenceUri: string;
  readonly states: readonly NssMotionAnimationState[];
  readonly candidateTargetCount: number;
  readonly loopRequired: boolean;
}

export interface NssMotionCandidateSegment {
  readonly candidateId: string;
  readonly sourceUri: string;
  readonly startFrame: number;
  readonly endFrame: number;
}

export interface NssMotionStitchPlan {
  readonly motionPlanId: string;
  readonly segments: readonly NssMotionCandidateSegment[];
}

export interface NssMotionPlanValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export const MOTION_WORKFLOW_STAGES: readonly NssMotionWorkflowStage[] = [
  "consistent-still",
  "key-pose",
  "interpolation-candidates",
  "frame-selection",
  "stitch",
  "sentinel-validation",
];

export function validateMotionPlan(plan: NssMotionPlan): NssMotionPlanValidation {
  const errors: string[] = [];

  if (!plan.id.trim()) {
    errors.push("Motion plan id must be non-empty.");
  }
  if (!plan.characterManifestId.trim()) {
    errors.push("Motion plan requires a character manifest id.");
  }
  if (!plan.actionId.trim()) {
    errors.push("Motion plan action id must be non-empty.");
  }
  if (!plan.startReferenceUri.trim()) {
    errors.push("Motion plan requires a consistent start reference.");
  }
  if (!plan.keyPoseReferenceUri.trim()) {
    errors.push("Motion plan requires a key/apex pose reference.");
  }
  if (!Number.isInteger(plan.candidateTargetCount) || plan.candidateTargetCount <= 0) {
    errors.push("Motion candidate target count must be a positive integer.");
  }
  if (plan.states.length === 0) {
    errors.push("Motion plan must define at least one animation state.");
  }
  if (plan.states.some((state) => !state.id.trim() || !state.description.trim())) {
    errors.push("Motion animation states require non-empty ids and descriptions.");
  }

  const ids = plan.states.map((state) => state.id);
  if (new Set(ids).size !== ids.length) {
    errors.push("Motion animation state ids must be unique.");
  }

  return { valid: errors.length === 0, errors };
}

export function validateMotionStitchPlan(
  plan: NssMotionStitchPlan,
): NssMotionPlanValidation {
  const errors: string[] = [];

  if (!plan.motionPlanId.trim()) {
    errors.push("Motion stitch plan requires a motion plan id.");
  }
  if (plan.segments.length === 0) {
    errors.push("Motion stitch plan requires at least one selected segment.");
  }

  for (const segment of plan.segments) {
    if (!segment.candidateId.trim()) {
      errors.push("Motion stitch segments require candidate ids.");
    }
    if (!segment.sourceUri.trim()) {
      errors.push("Motion stitch segments require source URIs.");
    }
    if (!Number.isInteger(segment.startFrame) || segment.startFrame < 0) {
      errors.push("Motion stitch segment start frames must be non-negative integers.");
    }
    if (!Number.isInteger(segment.endFrame) || segment.endFrame < segment.startFrame) {
      errors.push("Motion stitch segment end frames must be integers at or after their start frame.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getMotionWorkflowStages(
  plan: NssMotionPlan,
): readonly NssMotionWorkflowStage[] {
  const validation = validateMotionPlan(plan);
  if (!validation.valid) {
    throw new Error(`Invalid motion plan: ${validation.errors.join(" ")}`);
  }
  return MOTION_WORKFLOW_STAGES;
}
