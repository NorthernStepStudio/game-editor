/**
 * Character Rigging and Animation Pipeline Contracts
 *
 * Provider-neutral interfaces and data types for character rigging, skin weighting,
 * skeletal editing, animation generation, and retargeting in Matterhorn Motion Studio.
 */

export const CHARACTER_RIGGING_PIPELINE_VERSION = "1.0.0" as const;

export type SkeletalTopologyType = "humanoid" | "quadruped" | "prop" | "custom";

export interface BoneDefinition {
  readonly name: string;
  readonly parent?: string;
  readonly head: [number, number, number];
  readonly tail: [number, number, number];
  readonly rollDeg?: number;
}

export interface SkeletonDefinition {
  readonly name: string;
  readonly topologyType: SkeletalTopologyType;
  readonly rootBone: string;
  readonly bones: readonly BoneDefinition[];
}

export interface RiggingRequest {
  readonly characterId: string;
  readonly meshSourceUri: string;
  readonly targetTopology: SkeletalTopologyType;
  readonly customSkeleton?: SkeletonDefinition;
  readonly heightScale?: number;
}

export interface RiggingResult {
  readonly success: boolean;
  readonly characterId: string;
  readonly skeleton: SkeletonDefinition;
  readonly outputArmatureName: string;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface SkinWeightRequest {
  readonly characterId: string;
  readonly meshName: string;
  readonly armatureName: string;
  readonly algorithm: "automatic_heat" | "voxel_envelope" | "neural_prediction";
  readonly maxInfluencesPerVertex?: number;
}

export interface SkinWeightResult {
  readonly success: boolean;
  readonly characterId: string;
  readonly meshName: string;
  readonly armatureName: string;
  readonly vertexGroupCount: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface SkeletonEditOp {
  readonly op: "rename_bone" | "reparent_bone" | "adjust_bone" | "add_bone" | "remove_bone";
  readonly bone: string;
  readonly newName?: string;
  readonly newParent?: string;
  readonly newHead?: [number, number, number];
  readonly newTail?: [number, number, number];
}

export interface SkeletonEditRequest {
  readonly characterId: string;
  readonly armatureName: string;
  readonly edits: readonly SkeletonEditOp[];
}

export interface SkeletonEditResult {
  readonly success: boolean;
  readonly characterId: string;
  readonly appliedEdits: number;
  readonly updatedSkeleton: SkeletonDefinition;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface AnimationKeyframe {
  readonly bone: string;
  readonly frame: number;
  readonly location?: [number, number, number];
  readonly rotationEulerDeg?: [number, number, number];
  readonly scale?: [number, number, number];
}

export interface AnimationClipDefinition {
  readonly name: string;
  readonly frameStart: number;
  readonly frameEnd: number;
  readonly fps?: number;
  readonly isLooping: boolean;
  readonly keyframes: readonly AnimationKeyframe[];
}

export interface AnimationGenerationRequest {
  readonly characterId: string;
  readonly armatureName: string;
  readonly clipName: string;
  readonly clipType: "idle" | "walk" | "run" | "sprint" | "action" | "custom";
  readonly durationFrames?: number;
  readonly fps?: number;
  readonly isLooping?: boolean;
}

export interface AnimationGenerationResult {
  readonly success: boolean;
  readonly characterId: string;
  readonly clip: AnimationClipDefinition;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface RetargetingBoneMap {
  readonly sourceBone: string;
  readonly targetBone: string;
}

export interface RetargetingRequest {
  readonly characterId: string;
  readonly targetArmatureName: string;
  readonly sourceClipUri: string;
  readonly sourceClipName: string;
  readonly boneMapping: readonly RetargetingBoneMap[];
  readonly outputClipName?: string;
}

export interface RetargetingResult {
  readonly success: boolean;
  readonly characterId: string;
  readonly outputClipName: string;
  readonly mappedBoneCount: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Neutral Provider Interfaces
 */

export interface NssRiggingProvider {
  readonly providerId: string;
  readonly name: string;
  readonly supportedTopologies: readonly SkeletalTopologyType[];
  generateSkeleton(request: RiggingRequest): Promise<RiggingResult>;
}

export interface NssSkinWeightProvider {
  readonly providerId: string;
  readonly name: string;
  readonly supportedAlgorithms: readonly string[];
  assignWeights(request: SkinWeightRequest): Promise<SkinWeightResult>;
}

export interface NssSkeletonEditProvider {
  readonly providerId: string;
  readonly name: string;
  editSkeleton(request: SkeletonEditRequest): Promise<SkeletonEditResult>;
}

export interface NssAnimationGenerationProvider {
  readonly providerId: string;
  readonly name: string;
  readonly supportedClipTypes: readonly string[];
  generateClip(request: AnimationGenerationRequest): Promise<AnimationGenerationResult>;
}

export interface NssRetargetingProvider {
  readonly providerId: string;
  readonly name: string;
  retargetClip(request: RetargetingRequest): Promise<RetargetingResult>;
}

/**
 * Standard Humanoid Rigging Definition (Yun-compatible)
 */
export const STANDARD_YUN_HUMANOID_BONES: readonly BoneDefinition[] = [
  { name: "Root", head: [0, 0, 0], tail: [0, 0, 0.15] },
  { name: "Hips", parent: "Root", head: [0, 0, 0.55], tail: [0, 0, 0.75] },
  { name: "Spine", parent: "Hips", head: [0, 0, 0.75], tail: [0, 0, 1.2] },
  { name: "Chest", parent: "Spine", head: [0, 0, 1.2], tail: [0, 0, 1.45] },
  { name: "Neck", parent: "Chest", head: [0, 0, 1.45], tail: [0, 0, 1.6] },
  { name: "Head", parent: "Neck", head: [0, 0, 1.6], tail: [0, 0, 1.85] },
  { name: "UpperArm_L", parent: "Chest", head: [0.22, 0, 1.35], tail: [0.45, 0, 1.15] },
  { name: "ForeArm_L", parent: "UpperArm_L", head: [0.45, 0, 1.15], tail: [0.6, 0, 0.95] },
  { name: "Hand_L", parent: "ForeArm_L", head: [0.6, 0, 0.95], tail: [0.7, 0, 0.85] },
  { name: "UpperArm_R", parent: "Chest", head: [-0.22, 0, 1.35], tail: [-0.45, 0, 1.15] },
  { name: "ForeArm_R", parent: "UpperArm_R", head: [-0.45, 0, 1.15], tail: [-0.6, 0, 0.95] },
  { name: "Hand_R", parent: "ForeArm_R", head: [-0.6, 0, 0.95], tail: [-0.7, 0, 0.85] },
  { name: "Thigh_L", parent: "Hips", head: [0.12, 0, 0.7], tail: [0.12, 0, 0.35] },
  { name: "Shin_L", parent: "Thigh_L", head: [0.12, 0, 0.35], tail: [0.12, 0, 0.05] },
  { name: "Foot_L", parent: "Shin_L", head: [0.12, 0, 0.05], tail: [0.12, 0.15, 0.0] },
  { name: "Thigh_R", parent: "Hips", head: [-0.12, 0, 0.7], tail: [-0.12, 0, 0.35] },
  { name: "Shin_R", parent: "Thigh_R", head: [-0.12, 0, 0.35], tail: [-0.12, 0, 0.05] },
  { name: "Foot_R", parent: "Shin_R", head: [-0.12, 0, 0.05], tail: [-0.12, 0.15, 0.0] },
];

export const STANDARD_YUN_HUMANOID_SKELETON: SkeletonDefinition = {
  name: "YunHumanoidArmature",
  topologyType: "humanoid",
  rootBone: "Root",
  bones: STANDARD_YUN_HUMANOID_BONES,
};
