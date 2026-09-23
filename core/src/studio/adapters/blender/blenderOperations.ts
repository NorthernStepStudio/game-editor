/**
 * Bounded Blender operations. Matterhorn never sends arbitrary Python;
 * the Blender layer compiles these into controlled scripts.
 */

export const BLENDER_OPERATION_KINDS = [
  "scene.inspect",
  "scene.new",
  "mesh.create_primitive",
  "mesh.transform",
  "mesh.bevel",
  "material.create",
  "material.assign",
  "camera.create",
  "light.create",
  "render.preview",
  "render.multi_view",
  "file.save_blend",
  "export.glb",
  "rig.create_armature",
  "rig.create_bone",
  "rig.parent_mesh",
  "rig.assign_weights",
  "animation.create_action",
  "animation.insert_keyframe",
  "animation.inspect",
  "character.inspect",
  "export.character_glb",
] as const;

export type BlenderOperationKind = (typeof BLENDER_OPERATION_KINDS)[number];

export type BlenderPrimitiveType = "cube" | "uv_sphere" | "cylinder" | "cone" | "plane";

export type BlenderVec3 = readonly [number, number, number];
export type BlenderVec4 = readonly [number, number, number, number];

export interface BlenderOperationBase {
  readonly op: BlenderOperationKind;
  readonly id?: string;
}

export interface SceneNewOp extends BlenderOperationBase {
  readonly op: "scene.new";
  readonly sceneName?: string;
}

export interface SceneInspectOp extends BlenderOperationBase {
  readonly op: "scene.inspect";
}

export interface MeshCreatePrimitiveOp extends BlenderOperationBase {
  readonly op: "mesh.create_primitive";
  readonly name: string;
  readonly primitive: BlenderPrimitiveType;
  readonly size?: number;
  readonly location?: BlenderVec3;
  readonly scale?: BlenderVec3;
  readonly radius?: number;
  readonly depth?: number;
}

export interface MeshTransformOp extends BlenderOperationBase {
  readonly op: "mesh.transform";
  readonly target: string;
  readonly location?: BlenderVec3;
  readonly rotationEulerDeg?: BlenderVec3;
  readonly scale?: BlenderVec3;
  readonly apply?: boolean;
}

export interface MeshBevelOp extends BlenderOperationBase {
  readonly op: "mesh.bevel";
  readonly target: string;
  readonly width?: number;
  readonly segments?: number;
}

export interface MaterialCreateOp extends BlenderOperationBase {
  readonly op: "material.create";
  readonly name: string;
  readonly baseColor?: BlenderVec4;
  readonly metallic?: number;
  readonly roughness?: number;
}

export interface MaterialAssignOp extends BlenderOperationBase {
  readonly op: "material.assign";
  readonly target: string;
  readonly material: string;
}

export interface CameraCreateOp extends BlenderOperationBase {
  readonly op: "camera.create";
  readonly name?: string;
  readonly location?: BlenderVec3;
  readonly rotationEulerDeg?: BlenderVec3;
  readonly setActive?: boolean;
}

export interface LightCreateOp extends BlenderOperationBase {
  readonly op: "light.create";
  readonly name?: string;
  readonly type?: "SUN" | "POINT" | "AREA";
  readonly location?: BlenderVec3;
  readonly energy?: number;
  readonly rotationEulerDeg?: BlenderVec3;
}

export interface RenderPreviewOp extends BlenderOperationBase {
  readonly op: "render.preview";
  readonly outputName: string;
  readonly width?: number;
  readonly height?: number;
}

export interface RenderMultiViewOp extends BlenderOperationBase {
  readonly op: "render.multi_view";
  readonly outputPrefix: string;
  readonly views?: readonly ("front" | "side" | "three_quarter" | "top")[];
  readonly width?: number;
  readonly height?: number;
}

export interface FileSaveBlendOp extends BlenderOperationBase {
  readonly op: "file.save_blend";
  readonly outputName: string;
}

export interface ExportGlbOp extends BlenderOperationBase {
  readonly op: "export.glb";
  readonly outputName: string;
  readonly exportSkins?: boolean;
  readonly exportAnimations?: boolean;
  readonly applyModifiers?: boolean;
}

