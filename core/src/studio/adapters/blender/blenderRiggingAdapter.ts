/**
 * Blender-Native Rigging and Animation Provider
 *
 * Implements NssRiggingProvider, NssSkinWeightProvider, NssSkeletonEditProvider,
 * and NssAnimationGenerationProvider compiling high-level requests into deterministic
 * typed BlenderOperations suitable for execution by BlenderAdapter.
 */

import type {
  NssRiggingProvider,
  NssSkinWeightProvider,
  NssSkeletonEditProvider,
  NssAnimationGenerationProvider,
  NssRetargetingProvider,
  RiggingRequest,
  RiggingResult,
  SkinWeightRequest,
  SkinWeightResult,
  SkeletonEditRequest,
  SkeletonEditResult,
  AnimationGenerationRequest,
  AnimationGenerationResult,
  RetargetingRequest,
  RetargetingResult,
  SkeletonDefinition,
  AnimationClipDefinition,
  SkeletalTopologyType,
} from "../../assets/characterRiggingPipeline.js";
import {
  STANDARD_YUN_HUMANOID_BONES,
  STANDARD_YUN_HUMANOID_SKELETON,
} from "../../assets/characterRiggingPipeline.js";
import type { BlenderOperation } from "./blenderOperations.js";

export class BlenderRiggingProvider implements NssRiggingProvider {
  readonly providerId = "blender-native-rigging";
  readonly name = "Blender Native Armature Rigging Provider";
  readonly supportedTopologies: readonly SkeletalTopologyType[] = ["humanoid", "custom"];

  async generateSkeleton(request: RiggingRequest): Promise<RiggingResult> {
    if (request.targetTopology !== "humanoid" && !request.customSkeleton) {
      return {
        success: false,
        characterId: request.characterId,
        skeleton: {
          name: "Empty",
          topologyType: request.targetTopology,
          rootBone: "",
          bones: [],
        },
        outputArmatureName: "",
        warnings: [],
        errors: [`Topology ${request.targetTopology} requires customSkeleton definition`],
      };
    }

    const skeleton: SkeletonDefinition = request.customSkeleton ?? {
      ...STANDARD_YUN_HUMANOID_SKELETON,
      name: `${request.characterId}_Armature`,
    };

    const scale = request.heightScale ?? 1.0;
    const scaledBones = skeleton.bones.map((b) => ({
      ...b,
      head: [b.head[0] * scale, b.head[1] * scale, b.head[2] * scale] as [number, number, number],
      tail: [b.tail[0] * scale, b.tail[1] * scale, b.tail[2] * scale] as [number, number, number],
    }));

    return {
      success: true,
      characterId: request.characterId,
      skeleton: {
        ...skeleton,
        bones: scaledBones,
      },
      outputArmatureName: skeleton.name,
      warnings: [],
      errors: [],
    };
  }

  compileRiggingOperations(
    armatureName: string,
    skeleton: SkeletonDefinition,
  ): BlenderOperation[] {
    const ops: BlenderOperation[] = [
      { op: "rig.create_armature", name: armatureName, location: [0, 0, 0] },
    ];
    for (const b of skeleton.bones) {
      ops.push({
        op: "rig.create_bone",
        armature: armatureName,
        name: b.name,
        head: b.head,
        tail: b.tail,
        parent: b.parent,
      });
    }
    return ops;
  }
}

export class BlenderSkinWeightProvider implements NssSkinWeightProvider {
  readonly providerId = "blender-native-skinning";
  readonly name = "Blender Native Automatic Heat Skin Weight Provider";
  readonly supportedAlgorithms: readonly string[] = ["automatic_heat", "voxel_envelope"];

  async assignWeights(request: SkinWeightRequest): Promise<SkinWeightResult> {
    const mode = request.algorithm === "voxel_envelope" ? "envelope" : "automatic";
    return {
      success: true,
      characterId: request.characterId,
      meshName: request.meshName,
      armatureName: request.armatureName,
      vertexGroupCount: STANDARD_YUN_HUMANOID_BONES.length,
      warnings: [],
      errors: [],
    };
  }

  compileSkinningOperations(
    meshName: string,
    armatureName: string,
    mode: "automatic" | "envelope" = "automatic",
  ): BlenderOperation[] {
    return [
      { op: "rig.parent_mesh", mesh: meshName, armature: armatureName },
      { op: "rig.assign_weights", mesh: meshName, armature: armatureName, mode },
    ];
  }
}

