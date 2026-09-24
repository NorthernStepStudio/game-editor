/**
 * Validated Blender task specification. Rejects unknown ops, unsafe paths,
 * and malformed numerics before any Blender process starts.
 */

import { isAbsolute, normalize, resolve, sep } from "node:path";
import { SpecialistError } from "../types.js";
import {
  BLENDER_OPERATION_KINDS,
  type BlenderOperation,
  type BlenderOperationKind,
  type BlenderVec3,
  type BlenderVec4,
} from "./blenderOperations.js";

export const BLENDER_TASK_SCHEMA_VERSION = "1.0.0";

export interface BlenderRenderSettings {
  readonly width?: number;
  readonly height?: number;
  readonly engine?: "EEVEE" | "CYCLES";
}

export interface BlenderExportSettings {
  readonly format?: "GLB";
  readonly exportSkins?: boolean;
  readonly exportAnimations?: boolean;
  readonly applyModifiers?: boolean;
}

export interface BlenderOutputRequirement {
  readonly kind: "blend" | "glb" | "png" | "json" | "log";
  readonly name: string;
  readonly required: boolean;
  readonly minBytes?: number;
}

export interface BlenderTaskSpec {
  readonly schemaVersion: typeof BLENDER_TASK_SCHEMA_VERSION | string;
  readonly assetName: string;
  readonly operations: readonly BlenderOperation[];
  readonly workingDirectory: string;
  readonly expectedArtifacts: readonly BlenderOutputRequirement[];
  readonly acceptanceCriteria: readonly string[];
  readonly renderSettings?: BlenderRenderSettings;
  readonly exportSettings?: BlenderExportSettings;
  readonly timeoutMs?: number;
}

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_\-]{0,63}$/;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;
const KIND_SET = new Set<string>(BLENDER_OPERATION_KINDS);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertVec3(value: unknown, label: string): asserts value is BlenderVec3 {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(isFiniteNumber)) {
    throw new SpecialistError("INVALID_TASK", `Malformed ${label}: expected [x,y,z] finite numbers`);
  }
}

function assertVec4(value: unknown, label: string): asserts value is BlenderVec4 {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) {
    throw new SpecialistError("INVALID_TASK", `Malformed ${label}: expected [r,g,b,a] finite numbers`);
  }
}

function assertSafePathSegment(name: string, label: string): void {
  if (!SAFE_FILE.test(name) || name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new SpecialistError("PERMISSION_DENIED", `Unsafe ${label}: ${name}`);
  }
}

function assertSafeWorkDir(workDir: string): string {
  if (!workDir || typeof workDir !== "string") {
    throw new SpecialistError("INVALID_TASK", "workingDirectory is required");
  }
  if (workDir.includes("\0")) {
    throw new SpecialistError("PERMISSION_DENIED", "workingDirectory contains NUL");
  }
  const normalized = normalize(resolve(workDir));
  if (normalized.includes(`..${sep}`) || normalized.endsWith(`${sep}..`)) {
    throw new SpecialistError("PERMISSION_DENIED", `Unsafe workingDirectory: ${workDir}`);
  }
  return normalized;
}

