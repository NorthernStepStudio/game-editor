/**
 * Artifact confinement: every returned Blender path must resolve under the
 * task work directory, exist, match expected type, and not escape via .. or symlinks.
 */

import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { SpecialistError } from "../types.js";
import type { BlenderOutputRequirement } from "./blenderTaskSpec.js";

const EXT_BY_KIND: Record<BlenderOutputRequirement["kind"], readonly string[]> = {
  blend: [".blend"],
  glb: [".glb"],
  png: [".png"],
  json: [".json"],
  log: [".log", ".txt"],
};

export function resolveConfinedPath(workDir: string, relativeOrAbsolute: string): string {
  if (!relativeOrAbsolute || relativeOrAbsolute.includes("\0")) {
    throw new SpecialistError("PERMISSION_DENIED", "Artifact path is empty or contains NUL");
  }
  if (relativeOrAbsolute.includes("..")) {
    throw new SpecialistError("PERMISSION_DENIED", `Path escape rejected: ${relativeOrAbsolute}`);
  }

  const workReal = realpathSync(resolve(workDir));
  const candidate = isAbsolute(relativeOrAbsolute)
    ? resolve(relativeOrAbsolute)
    : resolve(workReal, relativeOrAbsolute);
  const normalized = normalize(candidate);

  // Pre-existence confinement (string prefix after normalize).
  const workPrefix = workReal.endsWith(sep) ? workReal : workReal + sep;
  if (normalized !== workReal && !normalized.startsWith(workPrefix)) {
    throw new SpecialistError(
      "PERMISSION_DENIED",
      `Artifact path escapes work directory: ${normalized}`,
    );
  }

  if (!existsSync(normalized)) {
    throw new SpecialistError("VALIDATION_FAILED", `Artifact does not exist: ${normalized}`);
  }

  const lst = lstatSync(normalized);
  if (lst.isSymbolicLink()) {
    const real = realpathSync(normalized);
    if (real !== workReal && !real.startsWith(workPrefix)) {
      throw new SpecialistError(
        "PERMISSION_DENIED",
        `Symlink escape rejected: ${normalized} -> ${real}`,
      );
    }
    return real;
  }

  return realpathSync(normalized);
}

export interface ValidatedArtifact {
  readonly kind: BlenderOutputRequirement["kind"];
  readonly name: string;
  readonly path: string;
  readonly sizeBytes: number;
}

export function validateExpectedArtifacts(
  workDir: string,
  expected: readonly BlenderOutputRequirement[],
  reportedPaths?: Readonly<Record<string, string>>,
): ValidatedArtifact[] {
  const validated: ValidatedArtifact[] = [];

  for (const req of expected) {
    const reported = reportedPaths?.[req.name];
    const relativeName = reported ?? req.name;
    try {
      const path = resolveConfinedPath(workDir, relativeName);
      const ext = extname(path).toLowerCase();
      const allowed = EXT_BY_KIND[req.kind];
      if (!allowed.includes(ext)) {
        throw new SpecialistError(
          "VALIDATION_FAILED",
          `Artifact ${req.name} has unexpected extension ${ext}; expected ${allowed.join(",")}`,
        );
      }
      const size = statSync(path).size;
      const minBytes = req.minBytes ?? (req.kind === "log" ? 0 : 1);
      if (req.required && size < minBytes) {
        throw new SpecialistError(
          "VALIDATION_FAILED",
          `Artifact ${req.name} is empty or below minBytes (${size} < ${minBytes})`,
        );
      }
      validated.push({ kind: req.kind, name: req.name, path, sizeBytes: size });
    } catch (error) {
      if (!req.required && error instanceof SpecialistError && error.code === "VALIDATION_FAILED") {
        continue;
      }
      throw error;
    }
  }

  // Any path reported by Blender Python must also be confined, even if not expected.
  if (reportedPaths) {
    for (const [name, pathValue] of Object.entries(reportedPaths)) {
      resolveConfinedPath(workDir, pathValue);
      // Ensure the basename is not an absolute escape claim.
      if (name.includes("..") || name.includes("/") || name.includes("\\")) {
        throw new SpecialistError("PERMISSION_DENIED", `Unsafe reported artifact key: ${name}`);
      }
    }
  }

  return validated;
}

export function joinWorkArtifact(workDir: string, fileName: string): string {
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\") || fileName.includes("\0")) {
    throw new SpecialistError("PERMISSION_DENIED", `Unsafe artifact file name: ${fileName}`);
  }
  return join(resolve(workDir), fileName);
}