export class BlenderSkeletonEditProvider implements NssSkeletonEditProvider {
  readonly providerId = "blender-native-skeletal-edit";
  readonly name = "Blender Native Skeletal Edit Provider";

  async editSkeleton(request: SkeletonEditRequest): Promise<SkeletonEditResult> {
    const bones = [...STANDARD_YUN_HUMANOID_BONES];
    let applied = 0;
    const warnings: string[] = [];

    for (const edit of request.edits) {
      if (edit.op === "rename_bone" && edit.newName) {
        const idx = bones.findIndex((b) => b.name === edit.bone);
        if (idx >= 0) {
          bones[idx] = { ...bones[idx], name: edit.newName };
          applied++;
        }
      } else if (edit.op === "reparent_bone" && edit.newParent) {
        const idx = bones.findIndex((b) => b.name === edit.bone);
        if (idx >= 0) {
          bones[idx] = { ...bones[idx], parent: edit.newParent };
          applied++;
        }
      } else if (edit.op === "adjust_bone") {
        const idx = bones.findIndex((b) => b.name === edit.bone);
        if (idx >= 0) {
          bones[idx] = {
            ...bones[idx],
            head: edit.newHead ?? bones[idx].head,
            tail: edit.newTail ?? bones[idx].tail,
          };
          applied++;
        }
      } else {
        warnings.push(`Unsupported or incomplete edit op: ${edit.op} on bone ${edit.bone}`);
      }
    }

    return {
      success: true,
      characterId: request.characterId,
      appliedEdits: applied,
      updatedSkeleton: {
        name: request.armatureName,
        topologyType: "humanoid",
        rootBone: "Root",
        bones,
      },
      warnings,
      errors: [],
    };
  }
}

export class BlenderAnimationGenerationProvider implements NssAnimationGenerationProvider {
  readonly providerId = "blender-native-animation";
  readonly name = "Blender Native Keyframed Locomotion Generator";
  readonly supportedClipTypes: readonly string[] = [
    "idle",
    "walk",
    "run",
    "sprint",
    "turn",
    "turn_left",
    "turn_right",
  ];

  async generateClip(request: AnimationGenerationRequest): Promise<AnimationGenerationResult> {
    const fps = request.fps ?? 24;
    const isLooping = request.isLooping ?? true;

    if (request.clipType === "idle") {
      const end = request.durationFrames ?? 24;
      const clip: AnimationClipDefinition = {
        name: request.clipName,
        frameStart: 1,
        frameEnd: end,
        fps,
        isLooping,
        keyframes: [
          { bone: "Spine", frame: 1, rotationEulerDeg: [0, 0, 0] },
          { bone: "Spine", frame: Math.floor(end / 2), rotationEulerDeg: [2, 0, 0] },
          { bone: "Spine", frame: end, rotationEulerDeg: [0, 0, 0] },
        ],
      };
      return { success: true, characterId: request.characterId, clip, warnings: [], errors: [] };
    }

    if (request.clipType === "walk") {
      const end = request.durationFrames ?? 24;
      const mid = Math.floor(end / 2);
      const clip: AnimationClipDefinition = {
        name: request.clipName,
        frameStart: 1,
        frameEnd: end,
        fps,
        isLooping,
        keyframes: [
          { bone: "Thigh_L", frame: 1, rotationEulerDeg: [25, 0, 0] },
          { bone: "Thigh_R", frame: 1, rotationEulerDeg: [-25, 0, 0] },
          { bone: "Thigh_L", frame: mid, rotationEulerDeg: [-25, 0, 0] },
          { bone: "Thigh_R", frame: mid, rotationEulerDeg: [25, 0, 0] },
          { bone: "Thigh_L", frame: end, rotationEulerDeg: [25, 0, 0] },
          { bone: "Thigh_R", frame: end, rotationEulerDeg: [-25, 0, 0] },
        ],
      };
      return { success: true, characterId: request.characterId, clip, warnings: [], errors: [] };
    }

    if (request.clipType === "run" || request.clipType === "sprint") {
      const end = request.durationFrames ?? 16;
      const mid = Math.floor(end / 2);
      const angle = request.clipType === "sprint" ? 48 : 40;
      const clip: AnimationClipDefinition = {
        name: request.clipName,
        frameStart: 1,
        frameEnd: end,
        fps,
        isLooping,
        keyframes: [
          { bone: "Thigh_L", frame: 1, rotationEulerDeg: [angle, 0, 0] },
          { bone: "Thigh_R", frame: 1, rotationEulerDeg: [-angle, 0, 0] },
          { bone: "Thigh_L", frame: mid, rotationEulerDeg: [-angle, 0, 0] },
          { bone: "Thigh_R", frame: mid, rotationEulerDeg: [angle, 0, 0] },
          { bone: "Thigh_L", frame: end, rotationEulerDeg: [angle, 0, 0] },
          { bone: "Thigh_R", frame: end, rotationEulerDeg: [-angle, 0, 0] },
          { bone: "Spine", frame: 1, rotationEulerDeg: [6, 0, 0] },
          { bone: "Spine", frame: mid, rotationEulerDeg: [9, 0, 0] },
          { bone: "Spine", frame: end, rotationEulerDeg: [6, 0, 0] },
        ],
      };
      return { success: true, characterId: request.characterId, clip, warnings: [], errors: [] };
    }

    if (request.clipType === "turn" || request.clipType === "turn_left" || request.clipType === "turn_right") {
      const end = request.durationFrames ?? 16;
      const mid = Math.floor(end / 2);
      const dir = request.clipType === "turn_right" ? -1 : 1;
      const clip: AnimationClipDefinition = {
        name: request.clipName,
        frameStart: 1,
        frameEnd: end,
        fps,
        isLooping,
        keyframes: [
          { bone: "Root", frame: 1, rotationEulerDeg: [0, 0, 0] },
          { bone: "Root", frame: mid, rotationEulerDeg: [0, 0, 15 * dir] },
          { bone: "Root", frame: end, rotationEulerDeg: [0, 0, 30 * dir] },
          { bone: "Hips", frame: 1, rotationEulerDeg: [0, 0, 0] },
          { bone: "Hips", frame: mid, rotationEulerDeg: [0, 5 * dir, 0] },
          { bone: "Hips", frame: end, rotationEulerDeg: [0, 0, 0] },
        ],
      };
      return { success: true, characterId: request.characterId, clip, warnings: [], errors: [] };
    }

    return {
      success: false,
      characterId: request.characterId,
      clip: {
        name: request.clipName,
        frameStart: 1,
        frameEnd: 1,
        fps,
        isLooping: false,
        keyframes: [],
      },
      warnings: [],
      errors: [`Unsupported clip type: ${request.clipType}`],
    };
  }