function assertOptionalFinite(value: unknown, label: string, min?: number, max?: number): void {
  if (value === undefined) return;
  if (!isFiniteNumber(value)) {
    throw new SpecialistError("INVALID_TASK", `Malformed numeric ${label}`);
  }
  if (min !== undefined && value < min) {
    throw new SpecialistError("INVALID_TASK", `${label} below minimum ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new SpecialistError("INVALID_TASK", `${label} above maximum ${max}`);
  }
}

function validateOperation(raw: unknown, index: number): BlenderOperation {
  if (!raw || typeof raw !== "object") {
    throw new SpecialistError("INVALID_TASK", `Operation[${index}] must be an object`);
  }
  const op = raw as Record<string, unknown>;
  const kind = op.op;
  if (typeof kind !== "string" || !KIND_SET.has(kind)) {
    throw new SpecialistError(
      "UNSUPPORTED_CAPABILITY",
      `Unsupported or unknown Blender operation: ${String(kind)}`,
    );
  }

  switch (kind as BlenderOperationKind) {
    case "scene.new":
    case "scene.inspect":
    case "animation.inspect":
    case "character.inspect":
      return { op: kind as "scene.new" | "scene.inspect" | "animation.inspect" | "character.inspect", ...(typeof op.sceneName === "string" ? { sceneName: op.sceneName } : {}) };

    case "world.set_background": {
      assertVec4(op.color, "background color");
      if (op.color.some((v) => v < 0 || v > 1)) throw new SpecialistError("INVALID_TASK", `Operation[${index}] background color must be in [0,1]`);
      assertOptionalFinite(op.strength, "strength", 0, 10);
      return op as unknown as BlenderOperation;
    }

    case "mesh.create_primitive": {
      if (typeof op.name !== "string" || !SAFE_NAME.test(op.name)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid mesh name`);
      }
      const primitive = op.primitive;
      if (
        primitive !== "cube" &&
        primitive !== "uv_sphere" &&
        primitive !== "cylinder" &&
        primitive !== "cone" &&
        primitive !== "plane"
      ) {
        throw new SpecialistError("UNSUPPORTED_CAPABILITY", `Unsupported primitive: ${String(primitive)}`);
      }
      assertOptionalFinite(op.size, "size", 0.01, 100);
      assertOptionalFinite(op.radius, "radius", 0.01, 100);
      assertOptionalFinite(op.depth, "depth", 0.01, 100);
      if (op.location !== undefined) assertVec3(op.location, "location");
      if (op.scale !== undefined) assertVec3(op.scale, "scale");
      return op as unknown as BlenderOperation;
    }

    case "mesh.transform": {
      if (typeof op.target !== "string" || !SAFE_NAME.test(op.target)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid transform target`);
      }
      if (op.location !== undefined) assertVec3(op.location, "location");
      if (op.rotationEulerDeg !== undefined) assertVec3(op.rotationEulerDeg, "rotationEulerDeg");
      if (op.scale !== undefined) assertVec3(op.scale, "scale");
      return op as unknown as BlenderOperation;
    }

    case "mesh.bevel": {
      if (typeof op.target !== "string" || !SAFE_NAME.test(op.target)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid bevel target`);
      }
      assertOptionalFinite(op.width, "width", 0, 10);
      assertOptionalFinite(op.segments, "segments", 1, 16);
      return op as unknown as BlenderOperation;
    }

    case "material.create": {
      if (typeof op.name !== "string" || !SAFE_NAME.test(op.name)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid material name`);
      }
      if (op.baseColor !== undefined) assertVec4(op.baseColor, "baseColor");
      assertOptionalFinite(op.metallic, "metallic", 0, 1);
      assertOptionalFinite(op.roughness, "roughness", 0, 1);
      return op as unknown as BlenderOperation;
    }

    case "material.assign": {
      if (typeof op.target !== "string" || !SAFE_NAME.test(op.target)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid assign target`);
      }
      if (typeof op.material !== "string" || !SAFE_NAME.test(op.material)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid material ref`);
      }
      return op as unknown as BlenderOperation;
    }

    case "camera.create":
    case "light.create": {
      if (op.name !== undefined && (typeof op.name !== "string" || !SAFE_NAME.test(op.name))) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid object name`);
      }
      if (op.location !== undefined) assertVec3(op.location, "location");
      if (op.rotationEulerDeg !== undefined) assertVec3(op.rotationEulerDeg, "rotationEulerDeg");
      assertOptionalFinite(op.energy, "energy", 0, 10_000);
      return op as unknown as BlenderOperation;
    }

    case "render.preview": {
      if (typeof op.outputName !== "string") {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] render outputName required`);
      }
      assertSafePathSegment(op.outputName, "render outputName");
      assertOptionalFinite(op.width, "width", 16, 4096);
      assertOptionalFinite(op.height, "height", 16, 4096);
      return op as unknown as BlenderOperation;
    }

    case "render.multi_view": {
      if (typeof op.outputPrefix !== "string") {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] outputPrefix required`);
      }
      assertSafePathSegment(op.outputPrefix, "outputPrefix");
      assertOptionalFinite(op.width, "width", 16, 4096);
      assertOptionalFinite(op.height, "height", 16, 4096);
      if (op.target !== undefined) assertVec3(op.target, "target");
      if (op.views !== undefined && (!Array.isArray(op.views) || op.views.some((view) =>
        !["front", "side", "back", "three_quarter", "top", "overview", "left", "right", "yun_side", "turn_side", "gameplay"].includes(view)))) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] contains an unsupported render view`);
      }
      return op as unknown as BlenderOperation;
    }

    case "file.save_blend":
    case "export.glb":
    case "export.character_glb": {
      if (typeof op.outputName !== "string") {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] outputName required`);
      }
      assertSafePathSegment(op.outputName, "outputName");
      return op as unknown as BlenderOperation;
    }

    case "rig.create_armature": {
      if (typeof op.name !== "string" || !SAFE_NAME.test(op.name)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid armature name`);
      }
      if (op.location !== undefined) assertVec3(op.location, "location");
      return op as unknown as BlenderOperation;
    }

    case "rig.create_bone": {
      if (typeof op.armature !== "string" || !SAFE_NAME.test(op.armature)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid armature`);
      }
      if (typeof op.name !== "string" || !SAFE_NAME.test(op.name)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid bone name`);
      }
      assertVec3(op.head, "head");
      assertVec3(op.tail, "tail");
      if (op.parent !== undefined && (typeof op.parent !== "string" || !SAFE_NAME.test(op.parent))) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid parent bone`);
      }
      return op as unknown as BlenderOperation;
    }

    case "rig.parent_mesh":
    case "rig.assign_weights": {
      if (typeof op.mesh !== "string" || !SAFE_NAME.test(op.mesh)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid mesh`);
      }
      if (typeof op.armature !== "string" || !SAFE_NAME.test(op.armature)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid armature`);
      }
      return op as unknown as BlenderOperation;
    }

    case "animation.create_action": {
      if (typeof op.name !== "string" || !SAFE_NAME.test(op.name)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid action name`);
      }
      if (typeof op.armature !== "string" || !SAFE_NAME.test(op.armature)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid armature`);
      }
      assertOptionalFinite(op.frameStart, "frameStart", 0, 100_000);
      assertOptionalFinite(op.frameEnd, "frameEnd", 0, 100_000);
      return op as unknown as BlenderOperation;
    }

    case "animation.insert_keyframe": {
      if (typeof op.armature !== "string" || !SAFE_NAME.test(op.armature)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid armature`);
      }
      if (typeof op.action !== "string" || !SAFE_NAME.test(op.action)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid action`);
      }
      if (typeof op.bone !== "string" || !SAFE_NAME.test(op.bone)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] invalid bone`);
      }
      assertOptionalFinite(op.frame, "frame", 0, 100_000);
      if (!isFiniteNumber(op.frame)) {
        throw new SpecialistError("INVALID_TASK", `Operation[${index}] frame required`);
      }
      if (op.location !== undefined) assertVec3(op.location, "location");
      if (op.rotationEulerDeg !== undefined) assertVec3(op.rotationEulerDeg, "rotationEulerDeg");
      return op as unknown as BlenderOperation;
    }

    default:
      throw new SpecialistError("UNSUPPORTED_CAPABILITY", `Unsupported Blender operation: ${kind}`);
  }
}

export function validateBlenderTaskSpec(input: unknown): BlenderTaskSpec {
  if (!input || typeof input !== "object") {
    throw new SpecialistError("INVALID_TASK", "Blender task specification must be an object");
  }
  const raw = input as Record<string, unknown>;

  if (typeof raw.assetName !== "string" || !SAFE_NAME.test(raw.assetName)) {
    throw new SpecialistError("INVALID_TASK", "assetName must be a safe identifier");
  }
  if (!Array.isArray(raw.operations) || raw.operations.length === 0) {
    throw new SpecialistError("INVALID_TASK", "operations must be a non-empty array");
  }
  if (!Array.isArray(raw.expectedArtifacts)) {
    throw new SpecialistError("INVALID_TASK", "expectedArtifacts must be an array");
  }
  if (!Array.isArray(raw.acceptanceCriteria) || raw.acceptanceCriteria.length === 0) {
    throw new SpecialistError("INVALID_TASK", "acceptanceCriteria must be a non-empty array");
  }
  if (typeof raw.workingDirectory !== "string") {
    throw new SpecialistError("INVALID_TASK", "workingDirectory is required");
  }
  if (isAbsolute(String(raw.workingDirectory)) === false && String(raw.workingDirectory).includes("..")) {
    throw new SpecialistError("PERMISSION_DENIED", "workingDirectory path escape rejected");
  }

  const workingDirectory = assertSafeWorkDir(raw.workingDirectory);
  const operations = raw.operations.map((op, i) => validateOperation(op, i));

  const expectedArtifacts: BlenderOutputRequirement[] = raw.expectedArtifacts.map((artifact, i) => {
    if (!artifact || typeof artifact !== "object") {
      throw new SpecialistError("INVALID_TASK", `expectedArtifacts[${i}] invalid`);
    }
    const a = artifact as Record<string, unknown>;
    if (
      a.kind !== "blend" &&
      a.kind !== "glb" &&
      a.kind !== "png" &&
      a.kind !== "json" &&
      a.kind !== "log"
    ) {
      throw new SpecialistError("INVALID_TASK", `expectedArtifacts[${i}] unknown kind`);
    }
    if (typeof a.name !== "string") {
      throw new SpecialistError("INVALID_TASK", `expectedArtifacts[${i}] name required`);
    }
    assertSafePathSegment(a.name, `expectedArtifacts[${i}].name`);
    if (typeof a.required !== "boolean") {
      throw new SpecialistError("INVALID_TASK", `expectedArtifacts[${i}] required flag missing`);
    }
    assertOptionalFinite(a.minBytes, "minBytes", 0);
    const kind = a.kind as BlenderOutputRequirement["kind"];
    return {
      kind,
      name: a.name,
      required: a.required,
      ...(isFiniteNumber(a.minBytes) ? { minBytes: a.minBytes } : {}),
    };
  });

  assertOptionalFinite(raw.timeoutMs, "timeoutMs", 1_000, 3_600_000);

  if (raw.renderSettings && typeof raw.renderSettings === "object") {
    const rs = raw.renderSettings as Record<string, unknown>;
    assertOptionalFinite(rs.width, "renderSettings.width", 16, 4096);
    assertOptionalFinite(rs.height, "renderSettings.height", 16, 4096);
  }

  return {
    schemaVersion: typeof raw.schemaVersion === "string" ? raw.schemaVersion : BLENDER_TASK_SCHEMA_VERSION,
    assetName: raw.assetName,
    operations,
    workingDirectory,
    expectedArtifacts,
    acceptanceCriteria: raw.acceptanceCriteria.map(String),
    ...(raw.renderSettings && typeof raw.renderSettings === "object"
      ? { renderSettings: raw.renderSettings as BlenderRenderSettings }
      : {}),
    ...(raw.exportSettings && typeof raw.exportSettings === "object"
      ? { exportSettings: raw.exportSettings as BlenderExportSettings }
      : {}),
    ...(isFiniteNumber(raw.timeoutMs) ? { timeoutMs: raw.timeoutMs } : {}),
  };
}