export interface RigCreateArmatureOp extends BlenderOperationBase {
  readonly op: "rig.create_armature";
  readonly name: string;
  readonly location?: BlenderVec3;
}

export interface RigCreateBoneOp extends BlenderOperationBase {
  readonly op: "rig.create_bone";
  readonly armature: string;
  readonly name: string;
  readonly head: BlenderVec3;
  readonly tail: BlenderVec3;
  readonly parent?: string;
}

export interface RigParentMeshOp extends BlenderOperationBase {
  readonly op: "rig.parent_mesh";
  readonly mesh: string;
  readonly armature: string;
}

export interface RigAssignWeightsOp extends BlenderOperationBase {
  readonly op: "rig.assign_weights";
  readonly mesh: string;
  readonly armature: string;
  readonly mode?: "automatic" | "envelope";
}

export interface AnimationCreateActionOp extends BlenderOperationBase {
  readonly op: "animation.create_action";
  readonly name: string;
  readonly armature: string;
  readonly frameStart?: number;
  readonly frameEnd?: number;
}

export interface AnimationInsertKeyframeOp extends BlenderOperationBase {
  readonly op: "animation.insert_keyframe";
  readonly armature: string;
  readonly action: string;
  readonly bone: string;
  readonly frame: number;
  readonly location?: BlenderVec3;
  readonly rotationEulerDeg?: BlenderVec3;
}

export interface AnimationInspectOp extends BlenderOperationBase {
  readonly op: "animation.inspect";
}

export interface CharacterInspectOp extends BlenderOperationBase {
  readonly op: "character.inspect";
}

export interface ExportCharacterGlbOp extends BlenderOperationBase {
  readonly op: "export.character_glb";
  readonly outputName: string;
}

export type BlenderOperation =
  | SceneNewOp
  | SceneInspectOp
  | MeshCreatePrimitiveOp
  | MeshTransformOp
  | MeshBevelOp
  | MaterialCreateOp
  | MaterialAssignOp
  | CameraCreateOp
  | LightCreateOp
  | RenderPreviewOp
  | RenderMultiViewOp
  | FileSaveBlendOp
  | ExportGlbOp
  | RigCreateArmatureOp
  | RigCreateBoneOp
  | RigParentMeshOp
  | RigAssignWeightsOp
  | AnimationCreateActionOp
  | AnimationInsertKeyframeOp
  | AnimationInspectOp
  | CharacterInspectOp
  | ExportCharacterGlbOp;

/** Capabilities with an executable compiler path today. */
export const IMPLEMENTED_BLENDER_CAPABILITIES = [
  "blender.scene.inspect",
  "blender.mesh.create",
  "blender.mesh.modify",
  "blender.material.create",
  "blender.transform.set",
  "blender.render.preview",
  "blender.export.glb",
  "blender.create",
  "blender.art",
  "blender.qa",
  "blender.rig.create",
  "blender.rig.skin",
  "blender.animation.create",
  "blender.animation.inspect",
  "blender.character.inspect",
  "blender.export.character_glb",
] as const;

export type ImplementedBlenderCapability = (typeof IMPLEMENTED_BLENDER_CAPABILITIES)[number];

export function operationToCapability(op: BlenderOperationKind): string {
  switch (op) {
    case "scene.inspect":
    case "scene.new":
      return "blender.scene.inspect";
    case "mesh.create_primitive":
      return "blender.mesh.create";
    case "mesh.transform":
    case "mesh.bevel":
      return "blender.mesh.modify";
    case "material.create":
    case "material.assign":
      return "blender.material.create";
    case "camera.create":
    case "light.create":
      return "blender.transform.set";
    case "render.preview":
    case "render.multi_view":
      return "blender.render.preview";
    case "file.save_blend":
      return "blender.create";
    case "export.glb":
      return "blender.export.glb";
    case "rig.create_armature":
    case "rig.create_bone":
      return "blender.rig.create";
    case "rig.parent_mesh":
    case "rig.assign_weights":
      return "blender.rig.skin";
    case "animation.create_action":
    case "animation.insert_keyframe":
      return "blender.animation.create";
    case "animation.inspect":
      return "blender.animation.inspect";
    case "character.inspect":
      return "blender.character.inspect";
    case "export.character_glb":
      return "blender.export.character_glb";
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}