  compileAnimationOperations(
    armatureName: string,
    clip: AnimationClipDefinition,
  ): BlenderOperation[] {
    const ops: BlenderOperation[] = [
      {
        op: "animation.create_action",
        name: clip.name,
        armature: armatureName,
        frameStart: clip.frameStart,
        frameEnd: clip.frameEnd,
      },
    ];

    for (const kf of clip.keyframes) {
      ops.push({
        op: "animation.insert_keyframe",
        armature: armatureName,
        action: clip.name,
        bone: kf.bone,
        frame: kf.frame,
        location: kf.location,
        rotationEulerDeg: kf.rotationEulerDeg,
      });
    }

    return ops;
  }
}

export class BlenderRetargetingProvider implements NssRetargetingProvider {
  readonly providerId = "blender-native-retargeting";
  readonly name = "Blender Native Bone Name Mapping Retargeter";

  async retargetClip(request: RetargetingRequest): Promise<RetargetingResult> {
    const outName = request.outputClipName ?? `${request.sourceClipName}_retargeted`;
    return {
      success: true,
      characterId: request.characterId,
      outputClipName: outName,
      mappedBoneCount: request.boneMapping.length,
      warnings: [],
      errors: [],
    };
  }

  compileRetargetingOperations(
    targetArmature: string,
    sourceClip: AnimationClipDefinition,
    boneMapping: readonly { sourceBone: string; targetBone: string }[],
    outputClipName?: string,
  ): BlenderOperation[] {
    const actionName = outputClipName ?? `${sourceClip.name}_retargeted`;
    const map = new Map(boneMapping.map((m) => [m.sourceBone, m.targetBone]));
    const ops: BlenderOperation[] = [
      {
        op: "animation.create_action",
        name: actionName,
        armature: targetArmature,
        frameStart: sourceClip.frameStart,
        frameEnd: sourceClip.frameEnd,
      },
    ];

    for (const kf of sourceClip.keyframes) {
      const targetBone = map.get(kf.bone) ?? kf.bone;
      ops.push({
        op: "animation.insert_keyframe",
        armature: targetArmature,
        action: actionName,
        bone: targetBone,
        frame: kf.frame,
        location: kf.location,
        rotationEulerDeg: kf.rotationEulerDeg,
      });
    }

    return ops;
  }
}
